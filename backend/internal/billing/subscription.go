package billing

import (
	"context"
	"strings"
	"time"

	"backend_encore/internal/appdb"
)

// Subscription mirrors a row of partner_subscription for read APIs.
type Subscription struct {
	ID           int64  `json:"id"`
	PartnerType  string `json:"partnerType"`
	PartnerID    int64  `json:"partnerId"`
	Plan         string `json:"plan"`
	Tier         int    `json:"tier"` // 0 = booking / none
	Audience     string `json:"audience"`
	MonthlyCents int    `json:"monthlyCents"`
	RepCode      string `json:"repCode"`
	Status       string `json:"status"`
	AutoRenew    bool   `json:"autoRenew"`
	NextBillDate string `json:"nextBillDate"` // YYYY-MM-DD
}

// EnsureSubscription creates (or updates) the billing arrangement for a partner
// from its stored tier/audience. Idempotent per partner via the unique
// (partner_type, partner_id) constraint, so re-onboarding or editing a partner
// keeps the subscription in sync rather than duplicating it.
func EnsureSubscription(ctx context.Context, partnerType string, partnerID int64, accessLevel, guestType, repCode string) error {
	units := 1
	if partnerType == "accommodation" {
		_ = appdb.SQLDB.QueryRowContext(ctx,
			"SELECT COALESCE(units, 1) FROM accommodations WHERE id = $1", partnerID).Scan(&units)
	}
	p := PriceForUnits(partnerType, accessLevel, guestType, units)

	var tierArg interface{}
	if p.Tier > 0 {
		tierArg = p.Tier
	}
	var audienceArg interface{}
	if strings.TrimSpace(p.Audience) != "" {
		audienceArg = p.Audience
	}
	var repArg interface{}
	if strings.TrimSpace(repCode) != "" {
		repArg = strings.TrimSpace(repCode)
	}
	nextBill := time.Now().AddDate(0, 1, 0) // first bill covers this month; next in one month

	_, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO partner_subscription
		  (partner_type, partner_id, plan, tier, audience, monthly_cents, rep_code, next_bill_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (partner_type, partner_id) DO UPDATE SET
		  plan          = EXCLUDED.plan,
		  tier          = EXCLUDED.tier,
		  audience      = EXCLUDED.audience,
		  monthly_cents = EXCLUDED.monthly_cents,
		  rep_code      = EXCLUDED.rep_code,
		  updated_at    = now()`,
		partnerType, partnerID, p.Plan, tierArg, audienceArg, p.MonthlyCents, repArg, nextBill,
	)
	return err
}

// SetStatusByPartner sets a subscription's lifecycle status by (partner_type,
// partner_id). Used by the real-estate flow to cancel billing when a page is
// deactivated/deleted and reactivate it when re-enabled. No-op if none exists.
func SetStatusByPartner(ctx context.Context, partnerType string, partnerID int64, status string) error {
	_, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE partner_subscription
		SET status = $3,
		    cancelled_at = CASE WHEN $3 = 'Cancelled' THEN now() ELSE NULL END,
		    updated_at = now()
		WHERE partner_type = $1 AND partner_id = $2`, partnerType, partnerID, status)
	return err
}

// List returns all subscriptions, newest first — powers admin/analytics views.
func List(ctx context.Context) ([]Subscription, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT id, partner_type, partner_id, plan,
		       COALESCE(tier, 0), COALESCE(audience, ''), monthly_cents,
		       COALESCE(rep_code, ''), status, auto_renew,
		       to_char(next_bill_date, 'YYYY-MM-DD')
		FROM partner_subscription
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	subs := []Subscription{}
	for rows.Next() {
		var s Subscription
		if err := rows.Scan(&s.ID, &s.PartnerType, &s.PartnerID, &s.Plan,
			&s.Tier, &s.Audience, &s.MonthlyCents, &s.RepCode, &s.Status,
			&s.AutoRenew, &s.NextBillDate); err != nil {
			return nil, err
		}
		subs = append(subs, s)
	}
	return subs, rows.Err()
}

// SetSubscriptionStatus updates a subscription's lifecycle status. Setting
// 'Cancelled' stamps cancelled_at (the basis for churn); any other status
// clears it. A non-Active subscription is skipped by the billing run and does
// not count toward MRR. Returns rows affected.
func SetSubscriptionStatus(ctx context.Context, id int64, status string) (int64, error) {
	res, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE partner_subscription
		SET status = $2,
		    cancelled_at = CASE WHEN $2 = 'Cancelled' THEN now() ELSE NULL END,
		    updated_at = now()
		WHERE id = $1`, id, status)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
