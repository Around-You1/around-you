package appdb

import (
	"context"
	"strings"

	"github.com/lib/pq"
)

// SupportOrgNamesForReps resolves, for each given rep code, the Team Leader
// organisation name to show in a partner's "We support …" badge:
//   - the rep's own organisation name if that rep is a Team Leader, else
//   - the rep's upline organisation name if the upline is a Team Leader, else
//   - empty (no badge).
//
// Returns a map keyed by LOWERCASED rep code (only non-empty results). One
// query; safe for empty input.
func SupportOrgNamesForReps(ctx context.Context, codes []string) map[string]string {
	out := map[string]string{}
	seen := map[string]bool{}
	lc := make([]string, 0, len(codes))
	for _, c := range codes {
		c = strings.ToLower(strings.TrimSpace(c))
		if c == "" || seen[c] {
			continue
		}
		seen[c] = true
		lc = append(lc, c)
	}
	if len(lc) == 0 {
		return out
	}
	rows, err := SQLDB.QueryContext(ctx, `
		SELECT lower(u.rep_code),
		       CASE
		         WHEN u.is_team_leader THEN COALESCE(u.full_name, '')
		         WHEN tl.is_team_leader THEN COALESCE(tl.full_name, '')
		         ELSE ''
		       END
		FROM users u
		LEFT JOIN users tl
		  ON lower(tl.rep_code) = lower(COALESCE(u.upline_rep_code, ''))
		 AND tl.role = 'Rep'
		WHERE u.role = 'Rep' AND lower(u.rep_code) = ANY($1)`,
		pq.Array(lc))
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var code, org string
		if err := rows.Scan(&code, &org); err != nil {
			continue
		}
		if strings.TrimSpace(org) != "" {
			out[code] = strings.TrimSpace(org)
		}
	}
	return out
}

// SupportOrgNameForRep is the single-code convenience wrapper.
func SupportOrgNameForRep(ctx context.Context, code string) string {
	return SupportOrgNamesForReps(ctx, []string{code})[strings.ToLower(strings.TrimSpace(code))]
}
