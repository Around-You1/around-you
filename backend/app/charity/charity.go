// Package charity records the charity a partner nominates in the Official Use
// section — captured as free text (name, address, contact number) — and reports
// them per province per month for the Admin Analytics page. One row per partner
// in charity_nominations; province + partner name are denormalised so the
// per-province report needs no cross-table joins.
package charity

import (
	"context"
	"database/sql"
	"sort"
	"strings"
	"time"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

func requirePriv(ctx context.Context) error {
	if !auth.IsPrivileged(ctx) {
		return &errs.Error{Code: errs.PermissionDenied, Message: "not permitted"}
	}
	return nil
}

// partnerNameProvince resolves a partner's display name and province so the
// nomination can be grouped by province in the report.
func partnerNameProvince(ctx context.Context, partnerType string, partnerID int64) (name, province string) {
	var q string
	switch partnerType {
	case "restaurant":
		q = "SELECT name, COALESCE(province,'') FROM restaurants WHERE id=$1"
	case "service":
		q = "SELECT name, COALESCE(province,'') FROM services WHERE id=$1"
	case "attraction":
		q = "SELECT name, COALESCE(province,'') FROM attractions WHERE id=$1"
	case "accommodation":
		q = "SELECT name, COALESCE(province,'') FROM accommodations WHERE id=$1"
	case "estate_agency":
		q = "SELECT name, COALESCE(province,'') FROM estate_agencies WHERE id=$1"
	case "estate_agent":
		q = `SELECT ea.name, COALESCE(ag.province,'')
		     FROM estate_agents ea LEFT JOIN estate_agencies ag ON ag.id = ea.agency_id
		     WHERE ea.id=$1`
	default:
		return "", ""
	}
	_ = appdb.SQLDB.QueryRowContext(ctx, q, partnerID).Scan(&name, &province)
	return name, province
}

// ---- Set / clear a partner's charity nomination -------------------------

type SetRequest struct {
	PartnerType string `json:"partnerType"`
	PartnerID   int64  `json:"partnerId"`
	Name        string `json:"name"`
	Address     string `json:"address"`
	Contact     string `json:"contact"`
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
	name := strings.TrimSpace(req.Name)
	address := strings.TrimSpace(req.Address)
	contact := strings.TrimSpace(req.Contact)

	// Nothing entered → clear any existing nomination.
	if name == "" && address == "" && contact == "" {
		_, err := appdb.SQLDB.ExecContext(ctx,
			`DELETE FROM charity_nominations WHERE partner_type=$1 AND partner_id=$2`,
			req.PartnerType, req.PartnerID)
		if err != nil {
			return nil, err
		}
		return &OkResponse{OK: true}, nil
	}

	partnerName, province := partnerNameProvince(ctx, req.PartnerType, req.PartnerID)
	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO charity_nominations
		  (partner_type, partner_id, partner_name, province, charity_name, charity_address, charity_contact, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
		ON CONFLICT (partner_type, partner_id) DO UPDATE SET
		  partner_name    = EXCLUDED.partner_name,
		  province        = EXCLUDED.province,
		  charity_name    = EXCLUDED.charity_name,
		  charity_address = EXCLUDED.charity_address,
		  charity_contact = EXCLUDED.charity_contact,
		  created_at      = now(),
		  updated_at      = now()`,
		req.PartnerType, req.PartnerID, partnerName, province, name, address, contact,
	); err != nil {
		return nil, err
	}
	return &OkResponse{OK: true}, nil
}

// ---- Get (prefill on edit) ---------------------------------------------

type GetRequest struct {
	PartnerType string `query:"partnerType"`
	PartnerID   int64  `query:"partnerId"`
}
type GetResponse struct {
	Name    string `json:"name"`
	Address string `json:"address"`
	Contact string `json:"contact"`
}

//encore:api auth method=GET path=/charity/get
func Get(ctx context.Context, req *GetRequest) (*GetResponse, error) {
	if err := requirePriv(ctx); err != nil {
		return nil, err
	}
	var name, address, contact sql.NullString
	_ = appdb.SQLDB.QueryRowContext(ctx,
		`SELECT charity_name, charity_address, charity_contact FROM charity_nominations WHERE partner_type=$1 AND partner_id=$2`,
		req.PartnerType, req.PartnerID).Scan(&name, &address, &contact)
	return &GetResponse{Name: name.String, Address: address.String, Contact: contact.String}, nil
}

// ---- By-province monthly report ----------------------------------------

type CharityRow struct {
	Name     string   `json:"name"`
	Address  string   `json:"address"`
	Contact  string   `json:"contact"`
	Partners []string `json:"partners"`
}
type ProvinceCharities struct {
	Province  string       `json:"province"`
	Charities []CharityRow `json:"charities"`
}
type ByProvinceRequest struct {
	Month string `query:"month"` // "YYYY-MM"; empty = current month
}
type ByProvinceResponse struct {
	Month     string              `json:"month"`
	Provinces []ProvinceCharities `json:"provinces"`
}

//encore:api auth method=GET path=/charity/by-province
func ByProvince(ctx context.Context, req *ByProvinceRequest) (*ByProvinceResponse, error) {
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

	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT COALESCE(province,''), charity_name, COALESCE(charity_address,''), COALESCE(charity_contact,''), COALESCE(partner_name,'')
		FROM charity_nominations
		WHERE charity_name <> '' AND created_at >= $1 AND created_at < $2
		  AND (partner_type, partner_id) NOT IN `+appdb.TestRepEntitiesSubquery()+`
		ORDER BY COALESCE(province,''), lower(charity_name), COALESCE(partner_name,'')`,
		monthStart, monthEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// province -> ordered charities; keyed by lower(name) to merge duplicates.
	type provAgg struct {
		order    []string // charity keys in first-seen order
		byKey    map[string]*CharityRow
		province string
	}
	provOrder := []string{}
	provs := map[string]*provAgg{}

	for rows.Next() {
		var province, cName, cAddr, cContact, pName string
		if err := rows.Scan(&province, &cName, &cAddr, &cContact, &pName); err != nil {
			return nil, err
		}
		pa := provs[province]
		if pa == nil {
			pa = &provAgg{byKey: map[string]*CharityRow{}, province: province}
			provs[province] = pa
			provOrder = append(provOrder, province)
		}
		key := strings.ToLower(strings.TrimSpace(cName))
		cr := pa.byKey[key]
		if cr == nil {
			cr = &CharityRow{Name: cName, Address: cAddr, Contact: cContact, Partners: []string{}}
			pa.byKey[key] = cr
			pa.order = append(pa.order, key)
		}
		if strings.TrimSpace(pName) != "" {
			cr.Partners = append(cr.Partners, pName)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	sort.Strings(provOrder)
	out := make([]ProvinceCharities, 0, len(provOrder))
	for _, p := range provOrder {
		pa := provs[p]
		charities := make([]CharityRow, 0, len(pa.order))
		for _, k := range pa.order {
			charities = append(charities, *pa.byKey[k])
		}
		out = append(out, ProvinceCharities{Province: p, Charities: charities})
	}
	return &ByProvinceResponse{Month: monthStart.Format("2006-01"), Provinces: out}, nil
}
