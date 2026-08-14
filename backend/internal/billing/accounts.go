package billing

import (
	"context"

	"backend_encore/internal/appdb"
)

// AccountsSummary is the invoice roll-up shown in the Accountant portal.
type AccountsSummary struct {
	InvoiceCount       int `json:"invoiceCount"`
	TotalInvoicedCents int `json:"totalInvoicedCents"`
	TotalPaidCents     int `json:"totalPaidCents"`
	OutstandingCents   int `json:"outstandingCents"` // not Paid and not Void
	OverdueCount       int `json:"overdueCount"`     // outstanding and past due
	OverdueCents       int `json:"overdueCents"`
}

// LoadAccountsSummary aggregates invoice totals for the accountant view.
func LoadAccountsSummary(ctx context.Context) (*AccountsSummary, error) {
	s := &AccountsSummary{}
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT
		  COUNT(*),
		  COALESCE(SUM(total_cents), 0),
		  COALESCE(SUM(total_cents) FILTER (WHERE status = 'Paid'), 0),
		  COALESCE(SUM(total_cents) FILTER (WHERE status NOT IN ('Paid','Void')), 0),
		  COALESCE(COUNT(*) FILTER (WHERE status NOT IN ('Paid','Void') AND due_at IS NOT NULL AND due_at < current_date), 0),
		  COALESCE(SUM(total_cents) FILTER (WHERE status NOT IN ('Paid','Void') AND due_at IS NOT NULL AND due_at < current_date), 0)
		FROM invoice`).Scan(
		&s.InvoiceCount, &s.TotalInvoicedCents, &s.TotalPaidCents,
		&s.OutstandingCents, &s.OverdueCount, &s.OverdueCents,
	)
	if err != nil {
		return nil, err
	}
	return s, nil
}

// SetInvoiceStatus updates an invoice's status; marking Paid stamps paid_at, any
// other status clears it. Returns rows affected.
func SetInvoiceStatus(ctx context.Context, id int64, status string) (int64, error) {
	res, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE invoice
		SET status = $2,
		    paid_at = CASE WHEN $2 = 'Paid' THEN now() ELSE NULL END
		WHERE id = $1`, id, status)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
