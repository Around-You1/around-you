// Package repinvoice powers the invoice a rep issues TO Around You for their
// monthly commission. The server owns the two things that must be trustworthy:
// the invoice NUMBER (authoritative per-rep sequence, no cross-device clashes)
// and the AMOUNT (the rep's cumulative commission through the prior month,
// computed from the commission ledger — never taken from the client). It stores
// every submission and emails Accounts with reply-to set to the rep.
package repinvoice

import (
	"context"
	"fmt"
	"html"
	"log"
	"strings"
	"time"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
	"backend_encore/internal/mailer"
)

const accountsEmail = "accounts@aroundyou.co.za"

func repFromCtx(ctx context.Context) (*appdb.User, error) {
	d := auth.FromContext(ctx)
	if d == nil || d.User == nil || d.User.Role != "Rep" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a signed-in rep can create an invoice"}
	}
	return d.User, nil
}

// repNum returns the 8-digit numeric part of a rep code (Rep00000001 → 00000001).
func repNum(repCode string) string {
	digits := ""
	for _, r := range repCode {
		if r >= '0' && r <= '9' {
			digits += string(r)
		}
	}
	if digits == "" {
		digits = "0"
	}
	for len(digits) < 8 {
		digits = "0" + digits
	}
	return digits[len(digits)-8:]
}

// cumulativeCommissionCents sums a rep's commission for every period BEFORE the
// current month — the cumulative total through the prior (billing) month. This
// matches the "Month 1 + Month 2 + … " compounding payout model.
func cumulativeCommissionCents(ctx context.Context, repCode string) (int, error) {
	var cents int
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount_cents), 0) FROM commission
		WHERE lower(rep_code) = lower($1)
		  AND period_start < date_trunc('month', now())`, repCode).Scan(&cents)
	return cents, err
}

var shortMonths = []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"}
var fullMonths = []string{"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"}

// priorMonthParts returns the billing period label ("YYYY-MM") plus the invoice
// item code (e.g. RepAug26) and description (e.g. Rep August 2026) for the month
// BEFORE now.
func priorMonthParts(now time.Time) (label, itemCode, itemDesc string) {
	prev := time.Date(now.Year(), now.Month()-1, 1, 0, 0, 0, 0, time.UTC)
	i := int(prev.Month()) - 1
	label = prev.Format("2006-01")
	itemCode = "Rep" + shortMonths[i] + prev.Format("06")
	itemDesc = "Rep " + fullMonths[i] + " " + prev.Format("2006")
	return
}

func rands(cents int) string { return fmt.Sprintf("R%.2f", float64(cents)/100) }

// ---- Preview (prefill the on-screen invoice) --------------------------------

type PreviewResponse struct {
	NextNumber  string `json:"nextNumber"`
	AmountCents int    `json:"amountCents"`
	PeriodMonth string `json:"periodMonth"`
	ItemCode    string `json:"itemCode"`
	ItemDesc    string `json:"itemDesc"`
	RepName     string `json:"repName"`
	RepCode     string `json:"repCode"`
	RepEmail    string `json:"repEmail"`
	IDNumber    string `json:"idNumber"`
}

// repIDNumber returns the rep's stored SA ID / Passport number (from the
// application), or "" if not captured.
func repIDNumber(ctx context.Context, repCode string) string {
	var id string
	_ = appdb.SQLDB.QueryRowContext(ctx,
		`SELECT COALESCE(id_number, '') FROM users WHERE role = 'Rep' AND rep_code = $1`, repCode).Scan(&id)
	return id
}

//encore:api auth method=GET path=/rep-invoice/preview
func Preview(ctx context.Context) (*PreviewResponse, error) {
	u, err := repFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	amount, err := cumulativeCommissionCents(ctx, u.RepCode)
	if err != nil {
		return nil, err
	}
	var maxSeq int
	_ = appdb.SQLDB.QueryRowContext(ctx, `SELECT COALESCE(MAX(seq), 0) FROM rep_invoice WHERE rep_code = $1`, u.RepCode).Scan(&maxSeq)
	label, itemCode, itemDesc := priorMonthParts(time.Now())
	return &PreviewResponse{
		NextNumber:  fmt.Sprintf("AY-%s-%06d", repNum(u.RepCode), maxSeq+1),
		AmountCents: amount,
		PeriodMonth: label,
		ItemCode:    itemCode,
		ItemDesc:    itemDesc,
		RepName:     u.FullName,
		RepCode:     u.RepCode,
		RepEmail:    u.Email,
		IDNumber:    repIDNumber(ctx, u.RepCode),
	}, nil
}

// ---- Submit (record + email Accounts) ---------------------------------------

type SubmitRequest struct {
	IDNumber           string `json:"idNumber"`
	ResidentialAddress string `json:"residentialAddress"`
	BankHolder         string `json:"bankHolder"`
	BankName           string `json:"bankName"`
	BankAccount        string `json:"bankAccount"`
	BankBranch         string `json:"bankBranch"`
	LogoDataUrl        string `json:"logoDataUrl"`
}

type SubmitResponse struct {
	InvoiceNumber string `json:"invoiceNumber"`
	AmountCents   int    `json:"amountCents"`
	Emailed       bool   `json:"emailed"`
}

//encore:api auth method=POST path=/rep-invoice/submit
func Submit(ctx context.Context, req *SubmitRequest) (*SubmitResponse, error) {
	u, err := repFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	amount, err := cumulativeCommissionCents(ctx, u.RepCode)
	if err != nil {
		return nil, err
	}
	label, itemCode, itemDesc := priorMonthParts(time.Now())

	// Issue an authoritative per-rep sequence + number, retrying on the
	// unique(rep_code, seq) race.
	var number string
	for attempt := 0; ; attempt++ {
		var maxSeq int
		if err := appdb.SQLDB.QueryRowContext(ctx, `SELECT COALESCE(MAX(seq), 0) FROM rep_invoice WHERE rep_code = $1`, u.RepCode).Scan(&maxSeq); err != nil {
			return nil, err
		}
		seq := maxSeq + 1
		number = fmt.Sprintf("AY-%s-%06d", repNum(u.RepCode), seq)
		_, insErr := appdb.SQLDB.ExecContext(ctx, `
			INSERT INTO rep_invoice
			  (rep_code, seq, invoice_number, period_month, amount_cents,
			   rep_name, rep_email, residential_address, bank_holder, bank_name, bank_account, bank_branch)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
			u.RepCode, seq, number, label, amount,
			u.FullName, u.Email, req.ResidentialAddress, req.BankHolder, req.BankName, req.BankAccount, req.BankBranch)
		if insErr == nil {
			break
		}
		if attempt >= 4 {
			return nil, insErr
		}
	}

	idNum := repIDNumber(ctx, u.RepCode)
	if idNum == "" {
		idNum = strings.TrimSpace(req.IDNumber)
	}
	htmlBody := renderRepInvoiceHTML(u, idNum, number, itemCode, itemDesc, amount, req)
	subject := fmt.Sprintf("Rep Invoice %s — %s (%s)", number, u.FullName, u.RepCode)
	// To Accounts, reply-to the rep, cc the rep so they keep a copy.
	emailErr := mailer.SendOpts(accountsEmail, subject, htmlBody, u.Email, []string{u.Email})
	return &SubmitResponse{InvoiceNumber: number, AmountCents: amount, Emailed: emailErr == nil}, nil
}

func renderRepInvoiceHTML(u *appdb.User, idNumber, number, itemCode, itemDesc string, amountCents int, req *SubmitRequest) string {
	now := time.Now()
	due := now.AddDate(0, 0, 3)
	amt := rands(amountCents)

	logo := ""
	// Only embed a logo that is a plain image data URL and contains no
	// attribute-breaking characters (defensive against HTML injection).
	if strings.HasPrefix(req.LogoDataUrl, "data:image/") && !strings.ContainsAny(req.LogoDataUrl, "\"'<> ") {
		logo = fmt.Sprintf(`<img src="%s" alt="logo" style="max-width:140px;max-height:100px;object-fit:contain"/>`, req.LogoDataUrl)
	}
	e := html.EscapeString
	idLine := ""
	if strings.TrimSpace(idNumber) != "" {
		idLine = "ID Number: " + e(idNumber) + "<br>"
	}

	return fmt.Sprintf(`<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:660px">
  <table width="100%%" cellpadding="0" cellspacing="0"><tr>
    <td style="width:150px;vertical-align:top">%s</td>
    <td style="vertical-align:top"><b>%s</b><br>%s%s<br>Rep Code: %s<br>%s</td>
  </tr></table>
  <p style="color:#2563eb;font-weight:bold;margin-top:18px">TAX INVOICE</p>
  <table cellpadding="3">
    <tr><td style="color:#666">Invoice Number</td><td>%s</td></tr>
    <tr><td style="color:#666">Invoice Date</td><td>%s</td></tr>
    <tr><td style="color:#666">Due Date</td><td>%s</td></tr>
    <tr><td style="color:#666">Invoice Total</td><td>%s</td></tr>
    <tr><td style="color:#666">Balance Due</td><td>%s</td></tr>
  </table>
  <p><b>Around You (Pty) Ltd</b><br>Accounts<br>accounts@aroundyou.co.za</p>
  <table width="100%%" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
    <tr style="border-bottom:1px solid #ccc;text-align:left">
      <th>Item</th><th>Description</th><th align="right">Unit Cost</th><th align="right">Qty</th><th align="right">Line Total</th></tr>
    <tr style="border-bottom:1px solid #eee">
      <td style="color:#2563eb">%s</td><td>%s</td><td align="right">%s</td><td align="right">1</td><td align="right">%s</td></tr>
  </table>
  <table width="100%%" cellpadding="6"><tr>
    <td style="vertical-align:top">Banking:<br>%s<br>%s<br>Acc: %s<br>Branch: %s</td>
    <td align="right" style="vertical-align:top">Net: %s<br>Subtotal: %s<br>Total: %s<br><b>Balance Due: %s</b></td>
  </tr></table>
</div>`,
		logo, e(u.FullName), idLine, e(u.Email), e(u.RepCode), e(req.ResidentialAddress),
		e(number), now.Format("02/Jan/2006"), due.Format("02/Jan/2006"), amt, amt,
		e(itemCode), e(itemDesc), amt, amt,
		e(req.BankHolder), e(req.BankName), e(req.BankAccount), e(req.BankBranch),
		amt, amt, amt, amt)
}

// ---- Automated monthly run (the 5th) ----------------------------------------

// RunMonthlyRepInvoices auto-generates and emails each active rep's commission
// invoice to Accounts — intended to run on the 5th of each month. For every
// active, non-test rep who is owed commission (cumulative through the prior
// month) and hasn't already been invoiced for that month, it issues an
// authoritative per-rep invoice number, records it, and emails Accounts (reply-
// to + cc the rep) with the rep's full application details (banking + tax).
// Idempotent per rep per month, so re-running is safe. Returns the count sent.
func RunMonthlyRepInvoices(ctx context.Context) (int, error) {
	label, itemCode, itemDesc := priorMonthParts(time.Now())

	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT COALESCE(rep_code,''), COALESCE(full_name,''), COALESCE(rep_email,''),
		       COALESCE(id_number,''), COALESCE(residential_address,''),
		       COALESCE(date_of_birth,''), COALESCE(tax_number,''), COALESCE(vat_number,''),
		       COALESCE(bank_account_name,''), COALESCE(bank_name,''),
		       COALESCE(bank_account_number,''), COALESCE(bank_branch_code,''), COALESCE(bank_account_type,'')
		FROM users
		WHERE role = 'Rep' AND COALESCE(rep_status,'') = 'Active' AND COALESCE(rep_code,'') <> ''`)
	if err != nil {
		return 0, err
	}
	type repRow struct {
		code, name, email, id, addr, dob, tax, vat string
		bankHolder, bankName, bankAcc, bankBranch, bankType string
	}
	var reps []repRow
	for rows.Next() {
		var r repRow
		if err := rows.Scan(&r.code, &r.name, &r.email, &r.id, &r.addr, &r.dob, &r.tax, &r.vat,
			&r.bankHolder, &r.bankName, &r.bankAcc, &r.bankBranch, &r.bankType); err != nil {
			rows.Close()
			return 0, err
		}
		reps = append(reps, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	sent := 0
	for _, r := range reps {
		if appdb.IsTestRep(r.code) {
			continue
		}
		amount, err := cumulativeCommissionCents(ctx, r.code)
		if err != nil {
			log.Printf("rep-invoice run: commission for %s failed: %v", r.code, err)
			continue
		}
		if amount <= 0 {
			continue // nothing owed this month
		}

		// Idempotent: skip if this rep already has an invoice for this month.
		var exists bool
		if err := appdb.SQLDB.QueryRowContext(ctx,
			`SELECT EXISTS(SELECT 1 FROM rep_invoice WHERE rep_code = $1 AND period_month = $2)`,
			r.code, label).Scan(&exists); err != nil {
			log.Printf("rep-invoice run: dup check for %s failed: %v", r.code, err)
			continue
		}
		if exists {
			continue
		}

		// Allocate an authoritative per-rep sequence + number (retry on race).
		var number string
		var insErr error
		for attempt := 0; attempt < 5; attempt++ {
			var maxSeq int
			if err := appdb.SQLDB.QueryRowContext(ctx,
				`SELECT COALESCE(MAX(seq),0) FROM rep_invoice WHERE rep_code = $1`, r.code).Scan(&maxSeq); err != nil {
				insErr = err
				break
			}
			seq := maxSeq + 1
			number = fmt.Sprintf("AY-%s-%06d", repNum(r.code), seq)
			_, insErr = appdb.SQLDB.ExecContext(ctx, `
				INSERT INTO rep_invoice
				  (rep_code, seq, invoice_number, period_month, amount_cents,
				   rep_name, rep_email, residential_address, bank_holder, bank_name, bank_account, bank_branch)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
				r.code, seq, number, label, amount,
				r.name, r.email, r.addr, r.bankHolder, r.bankName, r.bankAcc, r.bankBranch)
			if insErr == nil {
				break
			}
		}
		if insErr != nil {
			log.Printf("rep-invoice run: could not record invoice for %s: %v", r.code, insErr)
			continue
		}

		body := renderAutoRepInvoiceHTML(r.name, r.code, r.email, r.id, r.dob, r.tax, r.vat, r.addr,
			r.bankHolder, r.bankName, r.bankAcc, r.bankBranch, r.bankType, number, itemCode, itemDesc, amount)
		subject := fmt.Sprintf("Rep Invoice %s — %s (%s)", number, r.name, r.code)
		var cc []string
		if strings.TrimSpace(r.email) != "" {
			cc = []string{r.email}
		}
		if err := mailer.SendOpts(accountsEmail, subject, body, r.email, cc); err != nil {
			log.Printf("rep-invoice run: email for %s failed: %v", r.code, err)
			// The record is stored; idempotency prevents a resend next run.
		}
		sent++
	}
	return sent, nil
}

// renderAutoRepInvoiceHTML renders the auto-generated rep invoice with the rep's
// full application details (ID, DOB, tax, VAT, banking incl. account type).
func renderAutoRepInvoiceHTML(name, code, email, idNumber, dob, tax, vat, addr,
	bankHolder, bankName, bankAcc, bankBranch, bankType, number, itemCode, itemDesc string, amountCents int) string {
	now := time.Now()
	due := now.AddDate(0, 0, 3)
	amt := rands(amountCents)
	e := html.EscapeString
	row := func(k, v string) string {
		if strings.TrimSpace(v) == "" {
			return ""
		}
		return `<tr><td style="color:#666;padding-right:14px">` + e(k) + `</td><td>` + e(v) + `</td></tr>`
	}
	return fmt.Sprintf(`<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:660px">
  <p style="font-weight:bold;font-size:16px;margin:0">%s</p>
  <table cellpadding="2" style="margin:6px 0">%s%s%s%s%s%s%s</table>
  <p style="color:#2563eb;font-weight:bold;margin-top:14px">TAX INVOICE</p>
  <table cellpadding="3">
    <tr><td style="color:#666">Invoice Number</td><td>%s</td></tr>
    <tr><td style="color:#666">Invoice Date</td><td>%s</td></tr>
    <tr><td style="color:#666">Due Date</td><td>%s</td></tr>
    <tr><td style="color:#666">Invoice Total</td><td>%s</td></tr>
    <tr><td style="color:#666">Balance Due</td><td>%s</td></tr>
  </table>
  <p><b>Around You (Pty) Ltd</b><br>Accounts<br>accounts@aroundyou.co.za</p>
  <table width="100%%" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
    <tr style="border-bottom:1px solid #ccc;text-align:left">
      <th>Item</th><th>Description</th><th align="right">Unit Cost</th><th align="right">Qty</th><th align="right">Line Total</th></tr>
    <tr style="border-bottom:1px solid #eee">
      <td style="color:#2563eb">%s</td><td>%s</td><td align="right">%s</td><td align="right">1</td><td align="right">%s</td></tr>
  </table>
  <table width="100%%" cellpadding="6"><tr>
    <td style="vertical-align:top">Banking:<br>%s<br>%s<br>Acc: %s<br>Branch: %s<br>Type: %s</td>
    <td align="right" style="vertical-align:top">Net: %s<br>Subtotal: %s<br>Total: %s<br><b>Balance Due: %s</b></td>
  </tr></table>
  <p style="color:#888;font-size:11px;margin-top:10px">Auto-generated on behalf of the rep. Payment due within 3 days of the invoice date.</p>
</div>`,
		e(name),
		row("Rep Code", code), row("ID Number", idNumber), row("Date of Birth", dob),
		row("Email", email), row("Residential Address", addr), row("SARS Tax Number", tax), row("VAT Number", vat),
		e(number), now.Format("02/Jan/2006"), due.Format("02/Jan/2006"), amt, amt,
		e(itemCode), e(itemDesc), amt, amt,
		e(bankHolder), e(bankName), e(bankAcc), e(bankBranch), e(bankType),
		amt, amt, amt, amt)
}
