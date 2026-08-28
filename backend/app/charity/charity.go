// Package charity records the charity focus areas a partner supports (captured
// in the Official Use section) and tallies them per month for the Admin
// Analytics page. Stored in a single partner_charity table so every partner
// type shares the same shape.
package charity

import (
	"context"
	"strings"
	"time"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// Categories is the fixed, ordered set shown as checkboxes and columns.
var Categories = []string{"Adults", "Children", "Animals", "Health", "Homes", "Food"}

// CharityGroups (who) and CharitySubs (what) form the two-level single-select.
// A partner picks one of each, so their support is a (group, sub) pair.
var CharityGroups = []string{"Adults", "Children", "Animals"}
var CharitySubs = []string{"Health", "Homes", "Food"}

func isValid(c string) bool {
	for _, v := range Categories {
		if v == c {
			return true
		}
	}
	return false
}

func requirePriv(ctx context.Context) error {
	if !auth.IsPrivileged(ctx) {
		return &errs.Error{Code: errs.PermissionDenied, Message: "not permitted"}
	}
	return nil
}

// ---- Set ----------------------------------------------------------------

type SetRequest struct {
	PartnerType string   `json:"partnerType"`
	PartnerID   int64    `json:"partnerId"`
	Categories  []string `json:"categories"`
}
type OkResponse struct {
	OK bool `json:"ok"`
}

//encore:api auth method=POST path=/charity/set
func Set(ctx context.Context, req *SetRequest) (*OkResponse, error) {
	if err := requirePriv(ctx); err != nil {
		return nil, err
	}
	if strings.TrimSpace(req.PartnerType) == "" || req.PartnerID == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "partnerType and partnerId are required"}
	}

	// desired set (valid + deduped)
	desired := map[string]bool{}
	for _, c := range req.Categories {
		if isValid(c) {
			desired[c] = true
		}
	}

	// existing set
	existing := map[string]bool{}
	rows, err := appdb.SQLDB.QueryContext(ctx,
		`SELECT category FROM partner_charity WHERE partner_type=$1 AND partner_id=$2`,
		req.PartnerType, req.PartnerID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err != nil {
			rows.Close()
			return nil, err
		}
		existing[c] = true
	}
	rows.Close()

	// delete removed (preserve created_at on unchanged rows)
	for c := range existing {
		if !desired[c] {
			if _, err := appdb.SQLDB.ExecContext(ctx,
				`DELETE FROM partner_charity WHERE partner_type=$1 AND partner_id=$2 AND category=$3`,
				req.PartnerType, req.PartnerID, c); err != nil {
				return nil, err
			}
		}
	}
	// insert newly added
	for c := range desired {
		if !existing[c] {
			if _, err := appdb.SQLDB.ExecContext(ctx,
				`INSERT INTO partner_charity (partner_type, partner_id, category) VALUES ($1,$2,$3)
				 ON CONFLICT DO NOTHING`,
				req.PartnerType, req.PartnerID, c); err != nil {
				return nil, err
			}
		}
	}
	return &OkResponse{OK: true}, nil
}

// ---- Get (prefill on edit) ---------------------------------------------

type GetRequest struct {
	PartnerType string `query:"partnerType"`
	PartnerID   int64  `query:"partnerId"`
}
type GetResponse struct {
	Categories []string `json:"categories"`
}

//encore:api auth method=GET path=/charity/get
func Get(ctx context.Context, req *GetRequest) (*GetResponse, error) {
	if err := requirePriv(ctx); err != nil {
		return nil, err
	}
	out := []string{}
	rows, err := appdb.SQLDB.QueryContext(ctx,
		`SELECT category FROM partner_charity WHERE partner_type=$1 AND partner_id=$2`,
		req.PartnerType, req.PartnerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	set := map[string]bool{}
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err != nil {
			return nil, err
		}
		set[c] = true
	}
	// return in canonical order
	for _, c := range Categories {
		if set[c] {
			out = append(out, c)
		}
	}
	return &GetResponse{Categories: out}, rows.Err()
}

// ---- Tally (Analytics) --------------------------------------------------

type TallyRow struct {
	Category  string `json:"category"`
	ThisMonth int    `json:"thisMonth"`
	AllTime   int    `json:"allTime"`
}
type TallyRequest struct {
	Month string `query:"month"` // "YYYY-MM"; empty = current month
}
// ComboCount pairs a group (Adults/Children/Animals) with a sub focus
// (Health/Homes/Food) and counts partners who selected both.
type ComboCount struct {
	Group     string `json:"group"`
	Sub       string `json:"sub"`
	ThisMonth int    `json:"thisMonth"`
	AllTime   int    `json:"allTime"`
}
type TallyResponse struct {
	Month  string       `json:"month"`
	Rows   []TallyRow   `json:"rows"`
	Combos []ComboCount `json:"combos"`
}

//encore:api auth method=GET path=/charity/tally
func Tally(ctx context.Context, req *TallyRequest) (*TallyResponse, error) {
	if err := requirePriv(ctx); err != nil {
		return nil, err
	}
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	if m := strings.TrimSpace(req.Month); m != "" {
		if t, err := time.Parse("2006-01", m); err == nil {
			monthStart = time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
		}
	}
	monthEnd := monthStart.AddDate(0, 1, 0)

	rows := make([]TallyRow, 0, len(Categories))
	for _, c := range Categories {
		var thisMonth, allTime int
		_ = appdb.SQLDB.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM partner_charity WHERE category=$1 AND created_at >= $2 AND created_at < $3
			   AND (partner_type, partner_id) NOT IN `+appdb.TestRepEntitiesSubquery(),
			c, monthStart, monthEnd).Scan(&thisMonth)
		_ = appdb.SQLDB.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM partner_charity WHERE category=$1
			   AND (partner_type, partner_id) NOT IN `+appdb.TestRepEntitiesSubquery(), c).Scan(&allTime)
		rows = append(rows, TallyRow{Category: c, ThisMonth: thisMonth, AllTime: allTime})
	}

	// Combo matrix: count partners who chose BOTH a group and a sub. A partner
	// has one row per selected category, so we self-join partner_charity on the
	// same partner. "This month" keys off when the sub row was created (group +
	// sub are inserted together, so their timestamps match).
	combos := make([]ComboCount, 0, len(CharityGroups)*len(CharitySubs))
	for _, g := range CharityGroups {
		for _, s := range CharitySubs {
			var thisMonth, allTime int
			_ = appdb.SQLDB.QueryRowContext(ctx,
				`SELECT COUNT(*) FROM partner_charity gc
				 JOIN partner_charity sc
				   ON sc.partner_type = gc.partner_type AND sc.partner_id = gc.partner_id
				 WHERE gc.category = $1 AND sc.category = $2
				   AND sc.created_at >= $3 AND sc.created_at < $4
				   AND (gc.partner_type, gc.partner_id) NOT IN `+appdb.TestRepEntitiesSubquery(),
				g, s, monthStart, monthEnd).Scan(&thisMonth)
			_ = appdb.SQLDB.QueryRowContext(ctx,
				`SELECT COUNT(*) FROM partner_charity gc
				 JOIN partner_charity sc
				   ON sc.partner_type = gc.partner_type AND sc.partner_id = gc.partner_id
				 WHERE gc.category = $1 AND sc.category = $2
				   AND (gc.partner_type, gc.partner_id) NOT IN `+appdb.TestRepEntitiesSubquery(),
				g, s).Scan(&allTime)
			combos = append(combos, ComboCount{Group: g, Sub: s, ThisMonth: thisMonth, AllTime: allTime})
		}
	}

	return &TallyResponse{Month: monthStart.Format("2006-01"), Rows: rows, Combos: combos}, nil
}
