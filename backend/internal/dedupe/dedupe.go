// Package dedupe detects when a newly onboarded partner profile duplicates an
// existing one. A duplicate is: the same business name AND either the same
// business contact number or the same street address (the Official-Use contact
// is deliberately NOT used for matching).
//
// On a match the ORIGINAL is left untouched; the NEW row is marked
// is_duplicate = true with a reason, an Admin review flag is raised (in
// moderation_flags, so it shows on the Admin Dashboard alert), and the
// onboarding rep is emailed. The actual deletion is left to an admin.
//
// Best-effort: any DB/mail error is logged and swallowed so onboarding is never
// blocked by dedupe.
package dedupe

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"regexp"
	"strings"

	"backend_encore/internal/appdb"
	"backend_encore/internal/mailer"
)

var nonDigits = regexp.MustCompile(`[^0-9]`)

func normText(s string) string  { return strings.ToLower(strings.TrimSpace(s)) }
func normPhone(s string) string { return nonDigits.ReplaceAllString(s, "") }

// CheckOnCreate runs the duplicate check for a freshly created profile.
//   table       – the SQL table (restaurants/services/attractions/accommodations)
//   contactCol  – the business-contact column on that table (contact_number/contact)
//   entityType  – label stored on the flag (restaurant/service/…)
//   newID       – id of the just-created row
//   name/contact/address – the new row's business values
//   officialRepCode – the onboarding rep's code (to look up their email)
//   actor       – "email (Role)" of whoever submitted, for the flag record
func CheckOnCreate(ctx context.Context, table, contactCol, entityType string, newID int64, name, contact, address, officialRepCode, actor string) {
	nName := normText(name)
	nPhone := normPhone(contact)
	nAddr := normText(address)
	if nName == "" || (nPhone == "" && nAddr == "") {
		return // not enough to judge a duplicate
	}

	query := fmt.Sprintf(`
		SELECT id, name FROM %s
		WHERE id <> $1
		  AND lower(btrim(name)) = $2
		  AND (
		        ($3 <> '' AND regexp_replace(COALESCE(%s, ''), '[^0-9]', '', 'g') = $3)
		     OR ($4 <> '' AND lower(btrim(address)) = $4)
		  )
		ORDER BY id ASC
		LIMIT 1`, table, contactCol)

	var origID int64
	var origName string
	err := appdb.SQLDB.QueryRowContext(ctx, query, newID, nName, nPhone, nAddr).Scan(&origID, &origName)
	if err != nil {
		if err != sql.ErrNoRows {
			log.Printf("dedupe: query failed for %s #%d: %v", table, newID, err)
		}
		return // no duplicate (or error) — nothing to do
	}

	reason := fmt.Sprintf("Possible duplicate of %q (#%d). The original is kept; this entry is flagged for removal.", origName, origID)

	// Mark the NEW row as a duplicate (original untouched).
	if _, err := appdb.SQLDB.ExecContext(ctx,
		fmt.Sprintf(`UPDATE %s SET is_duplicate = true, duplicate_reason = $2 WHERE id = $1`, table),
		newID, reason,
	); err != nil {
		log.Printf("dedupe: marking duplicate failed for %s #%d: %v", table, newID, err)
	}

	// Raise an Admin review flag (surfaces on the Admin Dashboard moderation alert).
	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO moderation_flags
			(source, entity_type, entity_id, subject, field, category, matched_term, snippet, actor, status)
		VALUES ('duplicate', $1, $2, $3, 'profile', 'duplicate', 'duplicate', $4, $5, 'open')`,
		entityType, newID, name, reason, actor,
	); err != nil {
		log.Printf("dedupe: inserting admin flag failed for %s #%d: %v", table, newID, err)
	}

	// Notify the onboarding rep by email (best-effort; no-op if we can't find one).
	notifyRep(ctx, officialRepCode, name, entityType, origName)
}

func notifyRep(ctx context.Context, repCode, profileName, entityType, origName string) {
	repCode = strings.TrimSpace(repCode)
	if repCode == "" {
		return
	}
	var email sql.NullString
	if err := appdb.SQLDB.QueryRowContext(ctx,
		`SELECT rep_email FROM users WHERE role = 'Rep' AND lower(rep_code) = lower($1)`, repCode,
	).Scan(&email); err != nil {
		return // no such rep or no email column value
	}
	to := strings.TrimSpace(email.String)
	if to == "" {
		return
	}
	subject := "Duplicate profile flagged — " + profileName
	html := fmt.Sprintf(
		`<p>Hi,</p>`+
			`<p>The %s profile you onboarded, <strong>%s</strong>, looks like a duplicate of an existing listing (<strong>%s</strong>).</p>`+
			`<p>The original will be kept, and this duplicate entry has been flagged and will be removed by an administrator. `+
			`If you believe this is not a duplicate, please reply and let us know.</p>`+
			`<p>Thank you,<br/>Around You</p>`,
		entityType, profileName, origName,
	)
	go func() { _ = mailer.Send(to, subject, html) }()
}
