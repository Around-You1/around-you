// Package mailer sends transactional email via the Resend HTTP API. It is
// deliberately dependency-free (plain net/http, no SDK) and best-effort:
// callers should ignore the returned error for non-critical notifications so a
// mail hiccup never breaks the main request.
//
// Config (Fly secrets / env):
//   RESEND_API_KEY  required — the Resend API key. If unset, Send is a no-op.
//   RESEND_FROM     optional — the From address. Defaults to Resend's shared
//                   test sender, which can ONLY deliver to the Resend account's
//                   own address until you verify a domain. For production set
//                   e.g. "Around You <noreply@aroundyou.co.za>".
package mailer

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"time"
)

func Send(to, subject, html string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" || to == "" {
		return nil // not configured or no recipient — skip silently
	}
	from := os.Getenv("RESEND_FROM")
	if from == "" {
		from = "Around You <onboarding@resend.dev>"
	}
	payload, err := json.Marshal(map[string]interface{}{
		"from":    from,
		"to":      []string{to},
		"subject": subject,
		"html":    html,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}
