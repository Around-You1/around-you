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
	Audience string `json:"audience"` // "local" (default) | "all"
	UserID   int64  `json:"userId"`   // when > 0, send only to this user's devices
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
		url = "/"
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

	payload, _ := json.Marshal(pushPayload{Title: title, Body: strings.TrimSpace(req.Body), URL: url})
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
		sem    = make(chan struct{}, 16)
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
				dead = append(dead, t.id) // subscription gone — clean it up
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

	return &SendResponse{Sent: sent, Failed: failed}, nil
}
