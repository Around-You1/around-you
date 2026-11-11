package billing

import (
	"context"
	"database/sql"
	"fmt"
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
	Expected     bool   `json:"expected"`     // active, paid plan, real (non-test) rep — counts even if not yet activated for billing
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

	// Half-price reps (e.g. the internal "Around You 12" account, Rep00000012)
	// bill their partners at half the normal monthly cost. The per-booking /
	// pre-order usage fees added at billing time are unchanged.
	if appdb.IsHalfPriceRep(repCode) {
		p.MonthlyCents = p.MonthlyCents / 2
	} else if appdb.IsQuarterPriceRep(repCode) {
		// 25% discount — bill 75% of the normal monthly cost.
		p.MonthlyCents = p.MonthlyCents - p.MonthlyCents/4
	}

	// A per-partner price override (an admin-set negotiated monthly fee) wins
	// over the computed plan price and survives profile re-saves. The launch
	// promo still applies on top at invoice time.
	var override sql.NullInt64
	_ = appdb.SQLDB.QueryRowContext(ctx,
		`SELECT monthly_cents_override FROM partner_subscription WHERE partner_type = $1 AND partner_id = $2`,
		partnerType, partnerID).Scan(&override)
	if override.Valid && override.Int64 > 0 {
		p.MonthlyCents = int(override.Int64)
	}

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

// SetMonthlyOverride sets (cents > 0) or clears (cents <= 0) a partner's custom
// monthly price. When set, it is stored on the subscription and used as the
// standing monthly_cents, winning over the computed plan price and surviving
// profile re-saves (EnsureSubscription reads it back). When cleared, the price
// reverts to the computed plan + rep-tier price. Returns the resulting standing
// monthly price in cents (before any invoice-time promo discount).
func SetMonthlyOverride(ctx context.Context, partnerType string, partnerID int64, cents int) (int, error) {
	if cents > 0 {
		res, err := appdb.SQLDB.ExecContext(ctx, `
			UPDATE partner_subscription
			SET monthly_cents_override = $3, monthly_cents = $3, updated_at = now()
			WHERE partner_type = $1 AND partner_id = $2`, partnerType, partnerID, cents)
		if err != nil {
			return 0, err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return 0, fmt.Errorf("no subscription for %s %d", partnerType, partnerID)
		}
		return cents, nil
	}
	// Clear the override and recompute the standing price from the plan + rep tier.
	tbl := partnerTable(partnerType)
	if tbl == "" {
		return 0, fmt.Errorf("unknown partner type %q", partnerType)
	}
	if _, err := appdb.SQLDB.ExecContext(ctx,
		`UPDATE partner_subscription SET monthly_cents_override = NULL WHERE partner_type = $1 AND partner_id = $2`,
		partnerType, partnerID); err != nil {
		return 0, err
	}
	var accessLevel, guestType, repCode string
	_ = appdb.SQLDB.QueryRowContext(ctx,
		`SELECT COALESCE(access_level,''), COALESCE(guest_type,''), COALESCE(official_rep_code,'') FROM `+tbl+` WHERE id = $1`,
		partnerID).Scan(&accessLevel, &guestType, &repCode)
	if err := EnsureSubscription(ctx, partnerType, partnerID, accessLevel, guestType, repCode); err != nil {
		return 0, err
	}
	var m int
	_ = appdb.SQLDB.QueryRowContext(ctx,
		`SELECT monthly_cents FROM partner_subscription WHERE partner_type = $1 AND partner_id = $2`,
		partnerType, partnerID).Scan(&m)
	return m, nil
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
		         WHEN 'retail'        THEN (SELECT official_rep_code FROM retail          WHERE id = ps.partner_id)
		         WHEN 'nonprofit'     THEN (SELECT official_rep_code FROM nonprofits      WHERE id = ps.partner_id)
		         WHEN 'attraction'    THEN (SELECT official_rep_code FROM attractions     WHERE id = ps.partner_id)
		         WHEN 'accommodation' THEN (SELECT official_rep_code FROM accommodations  WHERE id = ps.partner_id)
		         WHEN 'estate_agency' THEN (SELECT official_rep_code FROM estate_agencies WHERE id = ps.partner_id)
		         WHEN 'estate_agent'  THEN (SELECT official_rep_code FROM estate_agents   WHERE id = ps.partner_id)
		       END), ps.rep_code, ''), ps.status, ps.auto_renew,
		       COALESCE(to_char(ps.next_bill_date, 'YYYY-MM-DD'), ''),
		       COALESCE((CASE ps.partner_type
		         WHEN 'restaurant'    THEN (SELECT name FROM restaurants     WHERE id = ps.partner_id)
		         WHEN 'service'       THEN (SELECT name FROM services        WHERE id = ps.partner_id)
		         WHEN 'retail'        THEN (SELECT name FROM retail          WHERE id = ps.partner_id)
		         WHEN 'nonprofit'     THEN (SELECT name FROM nonprofits      WHERE id = ps.partner_id)
		         WHEN 'attraction'    THEN (SELECT name FROM attractions     WHERE id = ps.partner_id)
		         WHEN 'accommodation' THEN (SELECT name FROM accommodations  WHERE id = ps.partner_id)
		         WHEN 'estate_agency' THEN (SELECT name FROM estate_agencies WHERE id = ps.partner_id)
		         WHEN 'estate_agent'  THEN (SELECT name FROM estate_agents   WHERE id = ps.partner_id)
		       END), ''),
		       COALESCE((CASE ps.partner_type
		         WHEN 'service' THEN (SELECT is_nonprofit FROM services WHERE id = ps.partner_id)
		         ELSE false
		       END), false)
		FROM partner_subscription ps
		ORDER BY ps.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	subs := []Subscription{}
	for rows.Next() {
		var s Subscription
		var svcNonProfit bool
		if err := rows.Scan(&s.ID, &s.PartnerType, &s.PartnerID, &s.Plan,
			&s.Tier, &s.Audience, &s.MonthlyCents, &s.RepCode, &s.Status,
			&s.AutoRenew, &s.NextBillDate, &s.PartnerName, &svcNonProfit); err != nil {
			return nil, err
		}
		// Billable = money actually changes hands: active, paid plan, billing
		// anchor set (activated), and a real rep that isn't a test rep. RepCode
		// here is the partner's CURRENT profile rep (falling back to the
		// subscription's stored rep), so moving a partner to the test rep excludes
		// it immediately, without waiting for the subscription mirror to catch up.
		// Test-rep and complimentary (R0) listings, and partners not yet activated
		// for recurring billing, are excluded.
		// Free listings never bill (matching the invoice run's exemptions): every
		// NPO/PBO, and any Service flagged as a non-profit/charity. They are kept
		// out of both the billable list and the Expected revenue forecast.
		freeListing := s.PartnerType == "nonprofit" || (s.PartnerType == "service" && svcNonProfit)
		s.Billable = s.Status == "Active" &&
			s.MonthlyCents > 0 &&
			strings.TrimSpace(s.NextBillDate) != "" &&
			strings.TrimSpace(s.RepCode) != "" &&
			!isTestRep(s.RepCode) &&
			!freeListing
		// Expected revenue mirrors Billable exactly, so the Admin Billing
		// "Expected revenue" forecast equals what the next monthly run will
		// actually invoice: active, paid, activated-for-billing partners on a
		// real (non-test) agent, excluding free listings. Partners on a paid plan
		// that have NOT yet been activated for billing (next_bill_date still NULL)
		// are not invoiced, so they are not counted here either.
		s.Expected = s.Billable
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
