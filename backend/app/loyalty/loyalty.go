// Package loyalty implements per-partner digital stamp cards ("buy N, get 1
// free"). A partner turns the card on and sets the rule (threshold + reward
// wording); the partner then adds a stamp for a customer by mobile number and
// redeems the reward once the card is full. Cards are keyed by (partner,
// customer mobile), so they persist across a customer's logins and work the same
// for local residents and holiday guests.
//
// Only the partner that owns the profile (or internal staff) may configure the
// card, add stamps, or redeem — a customer can never stamp their own card. A
// customer can read their own cards by mobile number (My stamp cards).
package loyalty

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// The six partner categories that can run a loyalty card. The map is a fixed
// whitelist, so its table values are safe to interpolate into SQL.
var partnerTables = map[string]string{
	"restaurant":    "restaurants",
	"service":       "services",
	"retail":        "retail",
	"nonprofit":     "nonprofits",
	"attraction":    "attractions",
	"accommodation": "accommodations",
	"estate_agency": "estate_agencies",
	"estate_agent":  "estate_agents",
}

const (
	minThreshold = 2
	maxThreshold = 50
	// stampCooldown collapses accidental double-taps: a second stamp for the same
	// card within this window is rejected. It is not a purchase-rate rule, just a
	// guard against the partner tapping +1 twice.
	stampCooldown = 15 * time.Second
)

// ---- Types -----------------------------------------------------------------

// Program is a partner's loyalty-card configuration.
type Program struct {
	PartnerType string `json:"partnerType"`
	PartnerID   int64  `json:"partnerId"`
	SpecialID   string `json:"specialId"` // "" = the partner's single legacy card; else a My Stamp Card promotion
	Enabled     bool   `json:"enabled"`
	Threshold   int    `json:"threshold"`  // stamps needed for one reward
	RewardText  string `json:"rewardText"` // what the customer gets, e.g. "1 free 10L water refill"
	Label       string `json:"label"`      // what earns a stamp (the promotion's first line) — for display
	ImageUrl    string `json:"imageUrl"`   // the promotion's product image — for display
}

// CardView is one customer's card at a partner, plus the partner's rule — the
// single shape returned to both the partner screen and the customer view.
type CardView struct {
	PartnerType   string `json:"partnerType"`
	PartnerID     int64  `json:"partnerId"`
	PartnerName   string `json:"partnerName"`
	BrandColor    string `json:"brandColor"`
	Area          string `json:"area"`
	Enabled       bool   `json:"enabled"`
	Threshold     int    `json:"threshold"`
	RewardText    string `json:"rewardText"`
	SpecialID     string `json:"specialId"`
	Label         string `json:"label"`
	ImageUrl      string `json:"imageUrl"`
	CustomerPhone string `json:"customerPhone"`
	Stamps        int    `json:"stamps"`        // current progress toward threshold
	RewardReady   bool   `json:"rewardReady"`   // stamps >= threshold, awaiting redeem
	RewardsEarned int    `json:"rewardsEarned"` // lifetime rewards claimed on this card
}

type GetProgramRequest struct {
	PartnerType string `json:"partnerType"`
	PartnerID   int64  `json:"partnerId"`
	SpecialID   string `json:"specialId"`
}

type SetProgramRequest struct {
	PartnerType string `json:"partnerType"`
	PartnerID   int64  `json:"partnerId"`
	SpecialID   string `json:"specialId"`
	Enabled     bool   `json:"enabled"`
	Threshold   int    `json:"threshold"`
	RewardText  string `json:"rewardText"`
}

type CardRequest struct {
	PartnerType string `json:"partnerType"`
	PartnerID   int64  `json:"partnerId"`
	SpecialID   string `json:"specialId"` // "" = legacy single card; else a My Stamp Card promotion
	Phone       string `json:"phone"`
	Count       int    `json:"count"` // stamps to add at once (AddStamp); 0/absent = 1
}

type MyCardsRequest struct {
	Phone string `json:"phone"`
}

type MyCardsResponse struct {
	Cards []CardView `json:"cards"`
}

// ---- Helpers ---------------------------------------------------------------

// ownerOrStaff allows the request only for internal staff (SuperAdmin/Admin/Rep)
// or the Partner session that owns this exact profile. A customer session can
// never manage a card.
func ownerOrStaff(ctx context.Context, partnerType string, partnerID int64) error {
	if auth.IsPrivileged(ctx) {
		return nil
	}
	d := auth.FromContext(ctx)
	if d == nil || d.User == nil || d.User.Role != "Partner" ||
		d.User.EntityType != partnerType || d.User.EntityID != partnerID {
		return &errs.Error{Code: errs.PermissionDenied, Message: "only this partner (or staff) can manage its stamp card"}
	}
	return nil
}

func validType(partnerType string) bool {
	_, ok := partnerTables[partnerType]
	return ok
}

// normalizePhone reduces a number to digits so the same customer matches however
// they (or the partner) type it. A local 0-prefixed number and its +27 form
// collapse to the same key.
func normalizePhone(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	d := b.String()
	if strings.HasPrefix(d, "27") && len(d) == 11 {
		d = "0" + d[2:]
	}
	return d
}

func partnerNameArea(ctx context.Context, partnerType string, partnerID int64) (string, string) {
	tbl, ok := partnerTables[partnerType]
	if !ok {
		return "", ""
	}
	// Only the location-based partner tables carry an `area` column; estate
	// agencies/agents do not, so fall back to an empty area for those.
	areaCol := "''"
	switch partnerType {
	case "restaurant", "service", "attraction", "accommodation", "retail", "nonprofit":
		areaCol = "COALESCE(area,'')"
	}
	var name, area string
	_ = appdb.SQLDB.QueryRowContext(ctx,
		"SELECT COALESCE(name,''), "+areaCol+" FROM "+tbl+" WHERE id = $1", partnerID).Scan(&name, &area)
	return name, area
}

func partnerBrandColor(ctx context.Context, partnerType string, partnerID int64) string {
	var tbl string
	switch partnerType {
	case "service":
		tbl = "services"
	case "retail":
		tbl = "retail"
	case "nonprofit":
		tbl = "nonprofits"
	default:
		return ""
	}
	var c string
	_ = appdb.SQLDB.QueryRowContext(ctx,
		"SELECT COALESCE(brand_color,'') FROM "+tbl+" WHERE id = $1", partnerID).Scan(&c)
	return c
}

// loadProgram returns the partner's config, or a disabled default if none saved.
func loadProgram(ctx context.Context, partnerType string, partnerID int64, specialID string) (Program, error) {
	p := Program{PartnerType: partnerType, PartnerID: partnerID, SpecialID: specialID, Threshold: 10}
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT enabled, threshold, COALESCE(reward_text,''), COALESCE(label,''), COALESCE(image_url,'')
		FROM loyalty_programs WHERE partner_type = $1 AND partner_id = $2 AND special_id = $3`,
		partnerType, partnerID, specialID,
	).Scan(&p.Enabled, &p.Threshold, &p.RewardText, &p.Label, &p.ImageUrl)
	if err == sql.ErrNoRows {
		return p, nil
	}
	if err != nil {
		return p, err
	}
	return p, nil
}

// cardView assembles a CardView from a program and the (possibly absent) card row.
func cardView(prog Program, name, area, brandColor, phone string, stamps, rewards int) CardView {
	ready := prog.Threshold > 0 && stamps >= prog.Threshold
	return CardView{
		PartnerType:   prog.PartnerType,
		PartnerID:     prog.PartnerID,
		SpecialID:     prog.SpecialID,
		Label:         prog.Label,
		ImageUrl:      prog.ImageUrl,
		PartnerName:   name,
		BrandColor:    brandColor,
		Area:          area,
		Enabled:       prog.Enabled,
		Threshold:     prog.Threshold,
		RewardText:    prog.RewardText,
		CustomerPhone: phone,
		Stamps:        stamps,
		RewardReady:   ready,
		RewardsEarned: rewards,
	}
}

// ---- Endpoints -------------------------------------------------------------

// GetProgram returns a partner's loyalty configuration.
//
//encore:api auth method=POST path=/loyalty/program/get
func GetProgram(ctx context.Context, req *GetProgramRequest) (*Program, error) {
	if !validType(req.PartnerType) || req.PartnerID == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid partner"}
	}
	if err := ownerOrStaff(ctx, req.PartnerType, req.PartnerID); err != nil {
		return nil, err
	}
	p, err := loadProgram(ctx, req.PartnerType, req.PartnerID, req.SpecialID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// SetProgram creates or updates a partner's loyalty configuration.
//
//encore:api auth method=POST path=/loyalty/program/set
func SetProgram(ctx context.Context, req *SetProgramRequest) (*Program, error) {
	if !validType(req.PartnerType) || req.PartnerID == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid partner"}
	}
	if err := ownerOrStaff(ctx, req.PartnerType, req.PartnerID); err != nil {
		return nil, err
	}
	if req.Threshold < minThreshold || req.Threshold > maxThreshold {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "threshold must be between 2 and 50 stamps"}
	}
	reward := strings.TrimSpace(req.RewardText)
	if req.Enabled && reward == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "describe the reward before turning the card on"}
	}
	_, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO loyalty_programs (partner_type, partner_id, special_id, enabled, threshold, reward_text)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (partner_type, partner_id, special_id) DO UPDATE SET
		  enabled     = EXCLUDED.enabled,
		  threshold   = EXCLUDED.threshold,
		  reward_text = EXCLUDED.reward_text,
		  updated_at  = now()`,
		req.PartnerType, req.PartnerID, req.SpecialID, req.Enabled, req.Threshold, reward,
	)
	if err != nil {
		return nil, err
	}
	return &Program{
		PartnerType: req.PartnerType, PartnerID: req.PartnerID, SpecialID: req.SpecialID,
		Enabled: req.Enabled, Threshold: req.Threshold, RewardText: reward,
	}, nil
}

// SetBrandColorRequest carries a partner's chosen brand colour (a hex value
// like "#E11D2A", or "" to clear it). Only business/service profiles carry a
// brand colour today.
type SetBrandColorRequest struct {
	PartnerType string `json:"partnerType"`
	PartnerID   int64  `json:"partnerId"`
	BrandColor  string `json:"brandColor"`
}

// BrandColorResponse echoes the stored brand colour.
type BrandColorResponse struct {
	BrandColor string `json:"brandColor"`
}

func brandColorValid(s string) bool {
	if len(s) != 7 || s[0] != '#' {
		return false
	}
	for _, r := range s[1:] {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
			return false
		}
	}
	return true
}

// SetBrandColor stores a partner's brand colour. The partner's name renders in
// this colour on the app, so only the owning partner (or staff) may set it.
// Only business/service profiles support a brand colour.
//
//encore:api auth method=POST path=/loyalty/brand-color/set
func SetBrandColor(ctx context.Context, req *SetBrandColorRequest) (*BrandColorResponse, error) {
	if !validType(req.PartnerType) || req.PartnerID == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid partner"}
	}
	if err := ownerOrStaff(ctx, req.PartnerType, req.PartnerID); err != nil {
		return nil, err
	}
	var tbl string
	switch req.PartnerType {
	case "service":
		tbl = "services"
	case "retail":
		tbl = "retail"
	case "nonprofit":
		tbl = "nonprofits"
	default:
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "brand colour is only available for business, retail and NPO profiles"}
	}
	bc := strings.TrimSpace(req.BrandColor)
	if bc != "" && !brandColorValid(bc) {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "brand colour must be a hex value like #E11D2A"}
	}
	if _, err := appdb.SQLDB.ExecContext(ctx,
		"UPDATE "+tbl+" SET brand_color = $1, updated_at = now() WHERE id = $2",
		bc, req.PartnerID,
	); err != nil {
		return nil, err
	}
	return &BrandColorResponse{BrandColor: bc}, nil
}

// loadCard fetches the current stamp count + lifetime rewards for a card, or
// zeroes if the customer has none yet.
func loadCard(ctx context.Context, partnerType string, partnerID int64, specialID, phone string) (stamps, rewards int, err error) {
	err = appdb.SQLDB.QueryRowContext(ctx, `
		SELECT stamps, rewards_earned FROM loyalty_cards
		WHERE partner_type = $1 AND partner_id = $2 AND special_id = $3 AND customer_phone = $4`,
		partnerType, partnerID, specialID, phone,
	).Scan(&stamps, &rewards)
	if err == sql.ErrNoRows {
		return 0, 0, nil
	}
	return stamps, rewards, err
}

// LookupCard returns a customer's current card at this partner (partner screen).
//
//encore:api auth method=POST path=/loyalty/lookup
func LookupCard(ctx context.Context, req *CardRequest) (*CardView, error) {
	if !validType(req.PartnerType) || req.PartnerID == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid partner"}
	}
	if err := ownerOrStaff(ctx, req.PartnerType, req.PartnerID); err != nil {
		return nil, err
	}
	phone := normalizePhone(req.Phone)
	if len(phone) < 7 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "enter the customer's mobile number"}
	}
	prog, err := loadProgram(ctx, req.PartnerType, req.PartnerID, req.SpecialID)
	if err != nil {
		return nil, err
	}
	stamps, rewards, err := loadCard(ctx, req.PartnerType, req.PartnerID, req.SpecialID, phone)
	if err != nil {
		return nil, err
	}
	pn, pa := partnerNameArea(ctx, req.PartnerType, req.PartnerID)
	v := cardView(prog, pn, pa, partnerBrandColor(ctx, req.PartnerType, req.PartnerID), phone, stamps, rewards)
	return &v, nil
}

// AddStamp records one or more stamps for a customer (req.Count, default 1).
// Blocked when the card is full
// (redeem first) or when a stamp was just added (double-tap guard).
//
//encore:api auth method=POST path=/loyalty/stamp
func AddStamp(ctx context.Context, req *CardRequest) (*CardView, error) {
	if !validType(req.PartnerType) || req.PartnerID == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid partner"}
	}
	if err := ownerOrStaff(ctx, req.PartnerType, req.PartnerID); err != nil {
		return nil, err
	}
	phone := normalizePhone(req.Phone)
	if len(phone) < 7 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "enter the customer's mobile number"}
	}
	prog, err := loadProgram(ctx, req.PartnerType, req.PartnerID, req.SpecialID)
	if err != nil {
		return nil, err
	}
	if !prog.Enabled {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "this My Stamp Card is switched off"}
	}

	// Read the existing card (with its last stamp time) to apply the guards.
	var stamps, rewards int
	var lastStamp sql.NullTime
	err = appdb.SQLDB.QueryRowContext(ctx, `
		SELECT stamps, rewards_earned, last_stamp_at FROM loyalty_cards
		WHERE partner_type = $1 AND partner_id = $2 AND special_id = $3 AND customer_phone = $4`,
		req.PartnerType, req.PartnerID, req.SpecialID, phone,
	).Scan(&stamps, &rewards, &lastStamp)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	if stamps >= prog.Threshold {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "this card is full — redeem the reward first"}
	}
	if lastStamp.Valid && time.Since(lastStamp.Time) < stampCooldown {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "a stamp was just added a moment ago"}
	}

	// How many stamps to add this scan (the teller's dropdown). Default 1, capped
	// at a sane per-scan max, and never pushed past the card's threshold.
	n := req.Count
	if n < 1 {
		n = 1
	}
	if n > 20 {
		n = 20
	}
	if room := prog.Threshold - stamps; n > room {
		n = room
	}

	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO loyalty_cards (partner_type, partner_id, special_id, customer_phone, stamps, total_stamps, last_stamp_at)
		VALUES ($1, $2, $3, $4, $5, $5, now())
		ON CONFLICT (partner_type, partner_id, special_id, customer_phone) DO UPDATE SET
		  stamps        = loyalty_cards.stamps + $5,
		  total_stamps  = loyalty_cards.total_stamps + $5,
		  last_stamp_at = now(),
		  updated_at    = now()`,
		req.PartnerType, req.PartnerID, req.SpecialID, phone, n,
	); err != nil {
		return nil, err
	}

	stamps, rewards, err = loadCard(ctx, req.PartnerType, req.PartnerID, req.SpecialID, phone)
	if err != nil {
		return nil, err
	}
	pn, pa := partnerNameArea(ctx, req.PartnerType, req.PartnerID)
	v := cardView(prog, pn, pa, partnerBrandColor(ctx, req.PartnerType, req.PartnerID), phone, stamps, rewards)
	return &v, nil
}

// RedeemReward claims a full card's reward: it subtracts one threshold's worth of
// stamps, logs the redemption, and leaves any surplus stamps on the card.
//
//encore:api auth method=POST path=/loyalty/redeem
func RedeemReward(ctx context.Context, req *CardRequest) (*CardView, error) {
	if !validType(req.PartnerType) || req.PartnerID == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid partner"}
	}
	if err := ownerOrStaff(ctx, req.PartnerType, req.PartnerID); err != nil {
		return nil, err
	}
	phone := normalizePhone(req.Phone)
	if len(phone) < 7 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "enter the customer's mobile number"}
	}
	prog, err := loadProgram(ctx, req.PartnerType, req.PartnerID, req.SpecialID)
	if err != nil {
		return nil, err
	}

	var cardID int64
	var stamps int
	err = appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, stamps FROM loyalty_cards
		WHERE partner_type = $1 AND partner_id = $2 AND special_id = $3 AND customer_phone = $4`,
		req.PartnerType, req.PartnerID, req.SpecialID, phone,
	).Scan(&cardID, &stamps)
	if err == sql.ErrNoRows || stamps < prog.Threshold {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "this card is not full yet"}
	}
	if err != nil {
		return nil, err
	}

	if _, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE loyalty_cards
		SET stamps = stamps - $2, rewards_earned = rewards_earned + 1, updated_at = now()
		WHERE id = $1`, cardID, prog.Threshold,
	); err != nil {
		return nil, err
	}
	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO loyalty_redemptions
		  (partner_type, partner_id, special_id, customer_phone, card_id, threshold, reward_text, redeemed_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		req.PartnerType, req.PartnerID, req.SpecialID, phone, cardID, prog.Threshold, prog.RewardText, auth.ActorLabel(ctx),
	); err != nil {
		return nil, err
	}

	stampsNow, rewards, err := loadCard(ctx, req.PartnerType, req.PartnerID, req.SpecialID, phone)
	if err != nil {
		return nil, err
	}
	pn, pa := partnerNameArea(ctx, req.PartnerType, req.PartnerID)
	v := cardView(prog, pn, pa, partnerBrandColor(ctx, req.PartnerType, req.PartnerID), phone, stampsNow, rewards)
	return &v, nil
}

// MyCards lists a customer's cards across all partners that run an enabled card,
// looked up by mobile number (customer "My stamp cards" view).
//
//encore:api auth method=POST path=/loyalty/my-cards
func MyCards(ctx context.Context, req *MyCardsRequest) (*MyCardsResponse, error) {
	phone := normalizePhone(req.Phone)
	if len(phone) < 7 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "enter your mobile number"}
	}
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT c.partner_type, c.partner_id, c.special_id, c.stamps, c.rewards_earned,
		       p.threshold, COALESCE(p.reward_text,''), COALESCE(p.label,''), COALESCE(p.image_url,'')
		FROM loyalty_cards c
		JOIN loyalty_programs p
		  ON p.partner_type = c.partner_type AND p.partner_id = c.partner_id AND p.special_id = c.special_id
		WHERE c.customer_phone = $1 AND p.enabled = true
		ORDER BY c.updated_at DESC`, phone)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []CardView{}
	for rows.Next() {
		var pt, specialID string
		var pid int64
		var stamps, rewards, threshold int
		var reward, label, imageURL string
		if err := rows.Scan(&pt, &pid, &specialID, &stamps, &rewards, &threshold, &reward, &label, &imageURL); err != nil {
			return nil, err
		}
		prog := Program{PartnerType: pt, PartnerID: pid, SpecialID: specialID, Enabled: true, Threshold: threshold, RewardText: reward, Label: label, ImageUrl: imageURL}
		pn, pa := partnerNameArea(ctx, pt, pid)
		out = append(out, cardView(prog, pn, pa, partnerBrandColor(ctx, pt, pid), phone, stamps, rewards))
	}
	return &MyCardsResponse{Cards: out}, rows.Err()
}
