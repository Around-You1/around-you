package analytics

import (
	"context"
	"fmt"
	"sort"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// RepMetrics is the full per-rep analytics row for the Reps section of the
// Admin Analytics dashboard.
type RepMetrics struct {
	RepCode       string `json:"repCode"`
	RepName       string `json:"repName"`
	Status        string `json:"status"`
	Region        string `json:"region"`
	Province      string `json:"province"`
	IsTeamLeader  bool   `json:"isTeamLeader"`
	UplineRepCode string `json:"uplineRepCode"`
	DateJoined    string `json:"dateJoined"`

	PartnersSigned int            `json:"partnersSigned"`
	ByType         map[string]int `json:"byType"` // accommodation/restaurant/service/attraction
	ByPlan         map[string]int `json:"byPlan"` // "Tier 1".."Tier 4" / "Booking"

	ActiveMrrCents          int `json:"activeMrrCents"`
	OwnCommissionCents      int `json:"ownCommissionCents"`
	OverrideCommissionCents int `json:"overrideCommissionCents"`
	TotalCommissionCents    int `json:"totalCommissionCents"`

	DownlineCount    int `json:"downlineCount"`
	DownlineMrrCents int `json:"downlineMrrCents"`
}

type RepsAnalyticsResponse struct {
	Reps                 []RepMetrics `json:"reps"` // leaderboard order (highest total commission first)
	TotalActiveReps      int          `json:"totalActiveReps"`
	TotalTeamLeaders     int          `json:"totalTeamLeaders"`
	TotalMrrCents        int          `json:"totalMrrCents"`
	TotalCommissionCents int          `json:"totalCommissionCents"`
}

// RepsAnalytics is SuperAdmin-only. It assembles per-rep sales, recurring
// revenue, commission (own + override), and downline metrics from the rep
// hierarchy, subscriptions, and commission ledger.
//
//encore:api auth method=GET path=/analytics/reps
func RepsAnalytics(ctx context.Context) (*RepsAnalyticsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

	byRep := map[string]*RepMetrics{}

	// 1) Every rep + profile fields.
	repRows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT COALESCE(rep_code,''), COALESCE(full_name,''), COALESCE(rep_status,'Active'),
		       COALESCE(region,''), COALESCE(province,''), is_team_leader,
		       COALESCE(upline_rep_code,''), COALESCE(to_char(date_joined,'YYYY-MM-DD'),'')
		FROM users WHERE role = 'Rep'`)
	if err != nil {
		return nil, err
	}
	for repRows.Next() {
		m := &RepMetrics{ByType: map[string]int{}, ByPlan: map[string]int{}}
		if err := repRows.Scan(&m.RepCode, &m.RepName, &m.Status, &m.Region, &m.Province,
			&m.IsTeamLeader, &m.UplineRepCode, &m.DateJoined); err != nil {
			repRows.Close()
			return nil, err
		}
		if m.RepCode != "" {
			byRep[m.RepCode] = m
		}
	}
	repRows.Close()
	if err := repRows.Err(); err != nil {
		return nil, err
	}

	// 2) Subscriptions → partners signed, by type, by plan, active MRR.
	subRows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT COALESCE(rep_code,''), partner_type, plan, COALESCE(tier,0), monthly_cents, status
		FROM partner_subscription WHERE rep_code IS NOT NULL AND rep_code <> ''`)
	if err != nil {
		return nil, err
	}
	for subRows.Next() {
		var repCode, partnerType, plan, status string
		var tier, monthly int
		if err := subRows.Scan(&repCode, &partnerType, &plan, &tier, &monthly, &status); err != nil {
			subRows.Close()
			return nil, err
		}
		m := byRep[repCode]
		if m == nil {
			continue // subscription references a rep code with no rep row — skip
		}
		m.PartnersSigned++
		m.ByType[partnerType]++
		if plan == "booking" {
			m.ByPlan["Booking"]++
		} else {
			m.ByPlan[fmt.Sprintf("Tier %d", tier)]++
		}
		if status == "Active" {
			m.ActiveMrrCents += monthly
		}
	}
	subRows.Close()
	if err := subRows.Err(); err != nil {
		return nil, err
	}

	// 3) Commissions → own / override totals.
	comRows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT rep_code, type, COALESCE(SUM(amount_cents),0)
		FROM commission GROUP BY rep_code, type`)
	if err != nil {
		return nil, err
	}
	for comRows.Next() {
		var repCode, ctype string
		var amount int
		if err := comRows.Scan(&repCode, &ctype, &amount); err != nil {
			comRows.Close()
			return nil, err
		}
		m := byRep[repCode]
		if m == nil {
			continue
		}
		switch ctype {
		case "own":
			m.OwnCommissionCents += amount
		case "override":
			m.OverrideCommissionCents += amount
		}
	}
	comRows.Close()
	if err := comRows.Err(); err != nil {
		return nil, err
	}

	// 4) Derive downline count + downline MRR from the hierarchy already loaded.
	for _, m := range byRep {
		m.TotalCommissionCents = m.OwnCommissionCents + m.OverrideCommissionCents
		if up := byRep[m.UplineRepCode]; up != nil && m.UplineRepCode != "" {
			up.DownlineCount++
			up.DownlineMrrCents += m.ActiveMrrCents
		}
	}

	resp := &RepsAnalyticsResponse{Reps: make([]RepMetrics, 0, len(byRep))}
	for _, m := range byRep {
		resp.Reps = append(resp.Reps, *m)
		if m.Status == "Active" {
			resp.TotalActiveReps++
		}
		if m.IsTeamLeader {
			resp.TotalTeamLeaders++
		}
		resp.TotalMrrCents += m.ActiveMrrCents
		resp.TotalCommissionCents += m.TotalCommissionCents
	}
	// Leaderboard order: highest total commission first, then name.
	sort.Slice(resp.Reps, func(i, j int) bool {
		if resp.Reps[i].TotalCommissionCents != resp.Reps[j].TotalCommissionCents {
			return resp.Reps[i].TotalCommissionCents > resp.Reps[j].TotalCommissionCents
		}
		return resp.Reps[i].RepName < resp.Reps[j].RepName
	})
	return resp, nil
}
