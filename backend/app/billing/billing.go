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
