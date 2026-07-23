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
	"net/http"
	"os"
	"time"

	"backend_encore/app/accommodation"
	"backend_encore/app/attraction"
	"backend_encore/app/auth"
	"backend_encore/app/health"
	"backend_encore/app/restaurant"
	"backend_encore/app/service"
	"backend_encore/app/stats"
	"backend_encore/app/storage"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
	"backend_encore/internal/httpx"
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
	r := router{mux: mux}

	// ---- Health (public) ---------------------------------------------------
	r.public("GET /ping", httpx.Empty(health.Ping))

	// ---- Auth (public) -----------------------------------------------------
	r.public("POST /auth/access-code-login", httpx.Body(auth.AccessCodeLogin))
	r.public("POST /auth/secondary-login", httpx.Body(auth.SecondaryLogin))
	r.public("POST /auth/local-guest-login", httpx.Body(auth.LocalGuestLogin))

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

	// ---- Storage (mixed) ---------------------------------------------------
	r.auth("POST /storage/upload", httpx.Body(storage.Upload))
	r.public("GET /storage/logo", httpx.Empty(storage.GetLogo))
	r.auth("POST /storage/logo", httpx.Body(storage.SetLogo))
	r.public("GET /storage/profile-settings", httpx.Empty(storage.GetProfileSettings))
	r.auth("PUT /storage/profile-settings", httpx.Body(storage.SetProfileSettings))

	// ---- Stats (auth) ------------------------------------------------------
	r.auth("GET /stats", httpx.Empty(stats.Get))

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
	mux *http.ServeMux
}

func (r router) public(pattern string, h http.HandlerFunc) {
	r.mux.Handle(pattern, h)
}

func (r router) auth(pattern string, h http.HandlerFunc) {
	r.mux.Handle(pattern, requireAuth(h))
}

// requireAuth rejects requests without a valid bearer token, matching the
// gate Encore's `auth` tag used to apply.
func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if _, err := auth.Validate(req.Header.Get("Authorization")); err != nil {
			writeErr(w, err)
			return
		}
		next(w, req)
	}
}

// withCORS allows the separately-hosted frontend to call the API from the
// browser, including preflight OPTIONS requests. Encore applied CORS
// automatically; here it is explicit.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		origin := req.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		h := w.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		h.Set("Vary", "Origin")
		h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		h.Set("Access-Control-Allow-Credentials", "true")

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

func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "4000"
}
