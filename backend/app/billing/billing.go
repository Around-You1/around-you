// Package billing exposes the HTTP surface for the rep billing feature.
// The pricing/subscription logic lives in internal/billing (imported here as
// billingcore); this package only adapts it to the API + auth checks.
package billing

import (
	"context"
	"time"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	billingcore "backend_encore/internal/billing"
	"backend_encore/internal/errs"
)

type ListSubscriptionsResponse struct {
	Subscriptions []billingcore.Subscription `json:"subscriptions"`
}

// ListSubscriptions is SuperAdmin-only — lists every partner billing
// subscription, for verification today and the analytics/billing views later.
//
//encore:api auth method=GET path=/billing/subscriptions
func ListSubscriptions(ctx context.Context) (*ListSubscriptionsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view subscriptions"}
	}
	subs, err := billingcore.List(ctx)
	if err != nil {
		return nil, err
	}
	return &ListSubscriptionsResponse{Subscriptions: subs}, nil
}

type ListInvoicesResponse struct {
	Invoices []billingcore.Invoice `json:"invoices"`
}

// ListInvoices is SuperAdmin-only — the invoice history across all partners.
//
//encore:api auth method=GET path=/billing/invoices
func ListInvoices(ctx context.Context) (*ListInvoicesResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view invoices"}
	}
	inv, err := billingcore.ListInvoices(ctx)
	if err != nil {
		return nil, err
	}
	return &ListInvoicesResponse{Invoices: inv}, nil
}

type ListCommissionsResponse struct {
	Commissions []billingcore.Commission `json:"commissions"`
}

// ListCommissions is SuperAdmin-only — the rep commission ledger.
//
//encore:api auth method=GET path=/billing/commissions
func ListCommissions(ctx context.Context) (*ListCommissionsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view commissions"}
	}
	c, err := billingcore.ListCommissions(ctx)
	if err != nil {
		return nil, err
	}
	return &ListCommissionsResponse{Commissions: c}, nil
}

// RunMonthlyBilling wraps the internal billing run so cmd/server can trigger it
// without importing internal/billing directly (which shares this package name).
func RunMonthlyBilling(ctx context.Context) (int, error) {
	return billingcore.RunMonthlyBilling(ctx)
}

type StatementRequest struct {
	Period string `query:"period"` // "YYYY-MM"; defaults to the current month
}

type StatementResponse struct {
	Period     string                     `json:"period"`
	Statements []billingcore.RepStatement `json:"statements"`
}

// MonthlyStatements is SuperAdmin-only — each rep's commission summary for a month.
//
//encore:api auth method=GET path=/billing/statement
func MonthlyStatements(ctx context.Context, req *StatementRequest) (*StatementResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view statements"}
	}
	period := req.Period
	if period == "" {
		period = time.Now().Format("2006-01")
	}
	s, err := billingcore.MonthlyStatements(ctx, period)
	if err != nil {
		return nil, err
	}
	return &StatementResponse{Period: period, Statements: s}, nil
}

type MarkPaidRequest struct {
	Period  string `json:"period"`  // "YYYY-MM"
	RepCode string `json:"repCode"` // empty = all reps for the period
}

type MarkPaidResponse struct {
	Updated int `json:"updated"`
}

// MarkPeriodPaid is SuperAdmin-only — marks a month's accrued commissions Paid.
//
//encore:api auth method=POST path=/billing/statement/mark-paid
func MarkPeriodPaid(ctx context.Context, req *MarkPaidRequest) (*MarkPaidResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can mark payouts"}
	}
	if req.Period == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "period (YYYY-MM) is required"}
	}
	n, err := billingcore.MarkPeriodPaid(ctx, req.Period, req.RepCode)
	if err != nil {
		return nil, err
	}
	return &MarkPaidResponse{Updated: n}, nil
}

type EmailStatementsRequest struct {
	Period string `json:"period"`
}

type EmailStatementsResponse struct {
	Sent int `json:"sent"`
}

// EmailStatements is SuperAdmin-only — emails each rep (who has an email) their
// commission statement for the month.
//
//encore:api auth method=POST path=/billing/statement/email
func EmailStatements(ctx context.Context, req *EmailStatementsRequest) (*EmailStatementsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can email statements"}
	}
	period := req.Period
	if period == "" {
		period = time.Now().Format("2006-01")
	}
	n, err := billingcore.EmailStatements(ctx, period)
	if err != nil {
		return nil, err
	}
	return &EmailStatementsResponse{Sent: n}, nil
}

type SetSubscriptionStatusRequest struct {
	ID     int64  `json:"id"`
	Status string `json:"status"` // "Active" | "Paused" | "Cancelled"
}

type SetSubscriptionStatusResponse struct {
	Updated bool `json:"updated"`
}

// SetSubscriptionStatus is SuperAdmin-only — pause, cancel, or reactivate a
// partner's subscription. Cancelling records the churn timestamp.
//
//encore:api auth method=POST path=/billing/subscription/status
func SetSubscriptionStatus(ctx context.Context, req *SetSubscriptionStatusRequest) (*SetSubscriptionStatusResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can change a subscription"}
	}
	switch req.Status {
	case "Active", "Paused", "Cancelled":
	default:
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "status must be Active, Paused, or Cancelled"}
	}
	n, err := billingcore.SetSubscriptionStatus(ctx, req.ID, req.Status)
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, &errs.Error{Code: errs.NotFound, Message: "subscription not found"}
	}
	return &SetSubscriptionStatusResponse{Updated: true}, nil
}

type InvoiceSettingsResponse struct {
	Settings billingcore.InvoiceSettings `json:"settings"`
}

// GetInvoiceSettings is SuperAdmin-only — the business/bank details shown on invoices.
//
//encore:api auth method=GET path=/billing/invoice-settings
func GetInvoiceSettings(ctx context.Context) (*InvoiceSettingsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view invoice settings"}
	}
	s, err := billingcore.LoadInvoiceSettings(ctx)
	if err != nil {
		return nil, err
	}
	return &InvoiceSettingsResponse{Settings: *s}, nil
}

type InvoicePreviewResponse struct {
	Html string `json:"html"`
}

// InvoicePreview is SuperAdmin-only — a sample invoice rendered with the current
// settings, for previewing the design.
//
//encore:api auth method=GET path=/billing/invoice-preview
func InvoicePreview(ctx context.Context) (*InvoicePreviewResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can preview invoices"}
	}
	html, err := billingcore.PreviewInvoiceHTML(ctx)
	if err != nil {
		return nil, err
	}
	return &InvoicePreviewResponse{Html: html}, nil
}

// SetInvoiceSettings is SuperAdmin-only — update the business/bank details.
//
//encore:api auth method=POST path=/billing/invoice-settings
func SetInvoiceSettings(ctx context.Context, req *billingcore.InvoiceSettings) (*InvoiceSettingsResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can change invoice settings"}
	}
	if err := billingcore.SaveInvoiceSettings(ctx, req); err != nil {
		return nil, err
	}
	s, err := billingcore.LoadInvoiceSettings(ctx)
	if err != nil {
		return nil, err
	}
	return &InvoiceSettingsResponse{Settings: *s}, nil
}

type EmailLogRow struct {
	ToAddr    string    `json:"toAddr"`
	Subject   string    `json:"subject"`
	Status    string    `json:"status"`
	Detail    string    `json:"detail"`
	CreatedAt time.Time `json:"createdAt"`
}
type EmailLogResponse struct {
	Entries []EmailLogRow `json:"entries"`
}

// EmailLog lists the most recent transactional-email attempts (sent / failed /
// skipped) so a SuperAdmin can see whether invoices, codes and statements are
// actually being delivered. SuperAdmin-only.
//
//encore:api auth method=GET path=/billing/email-log
func EmailLog(ctx context.Context) (*EmailLogResponse, error) {
	if !isSuperAdmin(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view the email log"}
	}
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT to_addr, subject, status, detail, created_at
		FROM email_log ORDER BY created_at DESC LIMIT 50`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []EmailLogRow{}
	for rows.Next() {
		var r EmailLogRow
		if err := rows.Scan(&r.ToAddr, &r.Subject, &r.Status, &r.Detail, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return &EmailLogResponse{Entries: out}, rows.Err()
}

type ResendInvoiceRequest struct {
	InvoiceID int64 `json:"invoiceId"`
}
type ResendInvoiceResponse struct {
	OK bool `json:"ok"`
}

// ResendInvoice re-sends the email for an existing invoice (invoice + the
// partner's Access/Edit/QR codes). SuperAdmin-only.
//
//encore:api auth method=POST path=/billing/invoice/resend
func ResendInvoice(ctx context.Context, req *ResendInvoiceRequest) (*ResendInvoiceResponse, error) {
	if !isSuperAdmin(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can resend invoices"}
	}
	if req.InvoiceID == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invoiceId is required"}
	}
	if err := billingcore.ResendInvoiceEmail(ctx, req.InvoiceID, true); err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: err.Error()}
	}
	return &ResendInvoiceResponse{OK: true}, nil
}

// canSeeAccounts allows the Accountant role as well as SuperAdmin — used for the
// invoice list + mark-paid, which the accountant needs to reconcile payments.
func canSeeAccounts(ctx context.Context) bool {
	data := auth.FromContext(ctx)
	return data != nil && data.User != nil &&
		(data.User.Role == "SuperAdmin" || data.User.Role == "Accountant")
}

// isSuperAdmin gates the business-level roll-ups (totals, commissions, bookings)
// so the accountant can reconcile invoices without seeing overall revenue,
// commission structure, or margins.
func isSuperAdmin(ctx context.Context) bool {
	data := auth.FromContext(ctx)
	return data != nil && data.User != nil && data.User.Role == "SuperAdmin"
}

type AccountsInvoicesResponse struct {
	Invoices []billingcore.Invoice `json:"invoices"`
}

// AccountsInvoices lists every invoice for the accountant (number, company,
// amount, status, due/paid). Accountant or SuperAdmin.
//
//encore:api auth method=GET path=/accounts/invoices
func AccountsInvoices(ctx context.Context) (*AccountsInvoicesResponse, error) {
	if !canSeeAccounts(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "accountant or admin access required"}
	}
	inv, err := billingcore.ListInvoices(ctx)
	if err != nil {
		return nil, err
	}
	return &AccountsInvoicesResponse{Invoices: inv}, nil
}

type AccountsSummaryResponse struct {
	Summary billingcore.AccountsSummary `json:"summary"`
}

// AccountsSummaryReport is the invoice roll-up (invoiced/paid/outstanding/overdue).
//
//encore:api auth method=GET path=/accounts/summary
func AccountsSummaryReport(ctx context.Context) (*AccountsSummaryResponse, error) {
	if !isSuperAdmin(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view business totals"}
	}
	s, err := billingcore.LoadAccountsSummary(ctx)
	if err != nil {
		return nil, err
	}
	return &AccountsSummaryResponse{Summary: *s}, nil
}

type SetInvoiceStatusRequest struct {
	ID     int64  `json:"id"`
	Status string `json:"status"` // Issued | Paid | Overdue | Void
}

type SetInvoiceStatusResponse struct {
	Updated bool `json:"updated"`
}

// SetInvoiceStatus marks an invoice Paid/Issued/Overdue/Void. Accountant or SuperAdmin.
//
//encore:api auth method=POST path=/accounts/invoice-status
func SetInvoiceStatus(ctx context.Context, req *SetInvoiceStatusRequest) (*SetInvoiceStatusResponse, error) {
	if !canSeeAccounts(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "accountant or admin access required"}
	}
	switch req.Status {
	case "Issued", "Paid", "Overdue", "Void":
	default:
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "status must be Issued, Paid, Overdue or Void"}
	}
	n, err := billingcore.SetInvoiceStatus(ctx, req.ID, req.Status)
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, &errs.Error{Code: errs.NotFound, Message: "invoice not found"}
	}
	return &SetInvoiceStatusResponse{Updated: true}, nil
}

type CommissionRollupResponse struct {
	Rollup billingcore.CommissionRollup `json:"rollup"`
}

// AccountsCommissions is the per-rep commission roll-up. SuperAdmin only —
// the accountant must not see how much the business earns or pays out.
//
//encore:api auth method=GET path=/accounts/commissions
func AccountsCommissions(ctx context.Context) (*CommissionRollupResponse, error) {
	if !isSuperAdmin(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view commissions"}
	}
	r, err := billingcore.LoadCommissionRollup(ctx)
	if err != nil {
		return nil, err
	}
	return &CommissionRollupResponse{Rollup: *r}, nil
}

type BookingLedgerResponse struct {
	Ledger billingcore.BookingLedger `json:"ledger"`
}

// AccountsBookings is the bookings ledger (value + platform commission). SuperAdmin only —
// hidden from the accountant so revenue/commission totals aren't exposed.
//
//encore:api auth method=GET path=/accounts/bookings
func AccountsBookings(ctx context.Context) (*BookingLedgerResponse, error) {
	if !isSuperAdmin(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view the bookings ledger"}
	}
	l, err := billingcore.LoadBookingLedger(ctx)
	if err != nil {
		return nil, err
	}
	return &BookingLedgerResponse{Ledger: *l}, nil
}
