// Package billing exposes the HTTP surface for the rep billing feature.
// The pricing/subscription logic lives in internal/billing (imported here as
// billingcore); this package only adapts it to the API + auth checks.
package billing

import (
	"context"
	"time"

	"backend_encore/app/auth"
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
