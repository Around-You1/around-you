// Package mailer sends transactional email via the Resend HTTP API. It is
// dependency-light (plain net/http) and best-effort: callers should ignore the
// returned error for non-critical notifications so a mail hiccup never breaks
// the main request. Every attempt (sent / failed / skipped) is recorded in the
// email_log table so failures are visible in the Admin Billing tab and Fly logs.
//
// Config (Fly secrets / env):
//   RESEND_API_KEY  required — the Resend API key. If unset, Send is a no-op
//                   and the attempt is logged as "skipped".
//   RESEND_FROM     optional — the From address. Defaults to Resend's shared
//                   test sender, which can ONLY deliver to the Resend account's
//                   own address until you verify a domain. For production set
//                   e.g. "Around You <noreply@aroundyou.co.za>".
package mailer

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"backend_encore/internal/appdb"
)

func Send(to, subject, html string) error {
	return SendOpts(to, subject, html, "", nil)
}

// SendOpts is Send with an optional reply-to address and optional CC list. Used
// by the rep-invoice submission so Accounts can reply straight to the rep and
// the rep gets their own copy.
func SendOpts(to, subject, html, replyTo string, cc []string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if to == "" {
		logAttempt(to, subject, "skipped", "no recipient address")
		return nil
	}
	if apiKey == "" {
		logAttempt(to, subject, "skipped", "RESEND_API_KEY not set")
		return nil
	}
	from := os.Getenv("RESEND_FROM")
	if from == "" {
		from = "Around You <onboarding@resend.dev>"
	}
	body := map[string]interface{}{
		"from":    from,
		"to":      []string{to},
		"subject": subject,
		"html":    html,
	}
	if replyTo != "" {
		body["reply_to"] = replyTo
	}
	if len(cc) > 0 {
		body["cc"] = cc
	}
	payload, err := json.Marshal(body)
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
		log.Printf("mailer: send to %s failed: %v", to, err)
		logAttempt(to, subject, "failed", err.Error())
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2000))
		msg := fmt.Sprintf("Resend HTTP %d: %s", resp.StatusCode, string(body))
		log.Printf("mailer: send to %s rejected — %s", to, msg)
		logAttempt(to, subject, "failed", msg)
		return errors.New(msg)
	}

	logAttempt(to, subject, "sent", "")
	return nil
}

// logAttempt records a delivery attempt. Best-effort: never blocks or errors the
// caller, and is a no-op if the DB isn't wired up (e.g. in unit tests).
func logAttempt(to, subject, status, detail string) {
	if appdb.SQLDB == nil {
		return
	}
	if len(detail) > 500 {
		detail = detail[:500]
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _ = appdb.SQLDB.ExecContext(ctx,
		`INSERT INTO email_log (to_addr, subject, status, detail) VALUES ($1, $2, $3, $4)`,
		to, subject, status, detail)
}
