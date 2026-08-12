package billing

import (
	"context"
	"fmt"

	"backend_encore/internal/appdb"
	"backend_encore/internal/mailer"
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

// EmailStatements emails each rep who has a rep_email their commission
// statement for the month, and returns how many were sent. Best-effort per rep
// (a missing email or a mail hiccup just skips that rep). Reps without an email
// remain viewable to the SuperAdmin in the Billing tab.
func EmailStatements(ctx context.Context, period string) (int, error) {
	stmts, err := MonthlyStatements(ctx, period)
	if err != nil {
		return 0, err
	}
	sent := 0
	for _, s := range stmts {
		var email, name string
		if err := appdb.SQLDB.QueryRowContext(ctx,
			`SELECT COALESCE(rep_email, ''), COALESCE(full_name, '') FROM users WHERE role = 'Rep' AND lower(rep_code) = lower($1)`,
			s.RepCode,
		).Scan(&email, &name); err != nil {
			continue
		}
		if email == "" {
			continue
		}
		_ = mailer.Send(email, "Your Around You commission statement — "+period, renderStatementHTML(name, s.RepCode, period, s))
		sent++
	}
	return sent, nil
}

func renderStatementHTML(name, repCode, period string, s RepStatement) string {
	return fmt.Sprintf(`
<div style="font-family:Arial,sans-serif;max-width:560px">
  <h2>Around You — Commission Statement</h2>
  <p>Hi %s (%s),</p>
  <p>Your commissions for %s:</p>
  <table style="width:100%%;border-collapse:collapse" cellpadding="6">
    <tr><td>Own (30%%)</td><td style="text-align:right">%s</td></tr>
    <tr><td>Team-leader override (10%%)</td><td style="text-align:right">%s</td></tr>
    <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>%s</strong></td></tr>
    <tr><td>Paid</td><td style="text-align:right">%s</td></tr>
    <tr><td>Still accrued</td><td style="text-align:right">%s</td></tr>
  </table>
</div>`, name, repCode, period, rands(s.OwnCents), rands(s.OverrideCents), rands(s.TotalCents), rands(s.PaidCents), rands(s.AccruedCents))
}
