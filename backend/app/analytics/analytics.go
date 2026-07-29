// Package analytics implements reporting endpoints for the Admin Dashboard's
// Analytics page. RepActivityReport is the first one — built entirely from
// data that already exists (every listing already records which rep created
// it, when, and at what tier), so no new tracking table was needed for this
// specific report. Other analytics (page visits, access-code usage) will
// need real tracking infrastructure added separately — see the code review
// notes for why those are a bigger, later piece of work.
package analytics

import (
	"context"
	"sort"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

type RepActivity struct {
	RepCode      string         `json:"repCode"`
	RepName      string         `json:"repName"`
	TotalClients int            `json:"totalClients"`
	ByTier       map[string]int `json:"byTier"`
	// DailyCounts maps day (YYYY-MM-DD) to how many listings this rep
	// created that day — the actual data the Analytics page's graph needs.
	DailyCounts map[string]int `json:"dailyCounts"`
}

type RepActivityResponse struct {
	Reps []RepActivity `json:"reps"`
}

// RepActivityReport is SuperAdmin-only, same pattern as CreateRep/ListReps.
//
//encore:api auth method=GET path=/analytics/rep-activity
func RepActivityReport(ctx context.Context) (*RepActivityResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

	// Accommodations have no accessLevel/tier column at all (see
	// OfficialUseSection.tsx — tiers only apply to the other three types),
	// so its tier is hardcoded to '' here, which the aggregation below
	// buckets as "N/A".
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT official_rep_code, '' as access_level, to_char(created_at, 'YYYY-MM-DD')
		FROM accommodations WHERE official_rep_code IS NOT NULL AND official_rep_code != ''
		UNION ALL
		SELECT official_rep_code, COALESCE(access_level, ''), to_char(created_at, 'YYYY-MM-DD')
		FROM restaurants WHERE official_rep_code IS NOT NULL AND official_rep_code != ''
		UNION ALL
		SELECT official_rep_code, COALESCE(access_level, ''), to_char(created_at, 'YYYY-MM-DD')
		FROM services WHERE official_rep_code IS NOT NULL AND official_rep_code != ''
		UNION ALL
		SELECT official_rep_code, COALESCE(access_level, ''), to_char(created_at, 'YYYY-MM-DD')
		FROM attractions WHERE official_rep_code IS NOT NULL AND official_rep_code != ''
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type agg struct {
		total  int
		byTier map[string]int
		dates  map[string]int
	}
	byRep := map[string]*agg{}

	for rows.Next() {
		var repCode, accessLevel, createdDate string
		if err := rows.Scan(&repCode, &accessLevel, &createdDate); err != nil {
			return nil, err
		}
		a, ok := byRep[repCode]
		if !ok {
			a = &agg{byTier: map[string]int{}, dates: map[string]int{}}
			byRep[repCode] = a
		}
		a.total++
		tier := accessLevel
		if tier == "" {
			tier = "N/A"
		}
		a.byTier[tier]++
		a.dates[createdDate]++
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	names := map[string]string{}
	nameRows, err := appdb.SQLDB.QueryContext(ctx, `SELECT rep_code, full_name FROM users WHERE role = 'Rep'`)
	if err != nil {
		return nil, err
	}
	defer nameRows.Close()
	for nameRows.Next() {
		var code, name string
		if err := nameRows.Scan(&code, &name); err != nil {
			return nil, err
		}
		names[code] = name
	}

	resp := &RepActivityResponse{Reps: []RepActivity{}}
	for code, a := range byRep {
		resp.Reps = append(resp.Reps, RepActivity{
			RepCode:      code,
			RepName:      names[code],
			TotalClients: a.total,
			ByTier:       a.byTier,
			DailyCounts:  a.dates,
		})
	}
	sort.Slice(resp.Reps, func(i, j int) bool { return resp.Reps[i].RepCode < resp.Reps[j].RepCode })

	return resp, nil
}
