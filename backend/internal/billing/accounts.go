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

// CommissionRollup summarises the commission ledger for the accountant.
type CommissionRollup struct {
	TotalCents        int            `json:"totalCents"`
	TotalPaidCents    int            `json:"totalPaidCents"`
	TotalAccruedCents int            `json:"totalAccruedCents"`
	ByRep             []RepStatement `json:"byRep"`
}

// LoadCommissionRollup returns all-time commission totals per rep.
func LoadCommissionRollup(ctx context.Context) (*CommissionRollup, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT rep_code,
		       COALESCE(SUM(amount_cents) FILTER (WHERE type = 'own'), 0),
		       COALESCE(SUM(amount_cents) FILTER (WHERE type = 'override'), 0),
		       COALESCE(SUM(amount_cents), 0),
		       COALESCE(SUM(amount_cents) FILTER (WHERE status = 'Paid'), 0),
		       COALESCE(SUM(amount_cents) FILTER (WHERE status = 'Accrued'), 0)
		FROM commission
		GROUP BY rep_code
		ORDER BY SUM(amount_cents) DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	r := &CommissionRollup{ByRep: []RepStatement{}}
	for rows.Next() {
		var s RepStatement
		if err := rows.Scan(&s.RepCode, &s.OwnCents, &s.OverrideCents, &s.TotalCents, &s.PaidCents, &s.AccruedCents); err != nil {
			return nil, err
		}
		r.ByRep = append(r.ByRep, s)
		r.TotalCents += s.TotalCents
		r.TotalPaidCents += s.PaidCents
		r.TotalAccruedCents += s.AccruedCents
	}
	return r, rows.Err()
}

// BookingLedgerRow is one booking for the accountant's ledger. Money in cents.
type BookingLedgerRow struct {
	ID              int64  `json:"id"`
	EntityType      string `json:"entityType"`
	EntityName      string `json:"entityName"`
	CustomerName    string `json:"customerName"`
	BookingDate     string `json:"bookingDate"`
	TotalCents      int    `json:"totalCents"`
	CommissionCents int    `json:"commissionCents"`
	Status          string `json:"status"`
	CreatedAt       string `json:"createdAt"`
}

type BookingLedger struct {
	Rows                 []BookingLedgerRow `json:"rows"`
	Count                int                `json:"count"`
	TotalValueCents      int                `json:"totalValueCents"`      // non-cancelled booking value
	TotalCommissionCents int                `json:"totalCommissionCents"` // non-cancelled platform commission
}

// LoadBookingLedger returns the bookings ledger (recent 500) plus totals.
func LoadBookingLedger(ctx context.Context) (*BookingLedger, error) {
	l := &BookingLedger{Rows: []BookingLedgerRow{}}
	if err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT COUNT(*),
		       COALESCE(ROUND((SUM(total)      FILTER (WHERE status <> 'cancelled')) * 100), 0)::bigint,
		       COALESCE(ROUND((SUM(commission) FILTER (WHERE status <> 'cancelled')) * 100), 0)::bigint
		FROM bookings`).Scan(&l.Count, &l.TotalValueCents, &l.TotalCommissionCents); err != nil {
		return nil, err
	}

	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT id, entity_type, COALESCE(entity_name, ''), COALESCE(customer_name, ''),
		       COALESCE(booking_date, ''),
		       COALESCE(ROUND(total * 100), 0)::bigint,
		       COALESCE(ROUND(commission * 100), 0)::bigint,
		       COALESCE(status, ''),
		       to_char(created_at, 'YYYY-MM-DD')
		FROM bookings ORDER BY created_at DESC LIMIT 500`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var b BookingLedgerRow
		if err := rows.Scan(&b.ID, &b.EntityType, &b.EntityName, &b.CustomerName,
			&b.BookingDate, &b.TotalCents, &b.CommissionCents, &b.Status, &b.CreatedAt); err != nil {
			return nil, err
		}
		l.Rows = append(l.Rows, b)
	}
	return l, rows.Err()
}
