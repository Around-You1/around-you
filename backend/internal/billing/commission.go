package billing

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"backend_encore/internal/appdb"
)

// Commission mirrors a commission-ledger row for read APIs.
type Commission struct {
	ID          int64  `json:"id"`
	RepCode     string `json:"repCode"`
	Type        string `json:"type"` // "own" | "override"
	SourceRepCode string `json:"sourceRepCode"`
	PartnerType string `json:"partnerType"`
	PartnerID   int64  `json:"partnerId"`
	InvoiceID   int64  `json:"invoiceId"`
	PeriodStart string `json:"periodStart"`
	BaseCents   int    `json:"baseCents"`
	RateBps     int    `json:"rateBps"`
	AmountCents int    `json:"amountCents"`
	Status      string `json:"status"`
}

// accrueCommissions records the rep commissions for a freshly-issued invoice:
//   - the signing rep earns 30% of the full amount the partner paid;
//   - that rep's upline (Team Leader), if any, earns an extra 10%.
// Idempotent per (invoice, rep, type) via the unique constraint.
func accrueCommissions(ctx context.Context, invoiceID int64, partnerType string, partnerID int64, repCode string, totalCents int, periodStart time.Time) error {
	repCode = strings.TrimSpace(repCode)
	if repCode == "" || totalCents <= 0 {
		return nil // no signing rep or nothing billed → nothing to accrue
	}

	own := totalCents * 30 / 100
	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO commission
		  (rep_code, type, source_partner_type, source_partner_id, invoice_id, period_start, base_cents, rate_bps, amount_cents)
		VALUES ($1, 'own', $2, $3, $4, $5, $6, 3000, $7)
		ON CONFLICT (invoice_id, rep_code, type) DO NOTHING`,
		repCode, partnerType, partnerID, invoiceID, periodStart, totalCents, own,
	); err != nil {
		return err
	}

	var upline sql.NullString
	err := appdb.SQLDB.QueryRowContext(ctx,
		`SELECT upline_rep_code FROM users WHERE role = 'Rep' AND lower(rep_code) = lower($1)`, repCode,
	).Scan(&upline)
	if err != nil && err != sql.ErrNoRows {
		return err
	}
	if upline.Valid && strings.TrimSpace(upline.String) != "" {
		override := totalCents * 10 / 100
		if _, err := appdb.SQLDB.ExecContext(ctx, `
			INSERT INTO commission
			  (rep_code, type, source_partner_type, source_partner_id, source_rep_code, invoice_id, period_start, base_cents, rate_bps, amount_cents)
			VALUES ($1, 'override', $2, $3, $4, $5, $6, $7, 1000, $8)
			ON CONFLICT (invoice_id, rep_code, type) DO NOTHING`,
			strings.TrimSpace(upline.String), partnerType, partnerID, repCode, invoiceID, periodStart, totalCents, override,
		); err != nil {
			return err
		}
	}
	return nil
}

// ListCommissions returns the ledger newest-first — powers the admin view.
func ListCommissions(ctx context.Context) ([]Commission, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT id, rep_code, type, COALESCE(source_rep_code,''),
		       COALESCE(source_partner_type,''), COALESCE(source_partner_id,0),
		       COALESCE(invoice_id,0), COALESCE(to_char(period_start,'YYYY-MM-DD'),''),
		       base_cents, rate_bps, amount_cents, status
		FROM commission ORDER BY created_at DESC, id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Commission{}
	for rows.Next() {
		var c Commission
		if err := rows.Scan(&c.ID, &c.RepCode, &c.Type, &c.SourceRepCode,
			&c.PartnerType, &c.PartnerID, &c.InvoiceID, &c.PeriodStart,
			&c.BaseCents, &c.RateBps, &c.AmountCents, &c.Status); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
