package analytics

import (
	"context"
	"time"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

type MonthCount struct {
	Month string `json:"month"`
	Count int    `json:"count"`
}

type SearchCount struct {
	Term  string `json:"term"`
	Count int    `json:"count"`
}

type EventsSummaryResponse struct {
	ByTypeThisMonth map[string]int `json:"byTypeThisMonth"`
	QrScanMonths    []MonthCount   `json:"qrScanMonths"` // last 12 months, oldest first
	TopSearches     []SearchCount  `json:"topSearches"`  // this month, by term
}

// EventsSummary is SuperAdmin-only — behavioural-event counts. Right now that's
// QR scans (this month, by type, and a 12-month trend); as more event types are
// instrumented (logins, searches, listing views) they appear here automatically.
//
//encore:api auth method=GET path=/analytics/events
func EventsSummary(ctx context.Context) (*EventsSummaryResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view analytics"}
	}

	resp := &EventsSummaryResponse{ByTypeThisMonth: map[string]int{}}

	// Counts by type, this month.
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT event_type, COUNT(*)
		FROM events
		WHERE date_trunc('month', created_at) = date_trunc('month', now())
		GROUP BY 1`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var t string
		var c int
		if err := rows.Scan(&t, &c); err != nil {
			rows.Close()
			return nil, err
		}
		resp.ByTypeThisMonth[t] = c
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// QR-scan 12-month trend (reuses the helper from business.go).
	scanByMonth := map[string]int{}
	if err := scanMonthCount(ctx,
		`SELECT to_char(created_at, 'YYYY-MM'), COUNT(*) FROM events WHERE event_type = 'qr_scan' GROUP BY 1`,
		scanByMonth); err != nil {
		return nil, err
	}
	now := time.Now()
	for i := 11; i >= 0; i-- {
		key := now.AddDate(0, -i, 0).Format("2006-01")
		resp.QrScanMonths = append(resp.QrScanMonths, MonthCount{Month: key, Count: scanByMonth[key]})
	}

	// Top searches this month (by term).
	sr, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT lower(search_term), COUNT(*)
		FROM events
		WHERE event_type IN ('search', 'search_zero_result')
		  AND search_term IS NOT NULL AND search_term <> ''
		  AND date_trunc('month', created_at) = date_trunc('month', now())
		GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 15`)
	if err != nil {
		return nil, err
	}
	for sr.Next() {
		var sc SearchCount
		if err := sr.Scan(&sc.Term, &sc.Count); err != nil {
			sr.Close()
			return nil, err
		}
		resp.TopSearches = append(resp.TopSearches, sc)
	}
	sr.Close()
	if err := sr.Err(); err != nil {
		return nil, err
	}

	return resp, nil
}

type ListingViewsRequest struct {
	EntityType string `query:"entityType"`
	EntityID   int64  `query:"entityId"`
}

type ListingViewsResponse struct {
	ThisMonth int `json:"thisMonth"`
	AllTime   int `json:"allTime"`
}

// ListingViews returns how many times a partner's listing has been viewed (this
// month and all-time). Any signed-in caller may read it — a partner sees their
// own ROI number; counts are not sensitive.
//
//encore:api auth method=GET path=/analytics/listing-views
func ListingViews(ctx context.Context, req *ListingViewsRequest) (*ListingViewsResponse, error) {
	if data := auth.FromContext(ctx); data == nil || data.User == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "sign in required"}
	}
	if req.EntityType == "" || req.EntityID == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "entityType and entityId are required"}
	}
	resp := &ListingViewsResponse{}
	if err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT
		  COALESCE(COUNT(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', now())), 0),
		  COUNT(*)
		FROM events
		WHERE event_type = 'listing_view' AND entity_type = $1 AND entity_id = $2`,
		req.EntityType, req.EntityID,
	).Scan(&resp.ThisMonth, &resp.AllTime); err != nil {
		return nil, err
	}
	return resp, nil
}
