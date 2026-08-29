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
