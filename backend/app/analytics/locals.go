// This file adds the "Locals" analytics used by the Admin Dashboard's
// Analytics page: a dropdown listing every local guest who has signed in,
// and a totals query (Daily / Weekly / Monthly / Yearly) for sign-ins,
// either for one selected local or across all of them.
//
// Sign-ins are read from the sessions table (one row is inserted per
// successful login, see auth.issueSession), joined to users where
// role = 'LocalGuest'. That means the full history since localsSince is
// available immediately — no backfill needed.
package analytics

import (
	"context"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// localsSince is when the Locals adverts went live. Sign-ins before this
// moment are ignored. Wednesday 23 September 2026, 00:00 South African time.
const localsSince = "2026-09-23T00:00:00+02:00"

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

// LocalsList returns every local guest who has signed in since localsSince,
// for the Admin Dashboard's "Locals" dropdown. SuperAdmin only.
//
//encore:api auth method=GET path=/analytics/locals
func LocalsList(ctx context.Context) (*LocalsListResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT u.id, u.email, COALESCE(u.area, ''), count(s.token)
		FROM users u
		JOIN sessions s ON s.user_id = u.id
		WHERE u.role = 'LocalGuest' AND s.created_at >= $1::timestamptz
		GROUP BY u.id, u.email, u.area
		ORDER BY u.email ASC`, localsSince)
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
// the Locals dropdown. SuperAdmin only. Buckets are cut in South African
// time so a late-evening sign-in lands on the correct local day.
//
//encore:api auth method=GET path=/analytics/locals/logins
func LocalLoginTotals(ctx context.Context, req *LocalLoginTotalsRequest) (*LocalLoginTotalsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

	// trunc/format/step are chosen from this fixed switch, never taken directly
	// from the request, so building the query string with them is safe.
	trunc := "day"
	format := "YYYY-MM-DD"
	step := "1 day"
	switch strings.ToLower(strings.TrimSpace(req.Period)) {
	case "weekly":
		trunc, format, step = "week", "YYYY-MM-DD", "1 week"
	case "monthly":
		trunc, format, step = "month", "YYYY-MM", "1 month"
	case "yearly":
		trunc, format, step = "year", "YYYY", "1 year"
	default:
		trunc, format, step = "day", "YYYY-MM-DD", "1 day"
	}

	// A continuous series of buckets from localsSince through *today* (SA
	// time) is generated and LEFT JOINed to the sign-in counts, so the chart
	// always runs up to the current day/week/month/year even when the most
	// recent buckets have no sign-ins yet (previously it stopped at the last
	// day that had data, e.g. yesterday).
	userFilter := ""
	args := []interface{}{localsSince}
	if req.UserID > 0 {
		userFilter = " AND u.id = $2"
		args = append(args, req.UserID)
	}
	query := `
		WITH buckets AS (
			SELECT generate_series(
				date_trunc('` + trunc + `', $1::timestamptz AT TIME ZONE 'Africa/Johannesburg'),
				date_trunc('` + trunc + `', now() AT TIME ZONE 'Africa/Johannesburg'),
				'` + step + `'::interval
			) AS b
		),
		counts AS (
			SELECT date_trunc('` + trunc + `', s.created_at AT TIME ZONE 'Africa/Johannesburg') AS b, count(*) AS c
			FROM sessions s
			JOIN users u ON u.id = s.user_id
			WHERE u.role = 'LocalGuest' AND s.created_at >= $1::timestamptz` + userFilter + `
			GROUP BY 1
		)
		SELECT to_char(buckets.b, '` + format + `') AS period, COALESCE(counts.c, 0) AS count
		FROM buckets
		LEFT JOIN counts ON counts.b = buckets.b
		ORDER BY buckets.b ASC`

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

// --- Per-bucket sign-in detail (who signed in) -------------------------------

type LocalSigninsRequest struct {
	// Period matches the totals selector: "daily" | "weekly" | "monthly" | "yearly".
	Period string `query:"period"`
	// PeriodKey is the bucket label the user clicked, exactly as returned by
	// LocalLoginTotals (e.g. "2026-10-03", "2026-10", "2026").
	PeriodKey string `query:"periodKey"`
	// UserID, when > 0, filters to a single local guest.
	UserID int64 `query:"userId"`
}

type LocalSignin struct {
	Email      string `json:"email"`
	Area       string `json:"area"`
	SignedInAt string `json:"signedInAt"` // "YYYY-MM-DD HH:MM" in South African time
}

type LocalSigninsResponse struct {
	Signins []LocalSignin `json:"signins"`
}

// LocalSignins lists the individual local-guest sign-ins that fall inside one
// clicked bucket, so an admin can see exactly which emails signed in that day
// (or week/month/year). SuperAdmin only. Bucketing mirrors LocalLoginTotals so
// the keys line up with the chart.
//
//encore:api auth method=GET path=/analytics/locals/signins
func LocalSignins(ctx context.Context, req *LocalSigninsRequest) (*LocalSigninsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

	// trunc/format come from this fixed switch, never from the request, so
	// interpolating them into the query is safe.
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
		SELECT u.email, COALESCE(u.area, ''),
		       to_char(s.created_at AT TIME ZONE 'Africa/Johannesburg', 'YYYY-MM-DD HH24:MI') AS signed_in_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE u.role = 'LocalGuest' AND s.created_at >= $1::timestamptz
		  AND to_char(date_trunc('` + trunc + `', s.created_at AT TIME ZONE 'Africa/Johannesburg'), '` + format + `') = $2`
	args := []interface{}{localsSince, strings.TrimSpace(req.PeriodKey)}
	if req.UserID > 0 {
		query += ` AND u.id = $3`
		args = append(args, req.UserID)
	}
	query += ` ORDER BY s.created_at ASC`

	rows, err := appdb.SQLDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	signins := []LocalSignin{}
	for rows.Next() {
		var s LocalSignin
		if err := rows.Scan(&s.Email, &s.Area, &s.SignedInAt); err != nil {
			return nil, err
		}
		signins = append(signins, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &LocalSigninsResponse{Signins: signins}, nil
}
