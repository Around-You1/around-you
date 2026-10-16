package billing

import (
	"bytes"
	"fmt"
	"strings"
)

// invoicePDFName builds a safe attachment filename from an invoice number.
func invoicePDFName(number string) string {
	safe := strings.NewReplacer("/", "-", " ", "-", "\\", "-").Replace(strings.TrimSpace(number))
	if safe == "" {
		safe = "invoice"
	}
	return "invoice-" + safe + ".pdf"
}

// pdfEsc makes a string safe for a PDF text literal: common Unicode punctuation
// is folded to ASCII, parens/backslashes are escaped, and anything outside
// Latin-1 (WinAnsi) becomes '?'.
func pdfEsc(s string) string {
	s = strings.NewReplacer(
		"—", "-", // em dash
		"–", "-", // en dash
		"‘", "'", "’", "'", // curly single quotes
		"“", "\"", "”", "\"", // curly double quotes
		"…", "...", // ellipsis
		" ", " ", // nbsp
	).Replace(s)
	var b strings.Builder
	for _, r := range s {
		switch {
		case r == '\\':
			b.WriteString("\\\\")
		case r == '(':
			b.WriteString("\\(")
		case r == ')':
			b.WriteString("\\)")
		case r == '\n' || r == '\r' || r == '\t':
			b.WriteByte(' ')
		case r > 255:
			b.WriteByte('?')
		default:
			b.WriteByte(byte(r))
		}
	}
	return b.String()
}

// wrapChars splits text into lines of at most n characters, breaking on spaces.
func wrapChars(s string, n int) []string {
	words := strings.Fields(s)
	var lines []string
	cur := ""
	for _, w := range words {
		if cur == "" {
			cur = w
		} else if len(cur)+1+len(w) <= n {
			cur += " " + w
		} else {
			lines = append(lines, cur)
			cur = w
		}
	}
	if cur != "" {
		lines = append(lines, cur)
	}
	if len(lines) == 0 {
		lines = []string{""}
	}
	return lines
}

// buildInvoicePDF renders a single-page A4 invoice as a minimal, valid PDF with
// no external dependencies (Helvetica standard fonts, hand-built xref). It
// mirrors the fields of the HTML invoice so the attachment matches the email.
func buildInvoicePDF(s *InvoiceSettings, v invoiceView) []byte {
	if s == nil {
		s = &InvoiceSettings{BusinessName: "Around You", PaymentTerms: "Payment due within 3 days of the invoice date."}
	}
	biz := firstNonEmpty(s.BusinessName, "Around You")
	total := money(v.total())

	var c strings.Builder
	draw := func(x, y float64, size int, bold bool, txt string) {
		f := "F1"
		if bold {
			f = "F2"
		}
		fmt.Fprintf(&c, "BT /%s %d Tf %.1f %.1f Td (%s) Tj ET\n", f, size, x, y, pdfEsc(txt))
	}
	rule := func(x1, y, x2 float64) {
		fmt.Fprintf(&c, "%.1f %.1f %.1f %.1f re f\n", x1, y, x2-x1, 0.6)
	}

	const L = 40.0
	const R = 555.0

	// --- Header: business name + contact (left), address (right). ---
	y := 800.0
	draw(L, y, 18, true, biz)
	hy := y - 18
	if strings.TrimSpace(s.ContactEmail) != "" {
		draw(L, hy, 10, false, s.ContactEmail)
		hy -= 12
	}
	if strings.TrimSpace(s.ContactPhone) != "" {
		draw(L, hy, 10, false, s.ContactPhone)
		hy -= 12
	}
	ay := 800.0
	for _, ln := range strings.Split(strings.TrimSpace(s.Address), "\n") {
		if strings.TrimSpace(ln) == "" {
			continue
		}
		draw(330, ay, 10, false, strings.TrimSpace(ln))
		ay -= 12
	}

	y = hy
	if ay < y {
		y = ay
	}
	y -= 14
	draw(L, y, 14, true, "TAX INVOICE")
	y -= 8
	rule(L, y, R)
	y -= 20

	// --- Meta (left) and Bill-To (right). ---
	top := y
	metaY := top
	metaRow := func(k, val string) {
		draw(L, metaY, 10, false, k)
		draw(L+115, metaY, 10, false, val)
		metaY -= 14
	}
	metaRow("Invoice Number", v.Number)
	metaRow("Invoice Date", v.Date.Format("02/Jan/2006"))
	metaRow("Due Date", v.Due.Format("02/Jan/2006"))
	metaRow("Invoice Total", total)
	metaRow("Balance Due", total)

	bY := top
	draw(320, bY, 10, true, firstNonEmpty(v.BillName, "Partner"))
	bY -= 13
	for _, val := range []string{v.BillReg, v.BillVat, v.BillContactName, v.BillContactNumber, v.BillEmail} {
		if strings.TrimSpace(val) != "" {
			draw(320, bY, 10, false, val)
			bY -= 13
		}
	}

	y = metaY
	if bY < y {
		y = bY
	}
	y -= 10
	draw(L, y, 10, true, "Please use your invoice number as reference when making payment.")
	y -= 22

	// --- Line items. ---
	rule(L, y, R)
	y -= 14
	draw(L, y, 10, true, "Description")
	draw(470, y, 10, true, "Line Total")
	y -= 6
	rule(L, y, R)
	y -= 16
	for _, l := range v.lines() {
		desc := l.Desc
		if strings.TrimSpace(l.Code) != "" {
			desc = l.Code + " - " + l.Desc
		}
		for i, ln := range wrapChars(desc, 70) {
			draw(L, y, 10, false, ln)
			if i == 0 {
				draw(470, y, 10, false, money(l.Cents))
			}
			y -= 14
		}
	}
	y -= 4
	rule(L, y, R)
	y -= 18

	// --- Totals (right-aligned block). ---
	tRow := func(k, val string, bold bool) {
		draw(360, y, 10, bold, k)
		draw(470, y, 10, bold, val)
		y -= 14
	}
	tRow("Subtotal", total, false)
	tRow("Total", total, true)
	tRow("Balance Due", total, true)
	y -= 12

	// --- Banking details. ---
	if strings.TrimSpace(s.BankName) != "" || strings.TrimSpace(s.AccountNumber) != "" {
		draw(L, y, 10, true, "Banking details")
		y -= 14
		for _, kv := range [][2]string{{"Bank", s.BankName}, {"Account Name", s.AccountName}, {"Account No.", s.AccountNumber}, {"Branch Code", s.BranchCode}} {
			if strings.TrimSpace(kv[1]) != "" {
				draw(L, y, 10, false, kv[0]+": "+kv[1])
				y -= 13
			}
		}
		y -= 8
	}

	terms := firstNonEmpty(strings.TrimSpace(s.PaymentTerms), "Payment due within 3 days of the invoice date.")
	note := biz + " is not currently VAT-registered; no VAT has been charged. " + terms
	for _, ln := range wrapChars(note, 95) {
		draw(L, y, 9, false, ln)
		y -= 11
	}

	content := []byte(c.String())

	objs := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
	}

	var buf bytes.Buffer
	offsets := make([]int, 7)
	buf.WriteString("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
	for i := 1; i <= 5; i++ {
		offsets[i] = buf.Len()
		fmt.Fprintf(&buf, "%d 0 obj\n%s\nendobj\n", i, objs[i-1])
	}
	offsets[6] = buf.Len()
	fmt.Fprintf(&buf, "6 0 obj\n<< /Length %d >>\nstream\n", len(content))
	buf.Write(content)
	buf.WriteString("\nendstream\nendobj\n")

	xrefAt := buf.Len()
	buf.WriteString("xref\n0 7\n0000000000 65535 f \n")
	for i := 1; i <= 6; i++ {
		fmt.Fprintf(&buf, "%010d 00000 n \n", offsets[i])
	}
	fmt.Fprintf(&buf, "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF", xrefAt)
	return buf.Bytes()
}
