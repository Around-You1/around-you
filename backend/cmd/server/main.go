// Command server is the pure-Go entrypoint that replaces `encore run`.
//
// It opens the database, applies SQL migrations, wires every endpoint onto a
// standard net/http mux with the same method + path shapes the Encore version
// exposed, and serves. Routes that previously carried Encore's `auth` tag are
// wrapped in bearer-token middleware; `public` routes are registered directly.
package main

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"backend_encore/app/accommodation"
	"backend_encore/app/admin"
	"backend_encore/app/analytics"
	"backend_encore/app/attraction"
	"backend_encore/app/auth"
	"backend_encore/app/billing"
	"backend_encore/app/booking"
	"backend_encore/app/editcode"
	"backend_encore/app/estate"
	"backend_encore/app/events"
	"backend_encore/app/health"
	"backend_encore/app/moderation"
	"backend_encore/app/rating"
	"backend_encore/app/redemption"
	"backend_encore/app/restaurant"
	"backend_encore/app/service"
	"backend_encore/app/stats"
	"backend_encore/app/storage"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
	"backend_encore/internal/httpx"
	"backend_encore/internal/ratelimit"
)

func main() {
	ctx := context.Background()

	if err := appdb.Init(ctx); err != nil {
		log.Fatalf("database init failed: %v", err)
	}
	defer appdb.Close()

	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "./migrations"
	}
	if err := appdb.Migrate(ctx, migrationsDir); err != nil {
		log.Fatalf("migrations failed: %v", err)
	}

	mux := http.NewServeMux()
	r := router{
		mux:      mux,
		lim:      ratelimit.New(rateLimitPerMin()),
		loginLim: ratelimit.New(loginRateLimitPerMin()),
	}

	// ---- Health (public) ---------------------------------------------------
	r.public("GET /ping", httpx.Empty(health.Ping))

	// ---- Behavioural events (public, best-effort analytics writes) ---------
	r.public("POST /events", httpx.Body(events.Record))

	// ---- Auth (public login — per-IP rate limited to slow brute force) ------
	r.login("POST /auth/access-code-login", httpx.Body(auth.AccessCodeLogin))
	r.login("POST /auth/secondary-login", httpx.Body(auth.SecondaryLogin))
	r.login("POST /auth/local-guest-login", httpx.Body(auth.LocalGuestLogin))
	r.login("POST /auth/login", httpx.Body(auth.Login))
	r.login("POST /auth/rep-login", httpx.Body(auth.RepLogin))
	r.login("POST /auth/acc-login", httpx.Body(auth.AccLogin))
	r.auth("POST /auth/create-rep", httpx.Body(auth.CreateRep))
	r.auth("GET /auth/reps", httpx.Empty(auth.ListReps))
	r.auth("POST /auth/rep/update", httpx.Body(auth.UpdateRep))
	r.auth("POST /auth/acc-code/set", httpx.Body(auth.SetAccCode))
	r.auth("GET /auth/acc-code/status", httpx.Empty(auth.AccCodeStatus))
	r.auth("GET /moderation/flags", httpx.Empty(moderation.ListFlags))
	r.auth("POST /moderation/flag-status", httpx.Body(moderation.SetFlagStatus))
	r.auth("POST /admin/bulk-set-active", httpx.Body(admin.BulkSetActive))
	r.auth("POST /admin/bulk-delete", httpx.Body(admin.BulkDelete))
	r.auth("GET /admin/archived", httpx.Empty(admin.ListArchived))
	r.auth("POST /admin/reinstate", httpx.Body(admin.Reinstate))
	r.auth("POST /admin/purge", httpx.Body(admin.PurgeArchived))

	// Real Estate & Rentals (isolated category)
	r.auth("POST /estate/agency", httpx.Body(estate.CreateAgency))
	r.auth("PUT /estate/agency", httpx.Body(estate.UpdateAgency))
	r.auth("GET /estate/agencies", httpx.Empty(estate.ListAgencies))
	r.auth("GET /estate/agency/get", httpx.Query(estate.GetAgency))
	r.auth("POST /estate/agency/active", httpx.Body(estate.SetAgencyActive))
	r.auth("DELETE /estate/agency", httpx.Body(estate.DeleteAgency))
	r.auth("POST /estate/agent", httpx.Body(estate.CreateAgent))
	r.auth("PUT /estate/agent", httpx.Body(estate.UpdateAgent))
	r.auth("GET /estate/agents", httpx.Query(estate.ListAgents))
	r.auth("GET /estate/agents/all", httpx.Empty(estate.ListAllAgents))
	r.auth("POST /estate/agent/active", httpx.Body(estate.SetAgentActive))
	r.auth("DELETE /estate/agent", httpx.Body(estate.DeleteAgent))
	r.auth("POST /estate/property", httpx.Body(estate.CreateProperty))
	r.auth("PUT /estate/property", httpx.Body(estate.UpdateProperty))
	r.auth("GET /estate/properties", httpx.Query(estate.ListProperties))
	r.auth("POST /estate/property/active", httpx.Body(estate.SetPropertyActive))
	r.auth("DELETE /estate/property", httpx.Body(estate.DeleteProperty))
	r.auth("GET /estate/public/agencies", httpx.Empty(estate.PublicAgencies))
	r.auth("GET /estate/public/agents", httpx.Empty(estate.PublicAgents))
	r.auth("GET /estate/public/properties", httpx.Empty(estate.PublicProperties))
	r.auth("GET /estate/public/agency", httpx.Query(estate.PublicAgency))
	r.auth("GET /estate/public/agent", httpx.Query(estate.PublicAgent))
	r.auth("GET /estate/public/property", httpx.Query(estate.PublicProperty))
	r.auth("GET /analytics/rep-activity", httpx.Empty(analytics.RepActivityReport))
	r.auth("GET /analytics/reps", httpx.Empty(analytics.RepsAnalytics))
	r.auth("GET /analytics/business", httpx.Empty(analytics.BusinessMetrics))
	r.auth("GET /analytics/events", httpx.Empty(analytics.EventsSummary))
	r.auth("GET /analytics/listing-views", httpx.Query(analytics.ListingViews))

	// ---- Accommodation (auth) ----------------------------------------------
	r.auth("GET /accommodation", httpx.Query(accommodation.List))
	r.auth("GET /accommodation/get", httpx.Query(accommodation.Get))
	r.auth("POST /accommodation", httpx.Body(accommodation.Create))
	r.auth("PUT /accommodation", httpx.Body(accommodation.Update))
	r.auth("DELETE /accommodation", httpx.Body(accommodation.DeleteAccommodation))
	r.auth("GET /accommodation/template", httpx.Empty(accommodation.Template))
	r.auth("GET /accommodation/export", httpx.Empty(accommodation.ExportAccommodations))
	r.auth("POST /accommodation/import", httpx.Body(accommodation.ImportAccommodations))

	// ---- Restaurant (auth) -------------------------------------------------
	r.auth("GET /restaurant", httpx.Query(restaurant.List))
	r.auth("GET /restaurant/by-municipality", httpx.Query(restaurant.ListByMunicipality))
	r.auth("GET /restaurant/nearby", httpx.Query(restaurant.ListNearby))
	r.auth("GET /restaurant/get", httpx.Query(restaurant.Get))
	r.auth("POST /restaurant", httpx.Body(restaurant.Create))
	r.auth("PUT /restaurant", httpx.Body(restaurant.Update))
	r.auth("DELETE /restaurant", httpx.Body(restaurant.DeleteRestaurant))
	r.auth("GET /restaurant/partner-code", httpx.Query(restaurant.GetPartnerCode))
	r.auth("POST /restaurant/partner-code/regenerate", httpx.Body(restaurant.RegeneratePartnerCode))
	r.auth("POST /restaurant/partner-code/toggle", httpx.Body(restaurant.TogglePartnerCode))
	r.auth("GET /restaurant/template", httpx.Empty(restaurant.Template))
	r.auth("GET /restaurant/export", httpx.Empty(restaurant.ExportRestaurants))
	r.auth("POST /restaurant/import", httpx.Body(restaurant.ImportRestaurants))

	// ---- Service (auth) ----------------------------------------------------
	r.auth("GET /service", httpx.Query(service.List))
	r.auth("GET /service/by-municipality", httpx.Query(service.ListByMunicipality))
	r.auth("GET /service/nearby", httpx.Query(service.ListNearby))
	r.auth("GET /service/get", httpx.Query(service.Get))
	r.auth("POST /service", httpx.Body(service.Create))
	r.auth("PUT /service", httpx.Body(service.Update))
	r.auth("DELETE /service", httpx.Body(service.DeleteService))
	r.auth("GET /service/partner-code", httpx.Query(service.GetPartnerCode))
	r.auth("POST /service/partner-code/regenerate", httpx.Body(service.RegeneratePartnerCode))
	r.auth("POST /service/partner-code/toggle", httpx.Body(service.TogglePartnerCode))
	r.auth("GET /service/template", httpx.Empty(service.Template))
	r.auth("GET /service/export", httpx.Empty(service.ExportServices))
	r.auth("POST /service/import", httpx.Body(service.ImportServices))

	// ---- Attraction (auth) -------------------------------------------------
	r.auth("GET /attraction", httpx.Query(attraction.List))
	r.auth("GET /attraction/by-municipality", httpx.Query(attraction.ListByMunicipality))
	r.auth("GET /attraction/nearby", httpx.Query(attraction.ListNearby))
	r.auth("GET /attraction/get", httpx.Query(attraction.Get))
	r.auth("POST /attraction", httpx.Body(attraction.Create))
	r.auth("PUT /attraction", httpx.Body(attraction.Update))
	r.auth("DELETE /attraction", httpx.Body(attraction.DeleteAttraction))
	r.auth("GET /attraction/partner-code", httpx.Query(attraction.GetPartnerCode))
	r.auth("POST /attraction/partner-code/regenerate", httpx.Body(attraction.RegeneratePartnerCode))
	r.auth("POST /attraction/partner-code/toggle", httpx.Body(attraction.TogglePartnerCode))
	r.auth("GET /attraction/template", httpx.Empty(attraction.Template))
	r.auth("GET /attraction/export", httpx.Empty(attraction.ExportAttractions))
	r.auth("POST /attraction/import", httpx.Body(attraction.ImportAttractions))

	// ---- Booking (auth) ----------------------------------------------------
	r.auth("POST /booking", httpx.Body(booking.Create))
	r.auth("GET /booking/mine", httpx.Query(booking.Mine))
	r.auth("GET /booking/for-partner", httpx.Query(booking.ForPartner))
	r.auth("POST /booking/cancel", httpx.Body(booking.Cancel))

	// ---- Billing / subscriptions (auth; SuperAdmin-gated in-handler) --------
	r.auth("GET /billing/subscriptions", httpx.Empty(billing.ListSubscriptions))
	r.auth("GET /billing/invoices", httpx.Empty(billing.ListInvoices))
	r.auth("GET /billing/commissions", httpx.Empty(billing.ListCommissions))
	r.auth("GET /billing/statement", httpx.Query(billing.MonthlyStatements))
	r.auth("POST /billing/statement/mark-paid", httpx.Body(billing.MarkPeriodPaid))
	r.auth("POST /billing/statement/email", httpx.Body(billing.EmailStatements))
	r.auth("POST /billing/subscription/status", httpx.Body(billing.SetSubscriptionStatus))
	r.auth("GET /billing/invoice-settings", httpx.Empty(billing.GetInvoiceSettings))
	r.auth("POST /billing/invoice-settings", httpx.Body(billing.SetInvoiceSettings))
	r.auth("GET /billing/invoice-preview", httpx.Empty(billing.InvoicePreview))

	// ---- Accountant portal (Accountant or SuperAdmin) ----------------------
	r.auth("GET /accounts/invoices", httpx.Empty(billing.AccountsInvoices))
	r.auth("GET /accounts/summary", httpx.Empty(billing.AccountsSummaryReport))
	r.auth("POST /accounts/invoice-status", httpx.Body(billing.SetInvoiceStatus))
	r.auth("GET /accounts/commissions", httpx.Empty(billing.AccountsCommissions))
	r.auth("GET /accounts/bookings", httpx.Empty(billing.AccountsBookings))
	// Scheduler-triggered monthly billing run — token-protected, not user auth.
	mux.Handle("POST /billing/run", billingRunHandler())

	// ---- Edit code (partner self-service profile editing) ------------------
	r.auth("GET /edit-code", httpx.Query(editcode.Get))
	r.auth("POST /edit-code/regenerate", httpx.Body(editcode.Regenerate))
	r.auth("POST /edit-code/verify", httpx.Body(editcode.Verify))

	// ---- Storage (mixed) ---------------------------------------------------
	r.auth("POST /storage/upload", httpx.Body(storage.Upload))
	r.public("GET /storage/logo", httpx.Empty(storage.GetLogo))
	r.auth("POST /storage/logo", httpx.Body(storage.SetLogo))
	r.public("GET /storage/profile-settings", httpx.Empty(storage.GetProfileSettings))
	r.auth("PUT /storage/profile-settings", httpx.Body(storage.SetProfileSettings))

	// ---- Stats (auth) ------------------------------------------------------
	r.auth("GET /stats", httpx.Empty(stats.Get))

	// ---- Rating (auth) ------------------------------------------------------
	r.auth("POST /rating/submit", httpx.Body(rating.SubmitRating))
	r.auth("POST /rating/summaries", httpx.Body(rating.ListSummaries))

	// ---- Discount redemptions (guest starts, restaurant scans to redeem) ---
	r.auth("POST /redemption/start", httpx.Body(redemption.Start))
	r.auth("POST /redemption/redeem", httpx.Body(redemption.Redeem))

	// ---- Not found -----------------------------------------------------------
	// Go's default 404 for an unmatched pattern is plain text, not the
	// {"code","message"} JSON shape every other endpoint returns. Registering
	// "/" as a catch-all doesn't shadow the specific routes above — Go 1.22's
	// ServeMux always prefers the most specific matching pattern.
	mux.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
		writeErr(w, &errs.Error{Code: errs.NotFound, Message: "no such route: " + req.Method + " " + req.URL.Path})
	})

	addr := ":" + port()
	handler := withCORS(mux)

	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}

// router registers handlers, optionally behind the bearer-token check.
type router struct {
	mux      *http.ServeMux
	lim      *ratelimit.Limiter // per-token limit for authenticated routes
	loginLim *ratelimit.Limiter // per-IP limit for public login routes
}

func (r router) public(pattern string, h http.HandlerFunc) {
	r.mux.Handle(pattern, h)
}

func (r router) auth(pattern string, h http.HandlerFunc) {
	r.mux.Handle(pattern, requireAuth(r.lim, h))
}

// login registers a PUBLIC auth endpoint behind a per-IP rate limit. These are
// the login routes themselves, so there is no bearer token to key on — the
// limit is keyed on the caller's IP to slow brute-forcing of access/edit codes.
func (r router) login(pattern string, h http.HandlerFunc) {
	r.mux.Handle(pattern, limitByIP(r.loginLim, h))
}

// limitByIP rejects a request with HTTP 429 once the caller's IP exceeds the
// limiter's rate. Applied to the public login routes.
func limitByIP(lim *ratelimit.Limiter, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if lim != nil && !lim.Allow(clientIP(req)) {
			w.Header().Set("Retry-After", "60")
			writeErr(w, &errs.Error{Code: errs.ResourceExhausted, Message: "too many attempts, please wait and try again"})
			return
		}
		next(w, req)
	}
}

// clientIP extracts the caller's real IP, honouring Fly.io's proxy. Fly sets
// Fly-Client-IP to the true client address; X-Forwarded-For (first entry) is
// the fallback; RemoteAddr is the last resort for direct/local requests.
func clientIP(req *http.Request) string {
	if ip := req.Header.Get("Fly-Client-IP"); ip != "" {
		return ip
	}
	if xff := req.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	if host, _, err := net.SplitHostPort(req.RemoteAddr); err == nil {
		return host
	}
	return req.RemoteAddr
}

// requireAuth rejects requests without a valid bearer token, matching the
// gate Encore's `auth` tag used to apply. It also applies a per-token rate
// limit: a normal guest/admin session never approaches the threshold, but an
// automated client trying to iterate many areas/coordinates to bulk-pull the
// directory hits it and receives HTTP 429. Keyed on the bearer token so the
// limit scopes to a single login session.
func requireAuth(lim *ratelimit.Limiter, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		token := req.Header.Get("Authorization")
		data, err := auth.Validate(req.Context(), token)
		if err != nil {
			writeErr(w, err)
			return
		}
		if lim != nil && !lim.Allow(token) {
			w.Header().Set("Retry-After", "60")
			writeErr(w, &errs.Error{Code: errs.ResourceExhausted, Message: "rate limit exceeded, please slow down"})
			return
		}
		next(w, req.WithContext(auth.WithData(req.Context(), data)))
	}
}

// allowedOrigins is the fixed list of websites permitted to call this API
// from a browser. Add a new one here (and redeploy) whenever a new domain
// needs access — e.g. a staging site, or a different local dev port.
var allowedOrigins = map[string]bool{
	"https://aroundyou.co.za":     true,
	"https://www.aroundyou.co.za": true,
	"http://localhost:3000":       true, // local frontend dev server

	// No *.vercel.app origin is listed on purpose. The site is only ever used
	// via the aroundyou.co.za custom domain, so Vercel's per-deployment
	// preview URLs (which carry a random ID that changes on every redeploy)
	// would be dead weight here. If a preview URL is ever needed, add the
	// project's STABLE domain from Vercel → Settings → Domains — the plain
	// <project-name>.vercel.app one, not a URL containing a random suffix.
}

// withCORS allows the separately-hosted frontend to call the API from the
// browser, including preflight OPTIONS requests. Encore applied CORS
// automatically; here it is explicit. Only origins in allowedOrigins get a
// yes — any other website's browser JS calling this API will be blocked by
// the browser itself, since no Access-Control-Allow-Origin header is sent
// back for it.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		origin := req.Header.Get("Origin")
		h := w.Header()
		h.Set("Vary", "Origin")

		if allowedOrigins[origin] {
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Supabase-Token")
			h.Set("Access-Control-Allow-Credentials", "true")
		}

		if req.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, req)
	})
}

func writeErr(w http.ResponseWriter, err error) {
	e, ok := err.(*errs.Error)
	if !ok {
		e = &errs.Error{Code: errs.Internal, Message: err.Error()}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(errs.HTTPStatus(e.Code))
	_ = json.NewEncoder(w).Encode(map[string]string{
		"code":    errs.CodeString(e.Code),
		"message": e.Message,
	})
}

// billingRunHandler triggers the monthly billing run. A scheduler (e.g. a
// GitHub Actions cron) calls it, so there is no user session — instead it
// requires a shared secret in the X-Billing-Token header matched against the
// BILLING_RUN_TOKEN env var. If that var is unset the endpoint is closed.
func billingRunHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		token := os.Getenv("BILLING_RUN_TOKEN")
		if token == "" || req.Header.Get("X-Billing-Token") != token {
			writeErr(w, &errs.Error{Code: errs.Unauthenticated, Message: "invalid or missing billing token"})
			return
		}
		n, err := billing.RunMonthlyBilling(req.Context())
		if err != nil {
			writeErr(w, err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]int{"invoicesIssued": n})
	}
}

func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "4000"
}

// rateLimitPerMin is the per-token request ceiling per minute, overridable via
// the RATE_LIMIT_PER_MIN env var. The default (180 = 3/sec sustained, with a
// matching burst) sits far above real usage — a dashboard load fires only a
// handful of parallel calls — so legitimate users never hit it.
func rateLimitPerMin() int {
	if v := os.Getenv("RATE_LIMIT_PER_MIN"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return 180
}

// loginRateLimitPerMin is the per-IP login-attempt ceiling per minute,
// overridable via LOGIN_RATE_LIMIT_PER_MIN. The default (30) is generous for
// real users — including several guests sharing one accommodation's Wi-Fi/NAT
// IP — while still capping the volume any single IP can throw at the login
// routes. Combined with the high entropy of a 12-char code, this makes
// brute-forcing infeasible.
func loginRateLimitPerMin() int {
	if v := os.Getenv("LOGIN_RATE_LIMIT_PER_MIN"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return 30
}
