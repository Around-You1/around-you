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
	PartnerName  string `json:"partnerName"`  // resolved from the partner's own table
	Billable     bool   `json:"billable"`     // active, paid plan, real (non-test) rep, billing anchored
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
	// The first invoice is issued at onboarding (the day the partner goes live);
	// recurring billing then runs on that same day-of-month every month, so the
	// next bill date is one month out from today.
	nextBill := time.Now().AddDate(0, 1, 0)

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
// PartnerName is resolved from the partner's own table (the admin view shows the
// real business name instead of "accommodation #17"), and Billable flags the
// subscriptions that actually bill money: active, on a paid plan, with the
// monthly anchor set, onboarded by a real (non-test) rep. The billing view uses
// Billable to hide complimentary/test/not-yet-activated rows.
func List(ctx context.Context) ([]Subscription, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT ps.id, ps.partner_type, ps.partner_id, ps.plan,
		       COALESCE(ps.tier, 0), COALESCE(ps.audience, ''), ps.monthly_cents,
		       COALESCE((CASE ps.partner_type
		         WHEN 'restaurant'    THEN (SELECT official_rep_code FROM restaurants     WHERE id = ps.partner_id)
		         WHEN 'service'       THEN (SELECT official_rep_code FROM services        WHERE id = ps.partner_id)
		         WHEN 'attraction'    THEN (SELECT official_rep_code FROM attractions     WHERE id = ps.partner_id)
		         WHEN 'accommodation' THEN (SELECT official_rep_code FROM accommodations  WHERE id = ps.partner_id)
		         WHEN 'estate_agency' THEN (SELECT official_rep_code FROM estate_agencies WHERE id = ps.partner_id)
		         WHEN 'estate_agent'  THEN (SELECT official_rep_code FROM estate_agents   WHERE id = ps.partner_id)
		       END), ps.rep_code, ''), ps.status, ps.auto_renew,
		       COALESCE(to_char(ps.next_bill_date, 'YYYY-MM-DD'), ''),
		       COALESCE((CASE ps.partner_type
		         WHEN 'restaurant'    THEN (SELECT name FROM restaurants     WHERE id = ps.partner_id)
		         WHEN 'service'       THEN (SELECT name FROM services        WHERE id = ps.partner_id)
		         WHEN 'attraction'    THEN (SELECT name FROM attractions     WHERE id = ps.partner_id)
		         WHEN 'accommodation' THEN (SELECT name FROM accommodations  WHERE id = ps.partner_id)
		         WHEN 'estate_agency' THEN (SELECT name FROM estate_agencies WHERE id = ps.partner_id)
		         WHEN 'estate_agent'  THEN (SELECT name FROM estate_agents   WHERE id = ps.partner_id)
		       END), '')
		FROM partner_subscription ps
		ORDER BY ps.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	subs := []Subscription{}
	for rows.Next() {
		var s Subscription
		if err := rows.Scan(&s.ID, &s.PartnerType, &s.PartnerID, &s.Plan,
			&s.Tier, &s.Audience, &s.MonthlyCents, &s.RepCode, &s.Status,
			&s.AutoRenew, &s.NextBillDate, &s.PartnerName); err != nil {
			return nil, err
		}
		// Billable = money actually changes hands: active, paid plan, billing
		// anchor set (activated), and a real rep that isn't a test rep. RepCode
		// here is the partner's CURRENT profile rep (falling back to the
		// subscription's stored rep), so moving a partner to the test rep excludes
		// it immediately, without waiting for the subscription mirror to catch up.
		// Test-rep and complimentary (R0) listings, and partners not yet activated
		// for recurring billing, are excluded.
		s.Billable = s.Status == "Active" &&
			s.MonthlyCents > 0 &&
			strings.TrimSpace(s.NextBillDate) != "" &&
			strings.TrimSpace(s.RepCode) != "" &&
			!isTestRep(s.RepCode)
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
