package billing

import (
	"context"
	"fmt"
	"strings"
	"time"

	"backend_encore/internal/appdb"
	"backend_encore/internal/mailer"
)

// ReminderRow is one partner with an unpaid invoice, shown in the admin
// "Payment Reminders" review list before any email goes out.
type ReminderRow struct {
	InvoiceID  int64  `json:"invoiceId"`
	BillName   string `json:"billName"`
	Email      string `json:"email"`
	TotalCents int    `json:"totalCents"`
	Month      string `json:"month"`   // e.g. "November 2026"
	DueDate    string `json:"dueDate"` // e.g. "4 November 2026"
}

// ListUnpaidReminders returns every partner who should receive a payment
// reminder: an invoice that is not Paid and not Void, with a billing email on
// file. It excludes free partners (their current subscription is R0, e.g. a
// partner moved to free), test reps, and rep-less public listings (landmark
// attractions). Partners that have been marked Paid are excluded automatically.
func ListUnpaidReminders(ctx context.Context) ([]ReminderRow, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT i.id, COALESCE(i.bill_name,''), COALESCE(i.bill_email,''),
		       i.total_cents, i.period_start, i.due_at
		FROM invoice i
		LEFT JOIN partner_subscription ps ON ps.id = i.subscription_id
		WHERE i.status NOT IN ('Paid','Void')
		  AND COALESCE(i.bill_email,'') <> ''
		  AND COALESCE(ps.monthly_cents, i.total_cents) > 0
		  AND NOT (i.partner_type = 'attraction' AND COALESCE(i.bill_rep_code,'') = '')
		  AND `+appdb.NotTestRepSQL("lower(coalesce(i.bill_rep_code,''))")+`
		ORDER BY i.bill_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ReminderRow{}
	for rows.Next() {
		var r ReminderRow
		var periodStart, dueAt time.Time
		if err := rows.Scan(&r.InvoiceID, &r.BillName, &r.Email, &r.TotalCents, &periodStart, &dueAt); err != nil {
			return nil, err
		}
		r.Month = periodStart.Format("January 2006")
		r.DueDate = dueAt.Format("2 January 2006")
		out = append(out, r)
	}
	return out, rows.Err()
}

// reminderEmailHTML is the reusable payment-reminder body, with the subscription
// month and due date auto-filled so it works every month without editing.
func reminderEmailHTML(month, dueDate string) string {
	return fmt.Sprintf(`<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;color:#111;font-size:14px;line-height:1.55">`+
		`<p>Hello,</p>`+
		`<p>Hope you're having a great week!</p>`+
		`<p>Just a friendly heads-up that payment for your <strong>%s</strong> subscription was due yesterday, <strong>%s</strong>.</p>`+
		`<p>To ensure your profile stays active and visible to holiday guests and local customers on aroundyou.co.za without any interruption, please complete the payment as soon as possible.</p>`+
		`<p>So as to avoid deactivation of your profile, please send us a Proof of Payment.</p>`+
		`<p>If you've already made the transfer, please disregard this note (and thank you!). If you need the payment details resent or have any questions, just let us know at accounts@aroundyou.co.za.</p>`+
		`<p>Best regards,<br>Around You Accounts Team</p>`+
		`</div>`, month, dueDate)
}

// SendReminderForInvoice emails the payment reminder for one unpaid invoice.
// It re-checks the invoice is still unpaid so a Paid/Void one is never reminded.
func SendReminderForInvoice(ctx context.Context, invoiceID int64) error {
	var billEmail, status string
	var periodStart, dueAt time.Time
	if err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT COALESCE(bill_email,''), status, period_start, due_at
		FROM invoice WHERE id = $1`, invoiceID,
	).Scan(&billEmail, &status, &periodStart, &dueAt); err != nil {
		return err
	}
	if status == "Paid" || status == "Void" {
		return fmt.Errorf("invoice %d is %s — not reminding", invoiceID, status)
	}
	if strings.TrimSpace(billEmail) == "" {
		return fmt.Errorf("invoice %d has no billing email", invoiceID)
	}
	month := periodStart.Format("January 2006")
	due := dueAt.Format("2 January 2006")
	settings, _ := LoadInvoiceSettings(ctx)
	return mailer.SendFull(
		billEmail,
		"Quick reminder: Your Around You listing",
		reminderEmailHTML(month, due),
		"",
		[]string{"accounts@aroundyou.co.za"},
		copyBcc(settings),
		nil,
	)
}
