// This file adds the "Locals" analytics used by the Admin Dashboard's
// Analytics page: a dropdown listing every local guest who has signed in,
// and a totals query (Daily / Weekly / Monthly / Yearly) for sign-ins,
// either for one selected local or across all of them.
//
// Depends on migration 000072_add_user_id_to_events.sql, which adds
// events.user_id so each 'login' event (see app/auth/auth.go's
// issueSession) can be tied back to the specific user who signed in.
package analytics

import (
	"context"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// LocalGuestOption is one entry in the "Locals" dropdown.
type LocalGuestOption struct {
	UserID      int64  `json:"userId"`
	Email       string `json:"email"`
	Area        string `json:"area"`
	TotalLogins int    `json:"totalLogins"`
}

type LocalsListResponse struct {
	Locals []LocalGuestOption `json:"locals"`
}

// LocalsList returns every local guest who has at least one recorded login
// event, for the Admin Dashboard's "Locals" dropdown. SuperAdmin only, same
// check as the other analytics endpoints in this package.
//
//encore:api auth method=GET path=/analytics/locals
func LocalsList(ctx context.Context) (*LocalsListResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT u.id, u.email, COALESCE(u.area, ''), count(e.id)
		FROM users u
		JOIN events e ON e.user_id = u.id AND e.event_type = 'login' AND e.actor_type = 'local_guest'
		WHERE u.role = 'LocalGuest'
		GROUP BY u.id, u.email, u.area
		ORDER BY u.email ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	locals := []LocalGuestOption{}
	for rows.Next() {
		var l LocalGuestOption
		if err := rows.Scan(&l.UserID, &l.Email, &l.Area, &l.TotalLogins); err != nil {
			return nil, err
		}
		locals = append(locals, l)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &LocalsListResponse{Locals: locals}, nil
}

type LocalLoginTotalsRequest struct {
	// Period is "daily" | "weekly" | "monthly" | "yearly". Defaults to "daily"
	// for any other/blank value.
	Period string `query:"period"`
	// UserID, when > 0, filters to a single local guest (from LocalsList).
	// 0 (or omitted) returns totals across every local guest.
	UserID int64 `query:"userId"`
}

type LocalLoginPoint struct {
	// Period is the bucket label: "2026-09-27" (daily/weekly) or "2026-09"
	// (monthly) or "2026" (yearly).
	Period string `json:"period"`
	Count  int    `json:"count"`
}

type LocalLoginTotalsResponse struct {
	Points []LocalLoginPoint `json:"points"`
}

// LocalLoginTotals powers the Daily/Weekly/Monthly/Yearly selector next to
// the Locals dropdown. SuperAdmin only.
//
//encore:api auth method=GET path=/analytics/locals/logins
func LocalLoginTotals(ctx context.Context, req *LocalLoginTotalsRequest) (*LocalLoginTotalsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

	// trunc/format are chosen from this fixed switch, never taken directly
	// from the request, so building the query string with them is safe.
	trunc := "day"
	format := "YYYY-MM-DD"
	switch strings.ToLower(strings.TrimSpace(req.Period)) {
	case "weekly":
		trunc, format = "week", "YYYY-MM-DD"
	case "monthly":
		trunc, format = "month", "YYYY-MM"
	case "yearly":
		trunc, format = "year", "YYYY"
	default:
		trunc, format = "day", "YYYY-MM-DD"
	}

	query := `
		SELECT to_char(date_trunc('` + trunc + `', e.created_at), '` + format + `') AS period, count(*)
		FROM events e
		WHERE e.event_type = 'login' AND e.actor_type = 'local_guest'`
	args := []interface{}{}
	if req.UserID > 0 {
		query += ` AND e.user_id = $1`
		args = append(args, req.UserID)
	}
	query += ` GROUP BY period ORDER BY period ASC`

	rows, err := appdb.SQLDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := []LocalLoginPoint{}
	for rows.Next() {
		var p LocalLoginPoint
		if err := rows.Scan(&p.Period, &p.Count); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &LocalLoginTotalsResponse{Points: points}, nil
}
