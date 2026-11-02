// This file adds the "Partners" analytics used by the Admin Dashboard's
// Analytics page. It mirrors the "Locals" (locals.go) and "Holiday Guests"
// (holidayguests.go) analytics exactly, but for Partners signing into their
// Partner Portal: a dropdown listing every partner that has signed in, and a
// totals query (Daily / Weekly / Monthly / Yearly) for sign-ins, either for one
// selected partner or across all of them.
//
// A Partner login creates a fresh users row (role = 'Partner') carrying the
// partner's entity_type ('restaurant' | 'service' | 'retail' | 'nonprofit' |
// 'attraction') and entity_id, plus a sessions row (see auth.issueSession).
// Sign-ins are therefore read from the sessions table, joined to users where
// role = 'Partner', grouped by the partner entity, and the business name is
// resolved from that entity's own table.
package analytics

import (
	"context"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// partnersSince ignores any sign-ins before this moment. Set early enough to
// include the full partner history to date (platform launched in 2026).
const partnersSince = "2026-01-01T00:00:00+02:00"

// partnerNameExpr resolves a partner's business name from its own table using
// u.entity_type / u.entity_id. The entity_type set is a fixed whitelist baked
// into the SQL (never taken from the request), so this is injection-safe.
const partnerNameExpr = `COALESCE((CASE u.entity_type
	WHEN 'restaurant' THEN (SELECT name FROM restaurants WHERE id = u.entity_id)
	WHEN 'service'    THEN (SELECT name FROM services    WHERE id = u.entity_id)
	WHEN 'retail'     THEN (SELECT name FROM retail      WHERE id = u.entity_id)
	WHEN 'nonprofit'  THEN (SELECT name FROM nonprofits  WHERE id = u.entity_id)
	WHEN 'attraction' THEN (SELECT name FROM attractions WHERE id = u.entity_id)
	END), '')`

// PartnerOption is one entry in the "Partners" dropdown.
type PartnerOption struct {
	EntityType  string `json:"entityType"`
	EntityID    int64  `json:"entityId"`
	Name        string `json:"name"`
	Category    string `json:"category"` // human label for entity_type
	TotalLogins int    `json:"totalLogins"`
}

type PartnersListResponse struct {
	Partners []PartnerOption `json:"partners"`
}

// partnerCategoryLabel turns an entity_type into the label shown in the UI.
func partnerCategoryLabel(entityType string) string {
	switch entityType {
	case "restaurant":
		return "Restaurant/Takeaway"
	case "service":
		return "Business/Service"
	case "retail":
		return "Retail"
	case "nonprofit":
		return "NPO/PBO"
	case "attraction":
		return "Attraction/Activity"
	default:
		return entityType
	}
}

// PartnersList returns every partner that has signed in since partnersSince,
// for the Admin Dashboard's "Partners" dropdown. SuperAdmin only.
//
//encore:api auth method=GET path=/analytics/partners
func PartnersList(ctx context.Context) (*PartnersListResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT u.entity_type, u.entity_id, `+partnerNameExpr+` AS name, count(s.token)
		FROM users u
		JOIN sessions s ON s.user_id = u.id
		WHERE u.role = 'Partner' AND u.entity_id IS NOT NULL
		  AND s.created_at >= $1::timestamptz
		GROUP BY u.entity_type, u.entity_id
		ORDER BY name ASC`, partnersSince)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	partners := []PartnerOption{}
	for rows.Next() {
		var p PartnerOption
		if err := rows.Scan(&p.EntityType, &p.EntityID, &p.Name, &p.TotalLogins); err != nil {
			return nil, err
		}
		p.Category = partnerCategoryLabel(p.EntityType)
		partners = append(partners, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &PartnersListResponse{Partners: partners}, nil
}

type PartnerLoginTotalsRequest struct {
	// Period is "daily" | "weekly" | "monthly" | "yearly". Defaults to "daily".
	Period string `query:"period"`
	// EntityType + EntityID, when EntityID > 0, filter to a single partner.
	EntityType string `query:"entityType"`
	EntityID   int64  `query:"entityId"`
}

type PartnerLoginPoint struct {
	Period string `json:"period"`
	Count  int    `json:"count"`
}

type PartnerLoginTotalsResponse struct {
	Points []PartnerLoginPoint `json:"points"`
}

// PartnerLoginTotals powers the Daily/Weekly/Monthly/Yearly selector next to
// the Partners dropdown. SuperAdmin only. Buckets are cut in South African time.
//
//encore:api auth method=GET path=/analytics/partners/logins
func PartnerLoginTotals(ctx context.Context, req *PartnerLoginTotalsRequest) (*PartnerLoginTotalsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

	// trunc/format/step come from this fixed switch, never from the request.
	trunc, format, step := "day", "YYYY-MM-DD", "1 day"
	switch strings.ToLower(strings.TrimSpace(req.Period)) {
	case "weekly":
		trunc, format, step = "week", "YYYY-MM-DD", "1 week"
	case "monthly":
		trunc, format, step = "month", "YYYY-MM", "1 month"
	case "yearly":
		trunc, format, step = "year", "YYYY", "1 year"
	}

	partnerFilter := ""
	args := []interface{}{partnersSince}
	if req.EntityID > 0 && strings.TrimSpace(req.EntityType) != "" {
		partnerFilter = " AND u.entity_type = $2 AND u.entity_id = $3"
		args = append(args, strings.TrimSpace(req.EntityType), req.EntityID)
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
			WHERE u.role = 'Partner' AND s.created_at >= $1::timestamptz` + partnerFilter + `
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

	points := []PartnerLoginPoint{}
	for rows.Next() {
		var p PartnerLoginPoint
		if err := rows.Scan(&p.Period, &p.Count); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &PartnerLoginTotalsResponse{Points: points}, nil
}

// --- Per-bucket sign-in detail (which partners signed in) --------------------

type PartnerSigninsRequest struct {
	Period     string `query:"period"`
	PeriodKey  string `query:"periodKey"`
	EntityType string `query:"entityType"`
	EntityID   int64  `query:"entityId"`
}

type PartnerSignin struct {
	Name       string `json:"name"`
	Category   string `json:"category"`
	SignedInAt string `json:"signedInAt"` // "YYYY-MM-DD HH:MM" in South African time
}

type PartnerSigninsResponse struct {
	Signins []PartnerSignin `json:"signins"`
}

// PartnerSignins lists the individual partner sign-ins that fall inside one
// clicked bucket. SuperAdmin only. Bucketing mirrors PartnerLoginTotals.
//
//encore:api auth method=GET path=/analytics/partners/signins
func PartnerSignins(ctx context.Context, req *PartnerSigninsRequest) (*PartnerSigninsResponse, error) {
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
		SELECT ` + partnerNameExpr + ` AS name, u.entity_type,
		       to_char(s.created_at AT TIME ZONE 'Africa/Johannesburg', 'YYYY-MM-DD HH24:MI') AS signed_in_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE u.role = 'Partner' AND u.entity_id IS NOT NULL AND s.created_at >= $1::timestamptz
		  AND to_char(date_trunc('` + trunc + `', s.created_at AT TIME ZONE 'Africa/Johannesburg'), '` + format + `') = $2`
	args := []interface{}{partnersSince, strings.TrimSpace(req.PeriodKey)}
	if req.EntityID > 0 && strings.TrimSpace(req.EntityType) != "" {
		query += ` AND u.entity_type = $3 AND u.entity_id = $4`
		args = append(args, strings.TrimSpace(req.EntityType), req.EntityID)
	}
	query += ` ORDER BY s.created_at ASC`

	rows, err := appdb.SQLDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	signins := []PartnerSignin{}
	for rows.Next() {
		var s PartnerSignin
		var entityType string
		if err := rows.Scan(&s.Name, &entityType, &s.SignedInAt); err != nil {
			return nil, err
		}
		s.Category = partnerCategoryLabel(entityType)
		signins = append(signins, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &PartnerSigninsResponse{Signins: signins}, nil
}
