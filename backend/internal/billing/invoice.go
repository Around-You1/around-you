package billing

import (
	"context"
	"fmt"
	htmlPkg "html"
	"log"
	"net/url"
	"os"
	"strings"
	"time"

	"backend_encore/internal/appdb"
	"backend_encore/internal/mailer"
)

// isTestRep reports whether a rep code is flagged as a TEST rep, whose onboarded
// partners must NOT generate any billing/commission records. Rep00000001 is a
// test rep by default; more can be added via the TEST_REP_CODES env var
// (comma-separated, case-insensitive), e.g. "Rep00000001,Rep00000007".
func isTestRep(code string) bool {
	code = strings.ToLower(strings.TrimSpace(code))
	if code == "" {
		return false
	}
	for _, t := range testRepCodes() {
		if code == t {
			return true
		}
	}
	return false
}

func testRepCodes() []string {
	codes := []string{"rep00000001"} // default test rep
	for _, c := range strings.Split(os.Getenv("TEST_REP_CODES"), ",") {
		if c = strings.ToLower(strings.TrimSpace(c)); c != "" {
			codes = append(codes, c)
		}
	}
	return codes
}

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
	DueAt         string `json:"dueAt"`
	PaidAt        string `json:"paidAt"`
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
	case "estate_agency":
		return "estate_agencies"
	case "estate_agent":
		return "estate_agents"
	default:
		return ""
	}
}

// OnPartnerOnboarded is the single hook the partner Create handlers call: it
// ensures the billing subscription exists and issues the first invoice. Both
// steps are idempotent, so a re-save reconciles rather than duplicates.
func OnPartnerOnboarded(ctx context.Context, partnerType string, partnerID int64, accessLevel, guestType, repCode string) error {
	// Test reps (e.g. Rep00000001) create real profiles for testing, but must
	// not generate any subscription/invoice/commission noise in the live books.
	if isTestRep(repCode) {
		log.Printf("billing: skipping subscription+invoice for test rep %q (%s %d)", repCode, partnerType, partnerID)
		return nil
	}
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
	return GenerateInvoice(ctx, subID, partnerType, partnerID, plan, tier, int(monthly), start, end, due, true)
}

// GenerateInvoice creates one invoice (+ a line item) for a subscription's
// billing period and emails it. No-op if an invoice already exists for that
// (subscription, period_start) — the idempotency the monthly run relies on.
// subtotalCents is the fixed monthly amount; the monthly run adds any 10%
// booking portion for Booking partners on top (Phase 4).
// withCodes is true only for the FIRST (onboarding) invoice — when set, the
// email also includes the partner's Access Code, Partner Edit Code and Profile
// QR Code. The monthly billing run passes false so those go out only once.
func GenerateInvoice(ctx context.Context, subID int64, partnerType string, partnerID int64, plan string, tier, subtotalCents int, start, end, due time.Time, withCodes bool) error {
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
		settings, _ := LoadInvoiceSettings(ctx) // nil is fine — render falls back to defaults
		bizName := "Around You"
		if settings != nil && strings.TrimSpace(settings.BusinessName) != "" {
			bizName = settings.BusinessName
		}
		html := renderInvoiceHTML(settings, number, name, desc, subtotalCents, start, due)
		if withCodes {
			html += onboardingCodesHTML(ctx, partnerType, partnerID)
		}
		_ = mailer.Send(email, "Your "+bizName+" invoice "+number, html)
	}
	return nil
}

// onboardingCodesHTML builds the "welcome" block appended to the FIRST invoice
// email only: the partner's Access Code, Partner Edit Code and Profile QR Code.
func onboardingCodesHTML(ctx context.Context, partnerType string, partnerID int64) string {
	tbl := partnerTable(partnerType)
	if tbl == "" {
		return ""
	}
	var editCode, profileRef string
	_ = appdb.SQLDB.QueryRowContext(ctx,
		"SELECT COALESCE(edit_code,''), COALESCE(profile_reference_code,'') FROM "+tbl+" WHERE id = $1", partnerID,
	).Scan(&editCode, &profileRef)

	// Access Code = partner_code for the three partner-login categories; for
	// accommodation and estate pages it's the profile_reference_code.
	access := profileRef
	if partnerType == "restaurant" || partnerType == "service" || partnerType == "attraction" {
		_ = appdb.SQLDB.QueryRowContext(ctx,
			"SELECT COALESCE(partner_code,'') FROM "+tbl+" WHERE id = $1", partnerID,
		).Scan(&access)
	}
	if access == "" && editCode == "" && profileRef == "" {
		return ""
	}

	qr := ""
	if profileRef != "" {
		loginURL := profileURL(partnerType, profileRef)
		qrSrc := "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + url.QueryEscape(loginURL)
		qr = fmt.Sprintf(
			`<p style="margin:16px 0 4px;font-weight:bold">Your Profile QR Code</p>`+
				`<img src="%s" alt="Profile QR Code" width="200" height="200" style="border:1px solid #ddd;border-radius:6px"/>`+
				`<p style="font-size:12px;color:#666;margin:4px 0 0">Print or share this — guests scan it to open your profile.</p>`,
			qrSrc)
	}

	return fmt.Sprintf(
		`<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>`+
			`<h3 style="margin:0 0 10px">Welcome to Around You — your profile codes</h3>`+
			`<p style="margin:2px 0"><strong>Profile Access Code:</strong> %s</p>`+
			`<p style="margin:2px 0"><strong>Partner Edit Code:</strong> %s</p>`+
			`<p style="font-size:12px;color:#666;margin:8px 0 0">Please keep these confidential. The Access Code logs you in; the Edit Code unlocks editing of your own profile.</p>`+
			`%s`,
		htmlPkg.EscapeString(access), htmlPkg.EscapeString(editCode), qr)
}

// profileURL is the link the QR encodes for each partner type.
func profileURL(partnerType, code string) string {
	switch partnerType {
	case "accommodation":
		return "https://aroundyou.co.za/?code=" + url.QueryEscape(code)
	case "estate_agency":
		return "https://aroundyou.co.za/estate/agency/" + url.PathEscape(code)
	case "estate_agent":
		return "https://aroundyou.co.za/estate/agent/" + url.PathEscape(code)
	default: // restaurant | service | attraction
		return "https://aroundyou.co.za/?code=" + url.QueryEscape(code) + "&role=partner"
	}
}

func lineDescription(plan string, tier int, start time.Time) string {
	period := start.Format("January 2006")
	if plan == "booking" {
		return "Booking plan monthly fee — " + period
	}
	return fmt.Sprintf("Tier %d subscription — %s", tier, period)
}

func rands(cents int) string { return fmt.Sprintf("R%.2f", float64(cents)/100) }

func renderInvoiceHTML(s *InvoiceSettings, number, name, desc string, cents int, start, due time.Time) string {
	if s == nil {
		s = &InvoiceSettings{BusinessName: "Around You", PaymentTerms: "Payment due immediately."}
	}
	logo := ""
	if strings.TrimSpace(s.LogoURL) != "" {
		logo = fmt.Sprintf(`<img src="%s" alt="%s" style="max-height:64px;margin-bottom:10px" />`, s.LogoURL, s.BusinessName)
	}

	bizLines := []string{}
	appendIf := func(v string) {
		if strings.TrimSpace(v) != "" {
			bizLines = append(bizLines, v)
		}
	}
	appendIf(s.Address)
	appendIf(s.ContactEmail)
	appendIf(s.ContactPhone)
	if strings.TrimSpace(s.RegNumber) != "" {
		bizLines = append(bizLines, "Reg: "+s.RegNumber)
	}
	if strings.TrimSpace(s.VatNumber) != "" {
		bizLines = append(bizLines, "VAT: "+s.VatNumber)
	}
	biz := strings.Join(bizLines, "<br>")

	bankRows := ""
	addBank := func(label, val string) {
		if strings.TrimSpace(val) != "" {
			bankRows += fmt.Sprintf(`<tr><td style="color:#888;padding-right:12px">%s</td><td>%s</td></tr>`, label, val)
		}
	}
	addBank("Bank", s.BankName)
	addBank("Account name", s.AccountName)
	addBank("Account number", s.AccountNumber)
	addBank("Branch code", s.BranchCode)
	ref := s.PaymentReference
	if strings.TrimSpace(ref) == "" {
		ref = number // default the payment reference to the invoice number
	}
	addBank("Reference", ref)
	bankBlock := ""
	if bankRows != "" {
		bankBlock = fmt.Sprintf(`<h3 style="margin-top:20px">How to pay</h3><table cellpadding="4" style="font-size:14px">%s</table>`, bankRows)
	}

	terms := strings.TrimSpace(s.PaymentTerms)
	if terms == "" {
		terms = "Payment due immediately."
	}

	return fmt.Sprintf(`
<div style="font-family:Arial,sans-serif;max-width:600px">
  %s
  <h2 style="margin:0">%s</h2>
  <p style="color:#888;font-size:12px;margin:2px 0 16px">%s</p>
  <h3>Invoice %s</h3>
  <p>Billed to: <strong>%s</strong><br>Period starting %s</p>
  <table style="width:100%%;border-collapse:collapse" cellpadding="8">
    <tr><td style="border-bottom:1px solid #ddd">%s</td>
        <td style="border-bottom:1px solid #ddd;text-align:right">%s</td></tr>
    <tr><td style="text-align:right"><strong>Total</strong></td>
        <td style="text-align:right"><strong>%s</strong></td></tr>
  </table>
  <p>Due by %s. %s</p>
  %s
  <p style="color:#888;font-size:12px">%s is not currently VAT-registered; no VAT has been charged.</p>
</div>`,
		logo, s.BusinessName, biz, number, name,
		start.Format("2 January 2006"), desc, rands(cents), rands(cents),
		due.Format("2 January 2006"), terms, bankBlock, s.BusinessName)
}

// PreviewInvoiceHTML renders a sample invoice using the current settings, so the
// admin can preview the design without onboarding a partner or sending email.
func PreviewInvoiceHTML(ctx context.Context) (string, error) {
	s, _ := LoadInvoiceSettings(ctx) // nil is fine — renders with defaults
	now := time.Now()
	return renderInvoiceHTML(
		s,
		fmt.Sprintf("AY-%d-000123", now.Year()),
		"Sample Partner (Pty) Ltd",
		"Tier 3 subscription — "+now.Format("January 2006"),
		20000, // R200 sample
		now, now.AddDate(0, 0, 7),
	), nil
}

// ListInvoices returns invoices newest-first — powers the admin billing view.
func ListInvoices(ctx context.Context) ([]Invoice, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT id, invoice_number, partner_type, partner_id,
		       COALESCE(bill_name,''), COALESCE(bill_rep_code,''),
		       to_char(period_start,'YYYY-MM-DD'), to_char(period_end,'YYYY-MM-DD'),
		       total_cents, status, to_char(issued_at,'YYYY-MM-DD'),
		       COALESCE(to_char(due_at,'YYYY-MM-DD'),''), COALESCE(to_char(paid_at,'YYYY-MM-DD'),'')
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
			&v.TotalCents, &v.Status, &v.IssuedAt, &v.DueAt, &v.PaidAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
