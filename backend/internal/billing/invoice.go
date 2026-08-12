package billing

import (
	"context"
	"fmt"
	"log"
	"time"

	"backend_encore/internal/appdb"
	"backend_encore/internal/mailer"
)

// Invoice mirrors an invoice row for read APIs.
type Invoice struct {
	ID            int64  `json:"id"`
	InvoiceNumber string `json:"invoiceNumber"`
	PartnerType   string `json:"partnerType"`
	PartnerID     int64  `json:"partnerId"`
	BillName      string `json:"billName"`
	RepCode       string `json:"repCode"`
	PeriodStart   string `json:"periodStart"`
	PeriodEnd     string `json:"periodEnd"`
	TotalCents    int    `json:"totalCents"`
	Status        string `json:"status"`
	IssuedAt      string `json:"issuedAt"`
}

// partnerTable maps a partner_type to its table name. The set is a fixed
// whitelist, so using the result in SQL string-building is safe.
func partnerTable(partnerType string) string {
	switch partnerType {
	case "accommodation":
		return "accommodations"
	case "restaurant":
		return "restaurants"
	case "service":
		return "services"
	case "attraction":
		return "attractions"
	default:
		return ""
	}
}

// OnPartnerOnboarded is the single hook the partner Create handlers call: it
// ensures the billing subscription exists and issues the first invoice. Both
// steps are idempotent, so a re-save reconciles rather than duplicates.
func OnPartnerOnboarded(ctx context.Context, partnerType string, partnerID int64, accessLevel, guestType, repCode string) error {
	if err := EnsureSubscription(ctx, partnerType, partnerID, accessLevel, guestType, repCode); err != nil {
		return err
	}
	return IssueFirstInvoice(ctx, partnerType, partnerID)
}

// IssueFirstInvoice bills the current month for a freshly-onboarded partner.
// Idempotent per period via the invoice unique constraint.
func IssueFirstInvoice(ctx context.Context, partnerType string, partnerID int64) error {
	var subID, monthly int64
	var plan string
	var tier int
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, plan, monthly_cents, COALESCE(tier, 0)
		FROM partner_subscription
		WHERE partner_type = $1 AND partner_id = $2`,
		partnerType, partnerID,
	).Scan(&subID, &plan, &monthly, &tier)
	if err != nil {
		return err
	}
	start := time.Now()
	end := start.AddDate(0, 1, 0)
	due := start.AddDate(0, 0, 7)
	return GenerateInvoice(ctx, subID, partnerType, partnerID, plan, tier, int(monthly), start, end, due)
}

// GenerateInvoice creates one invoice (+ a line item) for a subscription's
// billing period and emails it. No-op if an invoice already exists for that
// (subscription, period_start) — the idempotency the monthly run relies on.
// subtotalCents is the fixed monthly amount; the monthly run adds any 10%
// booking portion for Booking partners on top (Phase 4).
func GenerateInvoice(ctx context.Context, subID int64, partnerType string, partnerID int64, plan string, tier, subtotalCents int, start, end, due time.Time) error {
	var exists bool
	if err := appdb.SQLDB.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM invoice WHERE subscription_id = $1 AND period_start = $2)`,
		subID, start,
	).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil // already billed this period
	}

	// Snapshot billing identity from the partner row (columns common to all
	// four partner tables).
	tbl := partnerTable(partnerType)
	if tbl == "" {
		return fmt.Errorf("billing: unknown partner type %q", partnerType)
	}
	var name, holding, reg, vat, repName, repCode, email string
	if err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT COALESCE(name,''), COALESCE(official_holding_company,''),
		       COALESCE(company_reg_number,''), COALESCE(company_vat_number,''),
		       COALESCE(official_rep_name,''), COALESCE(official_rep_code,''),
		       COALESCE(official_email,'')
		FROM `+tbl+` WHERE id = $1`, partnerID,
	).Scan(&name, &holding, &reg, &vat, &repName, &repCode, &email); err != nil {
		return err
	}

	var seq int64
	if err := appdb.SQLDB.QueryRowContext(ctx, `SELECT nextval('invoice_number_seq')`).Scan(&seq); err != nil {
		return err
	}
	number := fmt.Sprintf("AY-%d-%06d", start.Year(), seq)

	var invID int64
	if err := appdb.SQLDB.QueryRowContext(ctx, `
		INSERT INTO invoice
		  (invoice_number, subscription_id, partner_type, partner_id,
		   period_start, period_end, subtotal_cents, vat_cents, total_cents, status,
		   bill_name, bill_holding_company, bill_reg_number, bill_vat_number,
		   bill_rep_name, bill_rep_code, bill_email, due_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,0,$7,'Issued',$8,$9,$10,$11,$12,$13,$14,$15)
		RETURNING id`,
		number, subID, partnerType, partnerID, start, end, subtotalCents,
		name, holding, reg, vat, repName, repCode, email, due,
	).Scan(&invID); err != nil {
		return err
	}

	desc := lineDescription(plan, tier, start)
	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO invoice_line_item (invoice_id, description, qty, unit_cents, line_cents)
		VALUES ($1, $2, 1, $3, $3)`, invID, desc, subtotalCents); err != nil {
		return err
	}

	// Accrue rep commissions for this invoice (30% own + 10% upline override).
	if err := accrueCommissions(ctx, invID, partnerType, partnerID, repCode, subtotalCents, start); err != nil {
		log.Printf("commission accrual for invoice %s failed: %v", number, err)
	}

	// Best-effort email — never block on a mail hiccup.
	if email != "" {
		_ = mailer.Send(email, "Your Around You invoice "+number,
			renderInvoiceHTML(number, name, desc, subtotalCents, start, due))
	}
	return nil
}

func lineDescription(plan string, tier int, start time.Time) string {
	period := start.Format("January 2006")
	if plan == "booking" {
		return "Booking plan monthly fee — " + period
	}
	return fmt.Sprintf("Tier %d subscription — %s", tier, period)
}

func rands(cents int) string { return fmt.Sprintf("R%.2f", float64(cents)/100) }

func renderInvoiceHTML(number, name, desc string, cents int, start, due time.Time) string {
	return fmt.Sprintf(`
<div style="font-family:Arial,sans-serif;max-width:560px">
  <h2>Around You — Invoice %s</h2>
  <p>Hi %s,</p>
  <p>Here is your invoice for the period starting %s.</p>
  <table style="width:100%%;border-collapse:collapse" cellpadding="8">
    <tr><td style="border-bottom:1px solid #ddd">%s</td>
        <td style="border-bottom:1px solid #ddd;text-align:right">%s</td></tr>
    <tr><td style="text-align:right"><strong>Total</strong></td>
        <td style="text-align:right"><strong>%s</strong></td></tr>
  </table>
  <p>Due by %s.</p>
  <p style="color:#888;font-size:12px">Around You is not currently VAT-registered; no VAT has been charged.</p>
</div>`,
		number, name, start.Format("2 January 2006"), desc, rands(cents), rands(cents), due.Format("2 January 2006"))
}

// ListInvoices returns invoices newest-first — powers the admin billing view.
func ListInvoices(ctx context.Context) ([]Invoice, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT id, invoice_number, partner_type, partner_id,
		       COALESCE(bill_name,''), COALESCE(bill_rep_code,''),
		       to_char(period_start,'YYYY-MM-DD'), to_char(period_end,'YYYY-MM-DD'),
		       total_cents, status, to_char(issued_at,'YYYY-MM-DD')
		FROM invoice ORDER BY issued_at DESC, id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Invoice{}
	for rows.Next() {
		var v Invoice
		if err := rows.Scan(&v.ID, &v.InvoiceNumber, &v.PartnerType, &v.PartnerID,
			&v.BillName, &v.RepCode, &v.PeriodStart, &v.PeriodEnd,
			&v.TotalCents, &v.Status, &v.IssuedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
