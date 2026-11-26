// Web Push notifications. A Local subscribes from their phone and the browser
// hands us an anonymous push token (no email or number). A SuperAdmin can then
// push a message to all Locals (new deals / announcements) or to one user
// (e.g. a lucky-draw winner). Sending uses VAPID keys from env (Fly secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
package push

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"sync"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

func vapidPublic() string  { return strings.TrimSpace(os.Getenv("VAPID_PUBLIC_KEY")) }
func vapidPrivate() string { return strings.TrimSpace(os.Getenv("VAPID_PRIVATE_KEY")) }
func vapidSubject() string {
	s := strings.TrimSpace(os.Getenv("VAPID_SUBJECT"))
	if s == "" {
		s = "mailto:accounts@aroundyou.co.za"
	}
	return s
}

// --- VAPID public key (the frontend needs it to subscribe) -------------------

type VapidPublicKeyResponse struct {
	PublicKey string `json:"publicKey"`
}

//encore:api public method=GET path=/push/vapid-public
func VapidPublicKey(ctx context.Context) (*VapidPublicKeyResponse, error) {
	return &VapidPublicKeyResponse{PublicKey: vapidPublic()}, nil
}

// --- Subscribe (store a device's anonymous push token) -----------------------

type SubscribeRequest struct {
	Endpoint string `json:"endpoint"`
	P256dh   string `json:"p256dh"`
	Auth     string `json:"auth"`
}

type SubscribeResponse struct {
	OK bool `json:"ok"`
}

//encore:api auth method=POST path=/push/subscribe
func Subscribe(ctx context.Context, req *SubscribeRequest) (*SubscribeResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.UserID == 0 {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "sign in first"}
	}
	ep := strings.TrimSpace(req.Endpoint)
	p := strings.TrimSpace(req.P256dh)
	a := strings.TrimSpace(req.Auth)
	if ep == "" || p == "" || a == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "endpoint, p256dh and auth are required"}
	}
	_, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (endpoint) DO UPDATE
		  SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
		data.UserID, ep, p, a)
	if err != nil {
		return nil, err
	}
	return &SubscribeResponse{OK: true}, nil
}

// --- Send (SuperAdmin pushes to Locals, or to one user) ----------------------

type SendRequest struct {
	Title    string `json:"title"`
	Body     string `json:"body"`
	URL      string `json:"url"`      // where tapping opens; defaults to "/"
	Audience string `json:"audience"`  // "local" (default) | "all"
	UserID   int64  `json:"userId"`    // when > 0, send only to this user's devices
	ExpiresAt string `json:"expiresAt"` // optional RFC3339; after this the inbox message is removed
}

type SendResponse struct {
	Sent   int `json:"sent"`
	Failed int `json:"failed"`
}

type pushPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
}

type pushTarget struct {
	id       int64
	endpoint string
	p256dh   string
	auth     string
}

//encore:api auth method=POST path=/push/send
func Send(ctx context.Context, req *SendRequest) (*SendResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can send notifications"}
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "a title is required"}
	}
	if vapidPublic() == "" || vapidPrivate() == "" {
		return nil, &errs.Error{Code: errs.Internal, Message: "push is not configured (VAPID keys missing)"}
	}
	url := strings.TrimSpace(req.URL)
	if url == "" {
		// Tapping a notification opens the app and the in-app inbox.
		url = "/local-dashboard?notifications=1"
	}

	// Log broadcasts (to all Locals / everyone) so they appear in the in-app
	// inbox. One-device test sends ("self") and single-user sends are not logged.
	aud := strings.ToLower(strings.TrimSpace(req.Audience))
	if aud == "" {
		aud = "local"
	}
	var expiresAt *time.Time
	if e := strings.TrimSpace(req.ExpiresAt); e != "" {
		if t, err := time.Parse(time.RFC3339, e); err == nil {
			expiresAt = &t
		}
	}
	if req.UserID == 0 && (aud == "local" || aud == "all") {
		_, _ = appdb.SQLDB.ExecContext(ctx,
			`INSERT INTO notifications (title, body, url, audience, expires_at) VALUES ($1, $2, $3, $4, $5)`,
			title, strings.TrimSpace(req.Body), url, aud, expiresAt)
	}

	q := `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
	      FROM push_subscriptions ps
	      JOIN users u ON u.id = ps.user_id`
	var args []interface{}
	switch {
	case req.UserID > 0:
		q += ` WHERE ps.user_id = $1`
		args = append(args, req.UserID)
	case strings.EqualFold(strings.TrimSpace(req.Audience), "self"):
		// Only the admin's own device(s) — for test sends.
		q += ` WHERE ps.user_id = $1`
		args = append(args, data.UserID)
	case strings.EqualFold(strings.TrimSpace(req.Audience), "all"):
		// no role filter — everyone with a subscription
	default:
		q += ` WHERE u.role = 'LocalGuest'`
	}
	rows, err := appdb.SQLDB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	var targets []pushTarget
	for rows.Next() {
		var t pushTarget
		if err := rows.Scan(&t.id, &t.endpoint, &t.p256dh, &t.auth); err != nil {
			rows.Close()
			return nil, err
		}
		targets = append(targets, t)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Fan out in the background so the request returns immediately. A large
	// audience (e.g. a municipality-wide alert) can take minutes to deliver and
	// must not block or time out the request. The in-app inbox row was already
	// written synchronously above, so recipients see the alert even before their
	// push arrives. Best-effort: a deploy/restart mid-send stops remaining pushes.
	go fanout(context.Background(), title, strings.TrimSpace(req.Body), url, targets)
	return &SendResponse{Sent: len(targets), Failed: 0}, nil
}

// fanoutConcurrency caps simultaneous web-push sends. High enough that a very
// large audience (tens of thousands) still clears in minutes, low enough to stay
// gentle on the machine's outbound connections.
const fanoutConcurrency = 48

// fanout delivers a web-push payload to every target concurrently and prunes
// dead subscriptions. Returns (sent, failed). Shared by the SuperAdmin broadcast
// and the ward-councillor scoped alerts.
func fanout(ctx context.Context, title, body, url string, targets []pushTarget) (int, int) {
	payload, _ := json.Marshal(pushPayload{Title: title, Body: body, URL: url})
	opts := &webpush.Options{
		Subscriber:      vapidSubject(),
		VAPIDPublicKey:  vapidPublic(),
		VAPIDPrivateKey: vapidPrivate(),
		TTL:             86400,
	}
	var (
		mu     sync.Mutex
		sent   int
		failed int
		dead   []int64
		wg     sync.WaitGroup
		sem    = make(chan struct{}, fanoutConcurrency)
	)
	for _, t := range targets {
		wg.Add(1)
		sem <- struct{}{}
		go func(t pushTarget) {
			defer wg.Done()
			defer func() { <-sem }()
			sub := &webpush.Subscription{Endpoint: t.endpoint, Keys: webpush.Keys{P256dh: t.p256dh, Auth: t.auth}}
			resp, err := webpush.SendNotification(payload, sub, opts)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				failed++
				return
			}
			defer resp.Body.Close()
			if resp.StatusCode == 404 || resp.StatusCode == 410 {
				dead = append(dead, t.id)
				failed++
				return
			}
			if resp.StatusCode >= 400 {
				failed++
				return
			}
			sent++
		}(t)
	}
	wg.Wait()
	for _, id := range dead {
		_, _ = appdb.SQLDB.ExecContext(ctx, `DELETE FROM push_subscriptions WHERE id = $1`, id)
	}
	return sent, failed
}


// --- In-app inbox: recent broadcast notifications ---------------------------

type NotificationItem struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	URL       string `json:"url"`
	CreatedAt string `json:"createdAt"`
}

type RecentNotificationsResponse struct {
	Notifications []NotificationItem `json:"notifications"`
}

// RecentNotifications returns the most recent broadcast notifications (newest
// first) for the in-app inbox. Public: these are messages already pushed to
// every Local, so there is nothing private to protect.
//
//encore:api public method=GET path=/notifications/recent
type RecentNotificationsRequest struct {
	PostalCode string `query:"postalCode"`
}

func RecentNotifications(ctx context.Context, req *RecentNotificationsRequest) (*RecentNotificationsResponse, error) {
	// Remove any messages whose end date/time has passed, so they disappear from
	// every device's inbox.
	_, _ = appdb.SQLDB.ExecContext(ctx, `DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at <= now()`)
	// Newest 30 that are still live, shown oldest-first. A ward-scoped message
	// (postal_codes set) only shows to a viewer whose postal code is in the list;
	// platform-wide messages (no postal_codes) show to everyone.
	pc := strings.TrimSpace(req.PostalCode)
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT id, title, body, url, created_at FROM (
			SELECT id, title, body, url, created_at
			FROM notifications
			WHERE audience IN ('local', 'all') AND (expires_at IS NULL OR expires_at > now())
			  AND (postal_codes IS NULL OR cardinality(postal_codes) = 0 OR $1 = ANY(postal_codes))
			ORDER BY created_at DESC, id DESC
			LIMIT 30
		) t
		ORDER BY created_at ASC, id ASC`, pc)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []NotificationItem{}
	for rows.Next() {
		var n NotificationItem
		var created time.Time
		if err := rows.Scan(&n.ID, &n.Title, &n.Body, &n.URL, &created); err != nil {
			return nil, err
		}
		n.CreatedAt = created.UTC().Format(time.RFC3339)
		out = append(out, n)
	}
	return &RecentNotificationsResponse{Notifications: out}, rows.Err()
}


// --- Notification read -> counts as a sign-in --------------------------------

type OpenedResponse struct {
	OK bool `json:"ok"`
}

// NotificationOpened records a sign-in for the current user when they open a
// notification (tapping it lands them on the Local page). This makes a
// notification read show up in the Overall sign-ins analytics, the same way a
// fresh login does. Best-effort and silent when not signed in.
//
//encore:api auth method=POST path=/notifications/opened
func NotificationOpened(ctx context.Context) (*OpenedResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.UserID == 0 {
		return &OpenedResponse{OK: true}, nil
	}
	token := "no_" + appdb.RandomCode(30)
	_, _ = appdb.SQLDB.ExecContext(ctx,
		`INSERT INTO sessions (token, user_id) VALUES ($1, $2)`, token, data.UserID)
	return &OpenedResponse{OK: true}, nil
}
