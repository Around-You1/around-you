package analytics

import (
	"context"
	"fmt"
	"time"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// MonthPoint is one month in the business trend.
type MonthPoint struct {
	Month         string `json:"month"` // YYYY-MM
	NewPartners   int    `json:"newPartners"`
	Churned       int    `json:"churned"`
	InvoicedCents int    `json:"invoicedCents"` // total invoiced (realised revenue) that month
	Invoices      int    `json:"invoices"`
}

// BusinessMetricsResponse is the buyer/investor-facing snapshot of the business.
// All money is in ZAR cents.
type BusinessMetricsResponse struct {
	MrrCents         int     `json:"mrrCents"`         // monthly recurring revenue (active subscriptions)
	ActivePartners   int     `json:"activePartners"`   // paying/active partners
	ArpuCents        int     `json:"arpuCents"`        // MRR / active partners
	NewThisMonth     int     `json:"newThisMonth"`     // subscriptions started this month
	ChurnedThisMonth int     `json:"churnedThisMonth"` // subscriptions cancelled this month
	ChurnRatePct     float64 `json:"churnRatePct"`     // monthly churn %
	LtvCents         int     `json:"ltvCents"`         // ARPU / churn fraction (0 if no churn yet)

	ActiveReps  int `json:"activeReps"`
	TeamLeaders int `json:"teamLeaders"`

	BookingGmvCentsMonth     int `json:"bookingGmvCentsMonth"`     // total booking value this month
	BookingRevenueCentsMonth int `json:"bookingRevenueCentsMonth"` // platform 10% take this month

	TierMix map[string]int `json:"tierMix"` // active partners by plan/tier
	Months  []MonthPoint   `json:"months"`  // last 12 months, oldest first
}

// BusinessMetrics is SuperAdmin-only — the headline numbers a buyer values,
// assembled from the subscription, invoice, commission, and booking tables.
//
//encore:api auth method=GET path=/analytics/business
func BusinessMetrics(ctx context.Context) (*BusinessMetricsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view business metrics"}
	}

	resp := &BusinessMetricsResponse{TierMix: map[string]int{}}

	// 1) Active subscriptions → MRR, active count, tier mix.
	subRows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT plan, COALESCE(tier, 0), monthly_cents
		FROM partner_subscription WHERE status = 'Active'
		  AND `+appdb.NotTestRepSQL("lower(coalesce(rep_code,''))"))
	if err != nil {
		return nil, err
	}
	for subRows.Next() {
		var plan string
		var tier, monthly int
		if err := subRows.Scan(&plan, &tier, &monthly); err != nil {
			subRows.Close()
			return nil, err
		}
		resp.MrrCents += monthly
		resp.ActivePartners++
		key := "Booking"
		if plan != "booking" {
			key = fmt.Sprintf("Tier %d", tier)
		}
		resp.TierMix[key]++
	}
	subRows.Close()
	if err := subRows.Err(); err != nil {
		return nil, err
	}
	if resp.ActivePartners > 0 {
		resp.ArpuCents = resp.MrrCents / resp.ActivePartners
	}

	// 2) New & churned this month.
	if err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM partner_subscription
		WHERE date_trunc('month', started_at) = date_trunc('month', now())
		  AND `+appdb.NotTestRepSQL("lower(coalesce(rep_code,''))")).Scan(&resp.NewThisMonth); err != nil {
		return nil, err
	}
	if err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM partner_subscription
		WHERE cancelled_at IS NOT NULL
		  AND date_trunc('month', cancelled_at) = date_trunc('month', now())
		  AND `+appdb.NotTestRepSQL("lower(coalesce(rep_code,''))")).Scan(&resp.ChurnedThisMonth); err != nil {
		return nil, err
	}
	if resp.ActivePartners > 0 {
		churnFraction := float64(resp.ChurnedThisMonth) / float64(resp.ActivePartners)
		resp.ChurnRatePct = churnFraction * 100
		if churnFraction > 0 {
			resp.LtvCents = int(float64(resp.ArpuCents) / churnFraction)
		}
	}

	// 3) Rep network.
	if err := appdb.SQLDB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM users WHERE role = 'Rep' AND COALESCE(rep_status,'Active') = 'Active'
		  AND `+appdb.NotTestRepSQL("lower(coalesce(rep_code,''))")).Scan(&resp.ActiveReps); err != nil {
		return nil, err
	}
	if err := appdb.SQLDB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM users WHERE role = 'Rep' AND is_team_leader = true
		  AND `+appdb.NotTestRepSQL("lower(coalesce(rep_code,''))")).Scan(&resp.TeamLeaders); err != nil {
		return nil, err
	}

	// 4) Booking GMV + platform take this month (booking money is float Rands).
	if err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT COALESCE(ROUND(SUM(total) * 100), 0)::bigint,
		       COALESCE(ROUND(SUM(commission) * 100), 0)::bigint
		FROM bookings WHERE status <> 'cancelled'
		  AND date_trunc('month', created_at) = date_trunc('month', now())
		  AND (entity_type, entity_id) NOT IN `+appdb.TestRepEntitiesSubquery()).Scan(
		&resp.BookingGmvCentsMonth, &resp.BookingRevenueCentsMonth); err != nil {
		return nil, err
	}

	// 5) 12-month trend: new, churned, invoiced revenue per month.
	newByMonth := map[string]int{}
	churnByMonth := map[string]int{}
	invCentsByMonth := map[string]int{}
	invCountByMonth := map[string]int{}

	if err := scanMonthCount(ctx,
		`SELECT to_char(started_at, 'YYYY-MM'), COUNT(*) FROM partner_subscription
		 WHERE `+appdb.NotTestRepSQL("lower(coalesce(rep_code,''))")+` GROUP BY 1`, newByMonth); err != nil {
		return nil, err
	}
	if err := scanMonthCount(ctx,
		`SELECT to_char(cancelled_at, 'YYYY-MM'), COUNT(*) FROM partner_subscription
		 WHERE cancelled_at IS NOT NULL AND `+appdb.NotTestRepSQL("lower(coalesce(rep_code,''))")+` GROUP BY 1`, churnByMonth); err != nil {
		return nil, err
	}
	invRows, err := appdb.SQLDB.QueryContext(ctx,
		`SELECT to_char(issued_at, 'YYYY-MM'), COALESCE(SUM(total_cents),0), COUNT(*) FROM invoice
		 WHERE `+appdb.NotTestRepSQL("lower(coalesce(bill_rep_code,''))")+` GROUP BY 1`)
	if err != nil {
		return nil, err
	}
	for invRows.Next() {
		var m string
		var cents, cnt int
		if err := invRows.Scan(&m, &cents, &cnt); err != nil {
			invRows.Close()
			return nil, err
		}
		invCentsByMonth[m] = cents
		invCountByMonth[m] = cnt
	}
	invRows.Close()
	if err := invRows.Err(); err != nil {
		return nil, err
	}

	now := time.Now()
	for i := 11; i >= 0; i-- {
		key := now.AddDate(0, -i, 0).Format("2006-01")
		resp.Months = append(resp.Months, MonthPoint{
			Month:         key,
			NewPartners:   newByMonth[key],
			Churned:       churnByMonth[key],
			InvoicedCents: invCentsByMonth[key],
			Invoices:      invCountByMonth[key],
		})
	}

	return resp, nil
}

// scanMonthCount runs a "SELECT month, count ... GROUP BY month" query and fills dst.
func scanMonthCount(ctx context.Context, query string, dst map[string]int) error {
	rows, err := appdb.SQLDB.QueryContext(ctx, query)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var m string
		var c int
		if err := rows.Scan(&m, &c); err != nil {
			return err
		}
		dst[m] = c
	}
	return rows.Err()
}
