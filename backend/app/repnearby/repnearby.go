// Package repnearby powers the Rep Academy "partners near a postal code" tool:
// a signed-in rep enters a postal code and sees the business names of every
// partner within a 5km radius, grouped by category.
package repnearby

import (
	"context"
	"database/sql"
	"sort"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

const radiusKm = 5.0

type PartnersNearRequest struct {
	PostalCode string `query:"postalCode"`
}

type PartnersNearResponse struct {
	Accommodations []string `json:"accommodations"`
	Restaurants    []string `json:"restaurants"`
	Services       []string `json:"services"`
	Attractions    []string `json:"attractions"`
	RealEstate     []string `json:"realEstate"`
}

type row struct {
	name   string
	lat    sql.NullFloat64
	lng    sql.NullFloat64
	postal string
}

// fetch reads active rows (name, coordinates, postal code) from one partner
// table. Table names are fixed constants below — never user input.
func fetch(ctx context.Context, table string) ([]row, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx,
		"SELECT name, latitude, longitude, COALESCE(postal_code, '') FROM "+table+" WHERE is_active = true")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.name, &r.lat, &r.lng, &r.postal); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func normPostal(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

// PartnersNear returns the business names of partners within 5km of the given
// postal code, grouped by category. Rep-only.
//
//encore:api auth method=GET path=/rep/partners-near
func PartnersNear(ctx context.Context, req *PartnersNearRequest) (*PartnersNearResponse, error) {
	d := auth.FromContext(ctx)
	if d == nil || d.User == nil || d.User.Role != "Rep" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a signed-in rep can use this"}
	}
	code := normPostal(req.PostalCode)
	if code == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "enter a postal code"}
	}

	// Category key -> partner table.
	tables := []struct{ key, table string }{
		{"accommodations", "accommodations"},
		{"restaurants", "restaurants"},
		{"services", "services"},
		{"attractions", "attractions"},
		{"realEstate", "estate_agencies"},
	}
	data := map[string][]row{}
	for _, t := range tables {
		rs, err := fetch(ctx, t.table)
		if err != nil {
			return nil, err
		}
		data[t.key] = rs
	}

	// We have no postal-code -> coordinate lookup, so the 5km radius is anchored
	// on partners that already sit in the entered postal code: their average
	// position is the search centre.
	var sumLat, sumLng float64
	var n int
	for _, rs := range data {
		for _, r := range rs {
			if r.lat.Valid && r.lng.Valid && normPostal(r.postal) == code {
				sumLat += r.lat.Float64
				sumLng += r.lng.Float64
				n++
			}
		}
	}
	hasCenter := n > 0
	var cLat, cLng float64
	if hasCenter {
		cLat = sumLat / float64(n)
		cLng = sumLng / float64(n)
	}

	pick := func(rs []row) []string {
		seen := map[string]bool{}
		names := []string{}
		for _, r := range rs {
			name := strings.TrimSpace(r.name)
			if name == "" {
				continue
			}
			// Always include partners sharing the postal code; when we have a
			// centre, also include anyone within 5km of it.
			include := normPostal(r.postal) == code
			if !include && hasCenter && r.lat.Valid && r.lng.Valid {
				if appdb.HaversineKm(cLat, cLng, r.lat.Float64, r.lng.Float64) <= radiusKm {
					include = true
				}
			}
			if include {
				k := strings.ToLower(name)
				if !seen[k] {
					seen[k] = true
					names = append(names, name)
				}
			}
		}
		sort.Strings(names)
		return names
	}

	return &PartnersNearResponse{
		Accommodations: pick(data["accommodations"]),
		Restaurants:    pick(data["restaurants"]),
		Services:       pick(data["services"]),
		Attractions:    pick(data["attractions"]),
		RealEstate:     pick(data["realEstate"]),
	}, nil
}
