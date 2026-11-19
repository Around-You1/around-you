// This file adds the "SuperAdmins" analytics used by the Admin Dashboard's
// Analytics page: a dropdown listing every SuperAdmin who has signed in, and a
// totals query (Daily / Weekly / Monthly / Yearly) for sign-ins, either for one
// selected SuperAdmin or across all of them. Mirrors the Locals view.
//
// Sign-ins are read from the sessions table (one row per successful login, see
// auth.issueSession), joined to users where role = 'SuperAdmin'.
package analytics

import (
	"context"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// superAdminsSince — SuperAdmin accounts exist from platform launch.
const superAdminsSince = "2026-01-01T00:00:00+02:00"

// SuperAdminOption is one entry in the "SuperAdmins" dropdown.
type SuperAdminOption struct {
	UserID      int64  `json:"userId"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	TotalLogins int    `json:"totalLogins"`
}

type SuperAdminsListResponse struct {
	SuperAdmins []SuperAdminOption `json:"superAdmins"`
}

// SuperAdminsList returns every SuperAdmin who has signed in since
// superAdminsSince, for the Admin Dashboard's "SuperAdmins" dropdown.
//
//encore:api auth method=GET path=/analytics/superadmins
func SuperAdminsList(ctx context.Context) (*SuperAdminsListResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT u.id, u.email, COALESCE(u.full_name, ''), count(s.token)
		FROM users u
		JOIN sessions s ON s.user_id = u.id
		WHERE u.role = 'SuperAdmin' AND s.created_at >= $1::timestamptz
		GROUP BY u.id, u.email, u.full_name
		ORDER BY u.email ASC`, superAdminsSince)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []SuperAdminOption{}
	for rows.Next() {
		var o SuperAdminOption
		if err := rows.Scan(&o.UserID, &o.Email, &o.Name, &o.TotalLogins); err != nil {
			return nil, err
		}
		list = append(list, o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &SuperAdminsListResponse{SuperAdmins: list}, nil
}

type SuperAdminLoginTotalsRequest struct {
	Period string `query:"period"`
	UserID int64  `query:"userId"`
}
type SuperAdminLoginPoint struct {
	Period string `json:"period"`
	Count  int    `json:"count"`
}
type SuperAdminLoginTotalsResponse struct {
	Points []SuperAdminLoginPoint `json:"points"`
}

// SuperAdminLoginTotals powers the Daily/Weekly/Monthly/Yearly selector next to
// the SuperAdmins dropdown. Buckets are cut in South African time.
//
//encore:api auth method=GET path=/analytics/superadmins/logins
func SuperAdminLoginTotals(ctx context.Context, req *SuperAdminLoginTotalsRequest) (*SuperAdminLoginTotalsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}
	trunc, format, step := "day", "YYYY-MM-DD", "1 day"
	switch strings.ToLower(strings.TrimSpace(req.Period)) {
	case "weekly":
		trunc, format, step = "week", "YYYY-MM-DD", "1 week"
	case "monthly":
		trunc, format, step = "month", "YYYY-MM", "1 month"
	case "yearly":
		trunc, format, step = "year", "YYYY", "1 year"
	}
	userFilter := ""
	args := []interface{}{superAdminsSince}
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
			WHERE u.role = 'SuperAdmin' AND s.created_at >= $1::timestamptz` + userFilter + `
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
	points := []SuperAdminLoginPoint{}
	for rows.Next() {
		var p SuperAdminLoginPoint
		if err := rows.Scan(&p.Period, &p.Count); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &SuperAdminLoginTotalsResponse{Points: points}, nil
}

type SuperAdminSigninsRequest struct {
	Period    string `query:"period"`
	PeriodKey string `query:"periodKey"`
	UserID    int64  `query:"userId"`
}
type SuperAdminSignin struct {
	Email      string `json:"email"`
	Name       string `json:"name"`
	SignedInAt string `json:"signedInAt"`
}
type SuperAdminSigninsResponse struct {
	Signins []SuperAdminSignin `json:"signins"`
}

// SuperAdminSignins lists the individual SuperAdmin sign-ins inside one clicked
// bucket. Bucketing mirrors SuperAdminLoginTotals.
//
//encore:api auth method=GET path=/analytics/superadmins/signins
func SuperAdminSignins(ctx context.Context, req *SuperAdminSigninsRequest) (*SuperAdminSigninsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}
	trunc, format := "day", "YYYY-MM-DD"
	switch strings.ToLower(strings.TrimSpace(req.Period)) {
	case "weekly":
		trunc, format = "week", "YYYY-MM-DD"
	case "monthly":
		trunc, format = "month", "YYYY-MM"
	case "yearly":
		trunc, format = "year", "YYYY"
	}
	query := `
		SELECT u.email, COALESCE(u.full_name, ''),
		       to_char(s.created_at AT TIME ZONE 'Africa/Johannesburg', 'YYYY-MM-DD HH24:MI') AS signed_in_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE u.role = 'SuperAdmin' AND s.created_at >= $1::timestamptz
		  AND to_char(date_trunc('` + trunc + `', s.created_at AT TIME ZONE 'Africa/Johannesburg'), '` + format + `') = $2`
	args := []interface{}{superAdminsSince, strings.TrimSpace(req.PeriodKey)}
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
	signins := []SuperAdminSignin{}
	for rows.Next() {
		var s SuperAdminSignin
		if err := rows.Scan(&s.Email, &s.Name, &s.SignedInAt); err != nil {
			return nil, err
		}
		signins = append(signins, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &SuperAdminSigninsResponse{Signins: signins}, nil
}
