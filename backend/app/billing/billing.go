// Package billing exposes the HTTP surface for the rep billing feature.
// The pricing/subscription logic lives in internal/billing (imported here as
// billingcore); this package only adapts it to the API + auth checks.
package billing

import (
	"context"

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
