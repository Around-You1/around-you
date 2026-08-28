package appdb

import (
	"os"
	"strings"
)

// Test/internal reps: their partners are REAL profiles (kept and shown to
// guests), but they must never appear in any billing metric or analytic, and
// never create an outstanding/recurring charge. Rep00000001 is the default; add
// more via the TEST_REP_CODES env var (comma-separated, case-insensitive).
//
// These helpers are the single source of truth shared by the billing and
// analytics packages so the exclusion can never drift between them.

func TestRepCodesLower() []string {
	out := []string{"rep00000001"} // default internal/test rep
	for _, c := range strings.Split(os.Getenv("TEST_REP_CODES"), ",") {
		if c = strings.ToLower(strings.TrimSpace(c)); c != "" {
			out = append(out, c)
		}
	}
	return out
}

// IsTestRep reports whether a rep code is an internal/test rep.
func IsTestRep(code string) bool {
	code = strings.ToLower(strings.TrimSpace(code))
	if code == "" {
		return false
	}
	for _, t := range TestRepCodesLower() {
		if code == t {
			return true
		}
	}
	return false
}

// quotedTestRepList renders the test-rep codes as a SQL value list, e.g.
// 'rep00000001','rep00000007'. Codes are operator-controlled (constant + env),
// never user input; single quotes are still escaped defensively.
func quotedTestRepList() string {
	codes := TestRepCodesLower()
	qs := make([]string, len(codes))
	for i, c := range codes {
		qs[i] = "'" + strings.ReplaceAll(c, "'", "''") + "'"
	}
	return strings.Join(qs, ",")
}

// NotTestRepSQL returns a predicate that EXCLUDES test reps for a lower()'d rep
// column expression, e.g. NotTestRepSQL("lower(coalesce(rep_code,''))") →
// "lower(coalesce(rep_code,'')) NOT IN ('rep00000001')".
func NotTestRepSQL(lowerColExpr string) string {
	return lowerColExpr + " NOT IN (" + quotedTestRepList() + ")"
}

// TestRepEntitiesSubquery returns a parenthesised SELECT of every
// (entity_type, entity_id) that belongs to a test rep, across all four partner
// tables. Callers use it to exclude those partners' rows, e.g.
//
//	WHERE (entity_type, entity_id) NOT IN  + TestRepEntitiesSubquery()
//
// The column pair the caller compares must be (type, id) in that order.
func TestRepEntitiesSubquery() string {
	list := quotedTestRepList()
	return `(
		SELECT 'restaurant'   AS et, id FROM restaurants   WHERE lower(coalesce(official_rep_code,'')) IN (` + list + `)
		UNION ALL SELECT 'service'      , id FROM services      WHERE lower(coalesce(official_rep_code,'')) IN (` + list + `)
		UNION ALL SELECT 'attraction'   , id FROM attractions   WHERE lower(coalesce(official_rep_code,'')) IN (` + list + `)
		UNION ALL SELECT 'accommodation', id FROM accommodations WHERE lower(coalesce(official_rep_code,'')) IN (` + list + `)
	)`
}
