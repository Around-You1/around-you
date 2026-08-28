package billing

import (
	"context"
	"fmt"
	htmlPkg "html"
	"log"
	"net/url"
	"strconv"
	"strings"
	"time"

	"backend_encore/internal/appdb"
	"backend_encore/internal/mailer"
)

// isTestRep delegates to appdb.IsTestRep — the single source of truth shared
// with the analytics package, so the billing exclusion can never drift from the
// analytics exclusion. Rep00000001 is a test rep by default; more via the
// TEST_REP_CODES env var (comma-separated, case-insensitive).
func isTestRep(code string) bool { return appdb.IsTestRep(code) }

// isPromoMonth reports whether a billing period falls in the free introductory
// promotional month (September 2026), when every invoice is issued at R0.
func isPromoMonth(periodStart time.Time) bool {
	return periodStart.Year() == 2026 && periodStart.Month() == time.September
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
	if err := EnsureSubscription(ctx, partnerType, partnerID, accessLevel, guestType, repCode); err != nil {
		return err
	}
	// Test reps (e.g. Rep00000001) create real profiles that must still receive
	// their one onboarding invoice + email, but must never be recurring-billed
	// (no outstanding balance) and never counted in any metric. Nulling
	// next_bill_date takes them out of the monthly billing run; commission
	// accrual is skipped in GenerateInvoice; analytics queries filter them out.
	if isTestRep(repCode) {
		if _, err := appdb.SQLDB.ExecContext(ctx,
			`UPDATE partner_subscription SET next_bill_date = NULL, updated_at = now()
			 WHERE partner_type = $1 AND partner_id = $2`, partnerType, partnerID); err != nil {
			log.Printf("billing: could not clear next_bill_date for test rep %q (%s %d): %v", repCode, partnerType, partnerID, err)
		}
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
	due := start.AddDate(0, 0, 3)
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

	// September 2026 is a free introductory promotional month — every invoice
	// (all partners, base + any booking portion) is issued at R0.
	if isPromoMonth(start) {
		subtotalCents = 0
	}

	// Snapshot billing identity from the partner row (columns common to all
	// four partner tables).
	tbl := partnerTable(partnerType)
	if tbl == "" {
		return fmt.Errorf("billing: unknown partner type %q", partnerType)
	}
	var name, holding, reg, vat, repName, repCode, email, contactName, contactNumber string
	if err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT COALESCE(name,''), COALESCE(official_holding_company,''),
		       COALESCE(company_reg_number,''), COALESCE(company_vat_number,''),
		       COALESCE(official_rep_name,''), COALESCE(official_rep_code,''),
		       COALESCE(official_email,''), COALESCE(official_contact_name,''),
		       COALESCE(official_contact_number,'')
		FROM `+tbl+` WHERE id = $1`, partnerID,
	).Scan(&name, &holding, &reg, &vat, &repName, &repCode, &email, &contactName, &contactNumber); err != nil {
		return err
	}

	// Item code + description from the subscription's tier/audience and (for
	// accommodation) unit count — e.g. AccT4G, Acc6-10, Agency.
	var audience string
	_ = appdb.SQLDB.QueryRowContext(ctx, `SELECT COALESCE(audience,'') FROM partner_subscription WHERE id = $1`, subID).Scan(&audience)
	units := 1
	if partnerType == "accommodation" {
		_ = appdb.SQLDB.QueryRowContext(ctx, `SELECT COALESCE(units,1) FROM accommodations WHERE id = $1`, partnerID).Scan(&units)
	}
	itemCode, itemDesc := InvoiceItem(partnerType, tier, audience, units)

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

	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO invoice_line_item (invoice_id, description, qty, unit_cents, line_cents)
		VALUES ($1, $2, 1, $3, $3)`, invID, itemDesc, subtotalCents); err != nil {
		return err
	}

	// Accrue rep commissions for this invoice (30% own + 10% upline override).
	// Test reps earn nothing — their partners are excluded from all metrics.
	if !isTestRep(repCode) {
		if err := accrueCommissions(ctx, invID, partnerType, partnerID, repCode, subtotalCents, start); err != nil {
			log.Printf("commission accrual for invoice %s failed: %v", number, err)
		}
	}

	// Best-effort email — never block on a mail hiccup.
	if email != "" {
		settings, _ := LoadInvoiceSettings(ctx) // nil is fine — render falls back to defaults
		bizName := "Around You"
		if settings != nil && strings.TrimSpace(settings.BusinessName) != "" {
			bizName = settings.BusinessName
		}
		view := invoiceView{
			Number: number, Date: start, Due: due,
			ItemCode: itemCode, ItemDesc: itemDesc, Cents: subtotalCents,
			BillName: firstNonEmpty(holding, name), BillReg: reg, BillVat: vat,
			BillContactName: contactName, BillContactNumber: contactNumber, BillEmail: email,
		}
		html := renderInvoiceHTML(settings, view)
		if withCodes {
			html += onboardingCodesHTML(ctx, partnerType, partnerID)
		}
		_ = mailer.Send(email, "Your "+bizName+" invoice "+number, html)
	}
	return nil
}

// ResendInvoiceEmail re-sends the email for an invoice that already exists,
// rebuilt from the stored invoice data. withCodes appends the partner's Access
// Code / Edit Code / QR Code block (as on the first invoice). Returns the
// mailer error so the caller can report whether it actually sent.
func ResendInvoiceEmail(ctx context.Context, invoiceID int64, withCodes bool) error {
	var number, partnerType, billName, billHolding, billReg, billVat, email string
	var partnerID int64
	var start, due time.Time
	var totalCents int
	if err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT invoice_number, partner_type, partner_id,
		       COALESCE(bill_name,''), COALESCE(bill_holding_company,''),
		       COALESCE(bill_reg_number,''), COALESCE(bill_vat_number,''),
		       COALESCE(bill_email,''), period_start, due_at, total_cents
		FROM invoice WHERE id = $1`, invoiceID,
	).Scan(&number, &partnerType, &partnerID, &billName, &billHolding, &billReg, &billVat, &email, &start, &due, &totalCents); err != nil {
		return err
	}

	// Line item description + unit (single-line invoices).
	var itemDesc string
	var unitCents int
	_ = appdb.SQLDB.QueryRowContext(ctx,
		`SELECT COALESCE(description,''), COALESCE(unit_cents,0) FROM invoice_line_item WHERE invoice_id = $1 ORDER BY id LIMIT 1`,
		invoiceID).Scan(&itemDesc, &unitCents)
	if unitCents == 0 {
		unitCents = totalCents
	}

	// Contact name/number + a live email fallback come from the partner row
	// (the invoice snapshot may pre-date the email being captured).
	var contactName, contactNumber, partnerEmail string
	if tbl := partnerTable(partnerType); tbl != "" {
		_ = appdb.SQLDB.QueryRowContext(ctx,
			`SELECT COALESCE(official_contact_name,''), COALESCE(official_contact_number,''), COALESCE(official_email,'') FROM `+tbl+` WHERE id = $1`,
			partnerID).Scan(&contactName, &contactNumber, &partnerEmail)
	}
	if strings.TrimSpace(email) == "" {
		email = strings.TrimSpace(partnerEmail)
	}
	if strings.TrimSpace(email) == "" {
		return fmt.Errorf("this invoice has no billing email on file — set the partner's Official Use → Email, then try again")
	}

	settings, _ := LoadInvoiceSettings(ctx)
	bizName := "Around You"
	if settings != nil && strings.TrimSpace(settings.BusinessName) != "" {
		bizName = settings.BusinessName
	}
	view := invoiceView{
		Number: number, Date: start, Due: due,
		ItemDesc: itemDesc, Cents: unitCents,
		BillName: firstNonEmpty(billHolding, billName), BillReg: billReg, BillVat: billVat,
		BillContactName: contactName, BillContactNumber: contactNumber, BillEmail: email,
	}
	html := renderInvoiceHTML(settings, view)
	if withCodes {
		html += onboardingCodesHTML(ctx, partnerType, partnerID)
	}
	return mailer.Send(email, "Your "+bizName+" invoice "+number, html)
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

// invoiceView is the data the redesigned invoice template renders.
type invoiceView struct {
	Number             string
	Date, Due          time.Time
	ItemCode, ItemDesc string
	Cents              int
	// Bill-to (pulled from the partner's Official Use).
	BillName, BillReg, BillVat, BillContactName, BillContactNumber, BillEmail string
}

func firstNonEmpty(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}

// money formats ZAR cents as "R1,875.00" with thousands separators.
func money(cents int) string {
	neg := cents < 0
	if neg {
		cents = -cents
	}
	digits := strconv.Itoa(cents / 100)
	var b strings.Builder
	n := len(digits)
	for i, c := range digits {
		if i > 0 && (n-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(c)
	}
	out := fmt.Sprintf("R%s.%02d", b.String(), cents%100)
	if neg {
		out = "-" + out
	}
	return out
}

// renderInvoiceHTML builds the branded invoice (Invoice-Ninja-style layout):
// logo + Around You details + address on top, invoice meta + Official-Use
// bill-to below, an item table, then bank details and totals.
func renderInvoiceHTML(s *InvoiceSettings, v invoiceView) string {
	if s == nil {
		s = &InvoiceSettings{BusinessName: "Around You", PaymentTerms: "Payment due immediately."}
	}
	esc := htmlPkg.EscapeString
	bizName := firstNonEmpty(s.BusinessName, "Around You")
	total := money(v.Cents)

	logo := ""
	if strings.TrimSpace(s.LogoURL) != "" {
		logo = fmt.Sprintf(`<img src="%s" alt="%s" style="max-height:96px" />`, s.LogoURL, esc(bizName))
	}
	addrRight := strings.ReplaceAll(esc(strings.TrimSpace(s.Address)), "\n", "<br>")

	var b strings.Builder
	b.WriteString(`<div style="font-family:Arial,Helvetica,sans-serif;max-width:780px;color:#111;font-size:13px">`)

	// --- Top: logo | Around You | address ---
	b.WriteString(`<table width="100%" cellpadding="0" cellspacing="0"><tr>`)
	b.WriteString(`<td valign="top" width="34%">` + logo + `</td>`)
	b.WriteString(`<td valign="top" width="33%"><div style="color:#2f80ed;font-weight:bold;font-size:15px">` + esc(bizName) + `</div>`)
	if s.ContactEmail != "" {
		b.WriteString(`<div>` + esc(s.ContactEmail) + `</div>`)
	}
	if s.ContactPhone != "" {
		b.WriteString(`<div>` + esc(s.ContactPhone) + `</div>`)
	}
	b.WriteString(`</td><td valign="top" width="33%" align="right">` + addrRight + `</td></tr></table>`)

	b.WriteString(`<div style="color:#2f80ed;font-weight:bold;margin:18px 0 6px">TAX INVOICE</div>`)
	b.WriteString(`<hr style="border:none;border-top:1px solid #e5e7eb">`)

	// --- Second level: meta (left) | bill-to from Official Use (right) ---
	b.WriteString(`<table width="100%" cellpadding="0" cellspacing="0"><tr><td valign="top" width="50%"><table cellpadding="2">`)
	row := func(k, val string) {
		b.WriteString(`<tr><td style="color:#555;padding-right:16px">` + k + `</td><td>` + val + `</td></tr>`)
	}
	row("Invoice Number", esc(v.Number))
	row("Invoice Date", v.Date.Format("02/Jan/2006"))
	row("Due Date", v.Due.Format("02/Jan/2006"))
	row("Invoice Total", total)
	row("Balance Due", total)
	b.WriteString(`</table></td><td valign="top" width="50%">`)
	b.WriteString(`<div style="font-weight:bold">` + esc(firstNonEmpty(v.BillName, "Partner")) + `</div>`)
	addBill := func(val string) {
		if strings.TrimSpace(val) != "" {
			b.WriteString(`<div>` + esc(val) + `</div>`)
		}
	}
	addBill(v.BillReg)
	addBill(v.BillVat)
	addBill(v.BillContactName)
	addBill(v.BillContactNumber)
	addBill(v.BillEmail)
	b.WriteString(`</td></tr></table>`)

	// --- Item table ---
	b.WriteString(`<table width="100%" cellpadding="8" cellspacing="0" style="margin-top:22px;border-collapse:collapse">`)
	b.WriteString(`<tr style="border-bottom:1px solid #ccc;text-align:left"><th>Item</th><th>Description</th>` +
		`<th style="text-align:right">Unit Cost</th><th style="text-align:right">Quantity</th><th style="text-align:right">Line Total</th></tr>`)
	b.WriteString(`<tr style="border-bottom:1px solid #eee"><td style="color:#2f80ed">` + esc(v.ItemCode) + `</td>` +
		`<td>` + esc(v.ItemDesc) + `</td><td style="text-align:right">` + total + `</td>` +
		`<td style="text-align:right">1</td><td style="text-align:right">` + total + `</td></tr></table>`)

	// --- Bottom: bank (left) | totals without Paid to Date (right) ---
	bank := ""
	addBank := func(label, val string) {
		if strings.TrimSpace(val) != "" {
			bank += `<div>` + label + ": " + esc(val) + `</div>`
		}
	}
	addBank("Bank", s.BankName)
	addBank("Account No.", s.AccountNumber)
	addBank("Branch Code", s.BranchCode)

	b.WriteString(`<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr>`)
	b.WriteString(`<td valign="top" width="55%" style="line-height:1.9">` + bank + `</td>`)
	b.WriteString(`<td valign="top" width="45%"><table width="100%" cellpadding="3">`)
	trow := func(k, val string) {
		b.WriteString(`<tr><td style="color:#555">` + k + `</td><td style="text-align:right">` + val + `</td></tr>`)
	}
	trow("Net", total)
	trow("Subtotal", total)
	trow("Total", total)
	trow("Balance Due", total)
	b.WriteString(`</table></td></tr></table>`)

	terms := firstNonEmpty(strings.TrimSpace(s.PaymentTerms), "Payment due immediately.")
	b.WriteString(`<p style="color:#888;font-size:11px;margin-top:18px">` + esc(bizName) +
		` is not currently VAT-registered; no VAT has been charged. ` + esc(terms) + `</p></div>`)
	return b.String()
}

// PreviewInvoiceHTML renders a sample invoice using the current settings, so the
// admin can preview the design without onboarding a partner or sending email.
func PreviewInvoiceHTML(ctx context.Context) (string, error) {
	s, _ := LoadInvoiceSettings(ctx) // nil is fine — renders with defaults
	now := time.Now()
	return renderInvoiceHTML(s, invoiceView{
		Number:            fmt.Sprintf("AY-%d-000123", now.Year()),
		Date:              now,
		Due:               now.AddDate(0, 0, 3),
		ItemCode:          "ResT3L",
		ItemDesc:          "Restaurant Tier 3 Local",
		Cents:             20000,
		BillName:          "Sample Partner (Pty) Ltd",
		BillReg:           "2020/123456/07",
		BillVat:           "4001234567",
		BillContactName:   "Jane Doe",
		BillContactNumber: "+27 21 000 0000",
		BillEmail:         "billing@sample.co.za",
	}), nil
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
