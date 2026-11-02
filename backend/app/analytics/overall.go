// This file adds the "Overall sign ins" analytics used by the Admin Dashboard's
// Analytics page: the same Daily / Weekly / Monthly / Yearly totals and
// per-bucket sign-in detail as the Locals / Holiday Guests / Partners views,
// but COMBINED across all three audiences — Accommodation Guests (role
// 'Guest'), Locals (role 'LocalGuest') and Partners (role 'Partner').
//
// Every successful login writes one sessions row (see auth.issueSession), so a
// single query over sessions joined to users gives the combined sign-in counts.
// An optional actorType filter narrows to one audience.
package analytics

import (
	"context"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// overallSince ignores any sign-ins before this moment — early enough to cover
// the full history of all three audiences (platform launched in 2026).
const overallSince = "2026-01-01T00:00:00+02:00"

// overallRoleIn turns an actorType query value into a safe SQL IN clause over
// users.role. The role values are a fixed whitelist chosen by this switch (never
// taken from the request), so interpolating them is injection-safe. An empty /
// unknown actorType means "all three audiences".
func overallRoleIn(actorType string) string {
	var roles []string
	switch strings.ToLower(strings.TrimSpace(actorType)) {
	case "guest", "holiday_guest", "accommodation":
		roles = []string{"Guest"}
	case "local", "local_guest":
		roles = []string{"LocalGuest"}
	case "partner":
		roles = []string{"Partner"}
	default:
		roles = []string{"Guest", "LocalGuest", "Partner"}
	}
	quoted := make([]string, len(roles))
	for i, r := range roles {
		quoted[i] = "'" + r + "'"
	}
	return "u.role IN (" + strings.Join(quoted, ",") + ")"
}

// --- Headline per-audience totals --------------------------------------------

type OverallSummaryResponse struct {
	AccommodationGuest int `json:"accommodationGuest"`
	Local              int `json:"local"`
	Partner            int `json:"partner"`
	Total              int `json:"total"`
}

// OverallSummary returns the total sign-ins per audience since overallSince, for
// the headline of the "Overall sign ins" section. SuperAdmin only.
//
//encore:api auth method=GET path=/analytics/overall
func OverallSummary(ctx context.Context) (*OverallSummaryResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

	var r OverallSummaryResponse
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT
			count(*) FILTER (WHERE u.role = 'Guest'),
			count(*) FILTER (WHERE u.role = 'LocalGuest'),
			count(*) FILTER (WHERE u.role = 'Partner'),
			count(*) FILTER (WHERE u.role IN ('Guest','LocalGuest','Partner'))
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.created_at >= $1::timestamptz`, overallSince,
	).Scan(&r.AccommodationGuest, &r.Local, &r.Partner, &r.Total)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// --- Daily/Weekly/Monthly/Yearly totals --------------------------------------

type OverallLoginTotalsRequest struct {
	// Period is "daily" | "weekly" | "monthly" | "yearly". Defaults to "daily".
	Period string `query:"period"`
	// ActorType, when set, filters to one audience: "guest" | "local" | "partner".
	// Empty returns the combined total across all three.
	ActorType string `query:"actorType"`
}

type OverallLoginPoint struct {
	Period string `json:"period"`
	Count  int    `json:"count"`
}

type OverallLoginTotalsResponse struct {
	Points []OverallLoginPoint `json:"points"`
}

// OverallLoginTotals powers the Daily/Weekly/Monthly/Yearly selector for the
// combined "Overall sign ins" chart. SuperAdmin only. Buckets are cut in South
// African time.
//
//encore:api auth method=GET path=/analytics/overall/logins
func OverallLoginTotals(ctx context.Context, req *OverallLoginTotalsRequest) (*OverallLoginTotalsResponse, error) {
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

	roleIn := overallRoleIn(req.ActorType)
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
			WHERE ` + roleIn + ` AND s.created_at >= $1::timestamptz
			GROUP BY 1
		)
		SELECT to_char(buckets.b, '` + format + `') AS period, COALESCE(counts.c, 0) AS count
		FROM buckets
		LEFT JOIN counts ON counts.b = buckets.b
		ORDER BY buckets.b ASC`

	rows, err := appdb.SQLDB.QueryContext(ctx, query, overallSince)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := []OverallLoginPoint{}
	for rows.Next() {
		var p OverallLoginPoint
		if err := rows.Scan(&p.Period, &p.Count); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &OverallLoginTotalsResponse{Points: points}, nil
}

// --- Per-bucket sign-in detail (who signed in, across all audiences) ---------

type OverallSigninsRequest struct {
	Period    string `query:"period"`
	PeriodKey string `query:"periodKey"`
	ActorType string `query:"actorType"`
}

type OverallSignin struct {
	Who        string `json:"who"`  // accommodation name / local email / partner name
	Type       string `json:"type"` // "Accommodation Guest" | "Local" | "Partner"
	SignedInAt string `json:"signedInAt"`
}

type OverallSigninsResponse struct {
	Signins []OverallSignin `json:"signins"`
}

// OverallSignins lists the individual sign-ins (across all three audiences, or
// one if filtered) that fall inside one clicked bucket. SuperAdmin only.
// Bucketing mirrors OverallLoginTotals.
//
//encore:api auth method=GET path=/analytics/overall/signins
func OverallSignins(ctx context.Context, req *OverallSigninsRequest) (*OverallSigninsResponse, error) {
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

	roleIn := overallRoleIn(req.ActorType)
	query := `
		SELECT
			CASE u.role
				WHEN 'Guest'      THEN COALESCE((SELECT name FROM accommodations WHERE id = u.accommodation_id), '')
				WHEN 'LocalGuest' THEN u.email
				WHEN 'Partner'    THEN ` + partnerNameExpr + `
				ELSE u.email
			END AS who,
			CASE u.role
				WHEN 'Guest'      THEN 'Accommodation Guest'
				WHEN 'LocalGuest' THEN 'Local'
				WHEN 'Partner'    THEN 'Partner'
				ELSE u.role
			END AS type,
			to_char(s.created_at AT TIME ZONE 'Africa/Johannesburg', 'YYYY-MM-DD HH24:MI') AS signed_in_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE ` + roleIn + ` AND s.created_at >= $1::timestamptz
		  AND to_char(date_trunc('` + trunc + `', s.created_at AT TIME ZONE 'Africa/Johannesburg'), '` + format + `') = $2
		ORDER BY s.created_at ASC`

	rows, err := appdb.SQLDB.QueryContext(ctx, query, overallSince, strings.TrimSpace(req.PeriodKey))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	signins := []OverallSignin{}
	for rows.Next() {
		var s OverallSignin
		if err := rows.Scan(&s.Who, &s.Type, &s.SignedInAt); err != nil {
			return nil, err
		}
		signins = append(signins, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &OverallSigninsResponse{Signins: signins}, nil
}
