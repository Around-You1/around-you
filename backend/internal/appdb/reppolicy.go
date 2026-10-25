package appdb

import (
	"os"
	"strings"
)

// Test/internal reps: their partners are REAL profiles (kept and shown to
// guests), but they must never appear in any billing metric or analytic, and
// never create an outstanding/recurring charge. ZERO (formerly Rep00000001) is the default; add
// more via the TEST_REP_CODES env var (comma-separated, case-insensitive).
//
// These helpers are the single source of truth shared by the billing and
// analytics packages so the exclusion can never drift between them.

func TestRepCodesLower() []string {
	out := []string{"zero"} // default internal/test rep (formerly Rep00000001)
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

// No-commission reps: unlike test reps, their partners ARE real, billed and
// counted profiles treated exactly like any other partner (first invoice now,
// September-October 2026 promo R0, normal recurring from November). The ONLY difference
// is that the rep earns NO commission — used for the internal "Around You"
// company account (AROUNDYOU, formerly Rep00000005) that onboards partners directly.
// AROUNDYOU and HALF are the defaults; add more via NO_COMMISSION_REP_CODES (comma-separated,
// case-insensitive).
func NoCommissionRepCodesLower() []string {
	out := []string{"aroundyou", "half"} // internal "Around You" company accounts (formerly Rep00000005, Rep00000012)
	for _, c := range strings.Split(os.Getenv("NO_COMMISSION_REP_CODES"), ",") {
		if c = strings.ToLower(strings.TrimSpace(c)); c != "" {
			out = append(out, c)
		}
	}
	return out
}

// IsNoCommissionRep reports whether a rep code earns no commission (its
// partners are still billed and counted normally).
func IsNoCommissionRep(code string) bool {
	code = strings.ToLower(strings.TrimSpace(code))
	if code == "" {
		return false
	}
	for _, t := range NoCommissionRepCodesLower() {
		if code == t {
			return true
		}
	}
	return false
}

// Half-price reps: partners onboarded under these codes are billed HALF the
// normal monthly cost (the per-booking / pre-order usage fees are unchanged).
// Their partners are otherwise real, billed and counted like any other.
// HALF ("Around You 12", formerly Rep00000012) is the default; add more via
// HALF_PRICE_REP_CODES (comma-separated, case-insensitive).
func HalfPriceRepCodesLower() []string {
	out := []string{"half"} // formerly Rep00000012
	for _, c := range strings.Split(os.Getenv("HALF_PRICE_REP_CODES"), ",") {
		if c = strings.ToLower(strings.TrimSpace(c)); c != "" {
			out = append(out, c)
		}
	}
	return out
}

// IsHalfPriceRep reports whether a rep code's partners are billed at half the
// normal monthly cost.
func IsHalfPriceRep(code string) bool {
	code = strings.ToLower(strings.TrimSpace(code))
	if code == "" {
		return false
	}
	for _, t := range HalfPriceRepCodesLower() {
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
// column expression, e.g. NotTestRepSQL("lower(coalesce(rep_code,”))") →
// "lower(coalesce(rep_code,”)) NOT IN ('rep00000001')".
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
