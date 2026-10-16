// This file adds the "Holiday Guests" analytics used by the Admin Dashboard's
// Analytics page. It mirrors the "Locals" analytics (see locals.go) exactly,
// but for Holiday Guests signing into an accommodation profile: a dropdown
// listing every accommodation that has had guest sign-ins, and a totals query
// (Daily / Weekly / Monthly / Yearly) for sign-ins, either for one selected
// accommodation or across all of them.
//
// A Holiday Guest login creates a fresh users row (role = 'Guest') tied to the
// accommodation they signed into (accommodation_id), plus a sessions row (see
// auth.issueSession). Sign-ins are therefore read from the sessions table,
// joined to users where role = 'Guest' and to accommodations for the name.
package analytics

import (
	"context"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// holidayGuestsSince ignores any sign-ins before this moment. Set early enough
// to include the full guest history to date (platform launched in 2026).
const holidayGuestsSince = "2026-01-01T00:00:00+02:00"

// HolidayAccommodationOption is one entry in the "Holiday Guests" dropdown.
type HolidayAccommodationOption struct {
	AccommodationID int64  `json:"accommodationId"`
	Name            string `json:"name"`
	TotalLogins     int    `json:"totalLogins"`
}

type HolidayGuestsListResponse struct {
	Accommodations []HolidayAccommodationOption `json:"accommodations"`
}

// HolidayGuestsList returns every accommodation that has had a guest sign in
// since holidayGuestsSince, for the Admin Dashboard's "Holiday Guests"
// dropdown. SuperAdmin only.
//
//encore:api auth method=GET path=/analytics/holiday-guests
func HolidayGuestsList(ctx context.Context) (*HolidayGuestsListResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT a.id, COALESCE(a.name, ''), count(s.token)
		FROM users u
		JOIN sessions s ON s.user_id = u.id
		JOIN accommodations a ON a.id = u.accommodation_id
		WHERE u.role = 'Guest' AND s.created_at >= $1::timestamptz
		GROUP BY a.id, a.name
		ORDER BY a.name ASC`, holidayGuestsSince)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accs := []HolidayAccommodationOption{}
	for rows.Next() {
		var a HolidayAccommodationOption
		if err := rows.Scan(&a.AccommodationID, &a.Name, &a.TotalLogins); err != nil {
			return nil, err
		}
		accs = append(accs, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &HolidayGuestsListResponse{Accommodations: accs}, nil
}

type HolidayGuestLoginTotalsRequest struct {
	// Period is "daily" | "weekly" | "monthly" | "yearly". Defaults to "daily".
	Period string `query:"period"`
	// AccommodationID, when > 0, filters to a single accommodation.
	AccommodationID int64 `query:"accommodationId"`
}

type HolidayGuestLoginPoint struct {
	Period string `json:"period"`
	Count  int    `json:"count"`
}

type HolidayGuestLoginTotalsResponse struct {
	Points []HolidayGuestLoginPoint `json:"points"`
}

// HolidayGuestLoginTotals powers the Daily/Weekly/Monthly/Yearly selector next
// to the Holiday Guests dropdown. SuperAdmin only. Buckets are cut in South
// African time.
//
//encore:api auth method=GET path=/analytics/holiday-guests/logins
func HolidayGuestLoginTotals(ctx context.Context, req *HolidayGuestLoginTotalsRequest) (*HolidayGuestLoginTotalsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

	// trunc/format come from this fixed switch, never from the request.
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
		SELECT to_char(date_trunc('` + trunc + `', s.created_at AT TIME ZONE 'Africa/Johannesburg'), '` + format + `') AS period, count(*)
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE u.role = 'Guest' AND s.created_at >= $1::timestamptz`
	args := []interface{}{holidayGuestsSince}
	if req.AccommodationID > 0 {
		query += ` AND u.accommodation_id = $2`
		args = append(args, req.AccommodationID)
	}
	query += ` GROUP BY period ORDER BY period ASC`

	rows, err := appdb.SQLDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := []HolidayGuestLoginPoint{}
	for rows.Next() {
		var p HolidayGuestLoginPoint
		if err := rows.Scan(&p.Period, &p.Count); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &HolidayGuestLoginTotalsResponse{Points: points}, nil
}

type HolidayGuestSigninsRequest struct {
	Period          string `query:"period"`
	PeriodKey       string `query:"periodKey"`
	AccommodationID int64  `query:"accommodationId"`
}

type HolidayGuestSignin struct {
	Accommodation string `json:"accommodation"`
	SignedInAt    string `json:"signedInAt"` // "YYYY-MM-DD HH:MM" in South African time
}

type HolidayGuestSigninsResponse struct {
	Signins []HolidayGuestSignin `json:"signins"`
}

// HolidayGuestSignins lists the individual guest sign-ins that fall inside one
// clicked bucket. SuperAdmin only. Bucketing mirrors HolidayGuestLoginTotals.
//
//encore:api auth method=GET path=/analytics/holiday-guests/signins
func HolidayGuestSignins(ctx context.Context, req *HolidayGuestSigninsRequest) (*HolidayGuestSigninsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

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
		SELECT COALESCE(a.name, ''),
		       to_char(s.created_at AT TIME ZONE 'Africa/Johannesburg', 'YYYY-MM-DD HH24:MI') AS signed_in_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		JOIN accommodations a ON a.id = u.accommodation_id
		WHERE u.role = 'Guest' AND s.created_at >= $1::timestamptz
		  AND to_char(date_trunc('` + trunc + `', s.created_at AT TIME ZONE 'Africa/Johannesburg'), '` + format + `') = $2`
	args := []interface{}{holidayGuestsSince, strings.TrimSpace(req.PeriodKey)}
	if req.AccommodationID > 0 {
		query += ` AND u.accommodation_id = $3`
		args = append(args, req.AccommodationID)
	}
	query += ` ORDER BY s.created_at ASC`

	rows, err := appdb.SQLDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	signins := []HolidayGuestSignin{}
	for rows.Next() {
		var s HolidayGuestSignin
		if err := rows.Scan(&s.Accommodation, &s.SignedInAt); err != nil {
			return nil, err
		}
		signins = append(signins, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &HolidayGuestSigninsResponse{Signins: signins}, nil
}
