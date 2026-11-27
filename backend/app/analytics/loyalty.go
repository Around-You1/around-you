package analytics

import (
	"context"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// LoyaltyCardRow is one partner's stamp-card activity.
type LoyaltyCardRow struct {
	PartnerType     string `json:"partnerType"`
	PartnerID       int64  `json:"partnerId"`
	PartnerName     string `json:"partnerName"`
	RewardText      string `json:"rewardText"`
	Threshold       int    `json:"threshold"`       // stamps needed for the reward
	Participants    int    `json:"participants"`    // customers who have at least one stamp
	TotalStamps     int    `json:"totalStamps"`     // stamps given out over the card's life
	ReadyToRedeem   int    `json:"readyToRedeem"`   // cards now full, awaiting redemption
	RewardsRedeemed int    `json:"rewardsRedeemed"` // rewards already handed over
}

// LoyaltyStampResponse is the SuperAdmin stamp-card breakdown: one row per
// partner's card, plus overall totals.
type LoyaltyStampResponse struct {
	Cards             []LoyaltyCardRow `json:"cards"`
	TotalParticipants int              `json:"totalParticipants"` // distinct customers across all cards
	TotalStamps       int              `json:"totalStamps"`
	TotalReadyToRedeem int             `json:"totalReadyToRedeem"`
}

// LoyaltyStamps reports, per partner stamp card: how many customers are stamping,
// how many stamps have been given, and how many cards are full and waiting to be
// redeemed. SuperAdmin only.
//
//encore:api auth method=GET path=/analytics/loyalty
func LoyaltyStamps(ctx context.Context) (*LoyaltyStampResponse, error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view stamp-card analytics"}
	}

	resp := &LoyaltyStampResponse{Cards: []LoyaltyCardRow{}}

	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT c.partner_type, c.partner_id,
		       COALESCE((CASE c.partner_type
		         WHEN 'restaurant'    THEN (SELECT name FROM restaurants     WHERE id = c.partner_id)
		         WHEN 'service'       THEN (SELECT name FROM services        WHERE id = c.partner_id)
		         WHEN 'retail'        THEN (SELECT name FROM retail          WHERE id = c.partner_id)
		         WHEN 'nonprofit'     THEN (SELECT name FROM nonprofits      WHERE id = c.partner_id)
		         WHEN 'attraction'    THEN (SELECT name FROM attractions     WHERE id = c.partner_id)
		         WHEN 'accommodation' THEN (SELECT name FROM accommodations  WHERE id = c.partner_id)
		         WHEN 'estate_agency' THEN (SELECT name FROM estate_agencies WHERE id = c.partner_id)
		         WHEN 'estate_agent'  THEN (SELECT name FROM estate_agents   WHERE id = c.partner_id)
		       END), '') AS partner_name,
		       COALESCE(max(p.reward_text), '')                                             AS reward_text,
		       COALESCE(max(p.threshold), 0)                                                AS threshold,
		       count(*) FILTER (WHERE c.total_stamps > 0)                                   AS participants,
		       COALESCE(sum(c.total_stamps), 0)                                             AS total_stamps,
		       count(*) FILTER (WHERE COALESCE(p.threshold, 0) > 0 AND c.stamps >= p.threshold) AS ready,
		       COALESCE(sum(c.rewards_earned), 0)                                           AS rewards_redeemed
		FROM loyalty_cards c
		LEFT JOIN loyalty_programs p
		  ON p.partner_type = c.partner_type AND p.partner_id = c.partner_id AND p.special_id = c.special_id
		GROUP BY c.partner_type, c.partner_id, c.special_id
		HAVING count(*) FILTER (WHERE c.total_stamps > 0) > 0
		ORDER BY total_stamps DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var r LoyaltyCardRow
		if err := rows.Scan(&r.PartnerType, &r.PartnerID, &r.PartnerName, &r.RewardText,
			&r.Threshold, &r.Participants, &r.TotalStamps, &r.ReadyToRedeem, &r.RewardsRedeemed); err != nil {
			return nil, err
		}
		resp.Cards = append(resp.Cards, r)
		resp.TotalStamps += r.TotalStamps
		resp.TotalReadyToRedeem += r.ReadyToRedeem
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Distinct customers across every card (a person who stamps at two shops is
	// counted once here, but once per card in the per-partner rows).
	_ = appdb.SQLDB.QueryRowContext(ctx,
		`SELECT count(DISTINCT customer_phone) FROM loyalty_cards WHERE total_stamps > 0`).Scan(&resp.TotalParticipants)

	return resp, nil
}
