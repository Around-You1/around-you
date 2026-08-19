// Package moderation provides a lightweight, dependency-free content screen for
// user-supplied text (partner profiles, rep onboarding). It does NOT block the
// save — callers record any hits as flags, which surface as an alert on the
// Admin Dashboard for a human to review.
//
// Detection is a curated, categorised word/pattern list matched with a
// normaliser that resists common evasion: case, accents-as-symbols, leetspeak
// (0/1/3/4/5/7/@/$/!), repeated letters ("fuuuck"), and separators between
// letters ("f.u.c.k", "f u c k"). Word-boundary anchoring keeps the classic
// Scunthorpe problem (profanity as a substring of an innocent word) in check.
//
// The lists below are a STARTING POINT and intentionally easy to edit: add or
// remove terms in `lists` and redeploy. Matching runs on RE2 (Go's regexp), so
// it is linear-time and safe against pathological input.
package moderation

import (
	"context"
	"log"
	"regexp"
	"strings"
	"time"

	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// Category names as stored on each flag.
const (
	CatProfanity      = "profanity"
	CatDiscrimination = "discrimination"
	CatAbuse          = "abuse"
)

// lists maps a category to the terms that fall under it. Multi-word entries are
// matched letter-by-letter (separators between letters are allowed), so
// "kill yourself" also catches "kill  yourself" and "killyourself".
var lists = map[string][]string{
	CatProfanity: {
		"fuck", "shit", "bitch", "asshole", "bastard", "dick", "piss",
		"cunt", "prick", "wanker", "bollocks", "twat", "slut", "whore",
		"motherfucker", "bullshit", "dumbass", "jackass", "douchebag",
	},
	// Slurs and hate/discriminatory terms. Kept deliberately compact; extend as
	// needed. These are the words a functional filter must recognise in order to
	// flag hateful content for review.
	CatDiscrimination: {
		"nigger", "nigga", "faggot", "fag", "retard", "retarded",
		"spic", "chink", "kike", "wetback", "tranny", "dyke",
		"coon", "gook", "paki", "kaffir", "kaffer", "moffie",
	},
	// Harassment / threats / sexual violence.
	CatAbuse: {
		"kill yourself", "kys", "kill you", "i will kill", "rape",
		"rape you", "die bitch", "hang yourself", "go die",
	},
}

// leet maps common substitution characters to the letter they stand in for.
var leet = strings.NewReplacer(
	"0", "o", "1", "i", "3", "e", "4", "a", "5", "s", "7", "t",
	"@", "a", "$", "s", "!", "i", "|", "i",
)

type compiled struct {
	category string
	term     string
	re       *regexp.Regexp
}

var patterns []compiled

func init() {
	for category, terms := range lists {
		for _, term := range terms {
			patterns = append(patterns, compiled{
				category: category,
				term:     term,
				re:       buildPattern(term),
			})
		}
	}
}

// buildPattern turns a plain term into an evasion-resistant, boundary-anchored
// regex over the leet-normalised text. Each letter may repeat; any run of
// non-letters is allowed between letters.
func buildPattern(term string) *regexp.Regexp {
	var b strings.Builder
	b.WriteString(`(?:^|[^a-z])`) // left boundary (non-letter or start)
	first := true
	for _, r := range strings.ToLower(term) {
		if r < 'a' || r > 'z' {
			continue // skip spaces/punctuation in the term itself
		}
		if !first {
			b.WriteString(`[^a-z]*`) // separators allowed between letters
		}
		b.WriteString(regexp.QuoteMeta(string(r)))
		b.WriteString(`+`) // allow repeated letters (fuuuck)
		first = false
	}
	b.WriteString(`(?:[^a-z]|$)`) // right boundary
	return regexp.MustCompile(b.String())
}

// Hit is one detected term within a piece of text.
type Hit struct {
	Category string
	Term     string
	Snippet  string
}

// blockCategories HARD-BLOCK a save (the handler rejects it). Profanity is not
// blocked — it saves and is flagged for review. Hate/discrimination and
// abuse/threats are blocked.
var blockCategories = map[string]bool{
	CatDiscrimination: true,
	CatAbuse:          true,
}

// BlockError screens the fields and returns a user-facing *errs.Error if any hit
// falls in a hard-block category, or nil if the content is allowed to save.
// Call this BEFORE writing to the database.
func BlockError(fields ...NamedField) error {
	for _, f := range fields {
		for _, h := range Scan(f.Value) {
			if blockCategories[h.Category] {
				if h.Category == CatDiscrimination {
					return &errs.Error{Code: errs.InvalidArgument, Message: "This submission contains hate speech or discriminatory language and can't be saved. Please remove it and try again."}
				}
				return &errs.Error{Code: errs.InvalidArgument, Message: "This submission contains threats or abusive language and can't be saved. Please remove it and try again."}
			}
		}
	}
	return nil
}

// Scan returns every flagged term found in text (deduplicated by term).
func Scan(text string) []Hit {
	if strings.TrimSpace(text) == "" {
		return nil
	}
	norm := leet.Replace(strings.ToLower(text))
	seen := map[string]bool{}
	var hits []Hit
	for _, p := range patterns {
		if p.re.MatchString(norm) {
			if seen[p.term] {
				continue
			}
			seen[p.term] = true
			hits = append(hits, Hit{Category: p.category, Term: p.term, Snippet: snippet(text)})
		}
	}
	return hits
}

// snippet returns a short, trimmed preview of the offending text for the review
// queue (never the whole description).
func snippet(text string) string {
	t := strings.Join(strings.Fields(text), " ")
	if len(t) > 140 {
		return t[:140] + "…"
	}
	return t
}

// NamedField is a labelled piece of text to screen.
type NamedField struct {
	Name  string
	Value string
}

// ScanAndFlag screens each field and records a moderation flag per hit. It never
// blocks — on any DB error it logs and returns. When entityID > 0 it first
// clears prior OPEN flags for that (source, entityType, entityID) so that
// editing to remove the content also clears its alerts, and re-saving refreshes
// them. actor (who submitted) is supplied by the caller (see auth.ActorLabel).
func ScanAndFlag(ctx context.Context, source, entityType string, entityID int64, subject, actor string, fields ...NamedField) {
	if entityID > 0 {
		if _, err := appdb.SQLDB.ExecContext(ctx,
			`DELETE FROM moderation_flags WHERE source = $1 AND entity_type = $2 AND entity_id = $3 AND status = 'open'`,
			source, entityType, entityID,
		); err != nil {
			log.Printf("moderation: clearing old flags failed (%s %s %d): %v", source, entityType, entityID, err)
		}
	}

	// Word-list pass — synchronous, fast, deterministic.
	for _, f := range fields {
		for _, h := range Scan(f.Value) {
			insertFlag(ctx, source, entityType, entityID, subject, f.Name, h, actor)
		}
	}

	// AI nuance pass — only if configured. Runs in the background on a detached
	// context so it never slows the save; any hits land in the review queue when
	// Claude responds.
	if AIEnabled() {
		var b strings.Builder
		for _, f := range fields {
			if strings.TrimSpace(f.Value) != "" {
				b.WriteString(f.Value)
				b.WriteString("\n")
			}
		}
		text := b.String()
		if strings.TrimSpace(text) != "" {
			go func() {
				bg, cancel := context.WithTimeout(context.Background(), 20*time.Second)
				defer cancel()
				for _, h := range aiScreen(bg, text) {
					insertFlag(bg, source, entityType, entityID, subject, "ai", h, actor)
				}
			}()
		}
	}
}

// insertFlag records one moderation flag. Best-effort: logs on error.
func insertFlag(ctx context.Context, source, entityType string, entityID int64, subject, field string, h Hit, actor string) {
	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO moderation_flags
			(source, entity_type, entity_id, subject, field, category, matched_term, snippet, actor, status)
		VALUES ($1, $2, NULLIF($3, 0), $4, $5, $6, $7, $8, $9, 'open')`,
		source, entityType, entityID, subject, field, h.Category, h.Term, h.Snippet, actor,
	); err != nil {
		log.Printf("moderation: inserting flag failed (%s.%s): %v", source, field, err)
	}
}
