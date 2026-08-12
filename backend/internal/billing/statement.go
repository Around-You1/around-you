package billing

import (
	"context"

	"backend_encore/internal/appdb"
)

// RepStatement is one rep's commission summary for a single month.
type RepStatement struct {
	RepCode       string `json:"repCode"`
	OwnCents      int    `json:"ownCents"`
	OverrideCents int    `json:"overrideCents"`
	TotalCents    int    `json:"totalCents"`
	PaidCents     int    `json:"paidCents"`
	AccruedCents  int    `json:"accruedCents"`
}

// MonthlyStatements summarises each rep's commissions for a month (period is
// "YYYY-MM", matched against each commission's period_start). Highest earner
// first.
func MonthlyStatements(ctx context.Context, period string) ([]RepStatement, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT rep_code,
		       COALESCE(SUM(amount_cents) FILTER (WHERE type = 'own'), 0),
		       COALESCE(SUM(amount_cents) FILTER (WHERE type = 'override'), 0),
		       COALESCE(SUM(amount_cents), 0),
		       COALESCE(SUM(amount_cents) FILTER (WHERE status = 'Paid'), 0),
		       COALESCE(SUM(amount_cents) FILTER (WHERE status = 'Accrued'), 0)
		FROM commission
		WHERE to_char(period_start, 'YYYY-MM') = $1
		GROUP BY rep_code
		ORDER BY SUM(amount_cents) DESC`, period)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []RepStatement{}
	for rows.Next() {
		var s RepStatement
		if err := rows.Scan(&s.RepCode, &s.OwnCents, &s.OverrideCents,
			&s.TotalCents, &s.PaidCents, &s.AccruedCents); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// MarkPeriodPaid marks a month's Accrued commissions as Paid — the payout step.
// If repCode is empty, all reps for the period are marked; otherwise just that
// rep. Returns how many ledger rows were updated.
func MarkPeriodPaid(ctx context.Context, period, repCode string) (int, error) {
	res, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE commission SET status = 'Paid'
		WHERE to_char(period_start, 'YYYY-MM') = $1
		  AND status = 'Accrued'
		  AND ($2 = '' OR lower(rep_code) = lower($2))`, period, repCode)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}
