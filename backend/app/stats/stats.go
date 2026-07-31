// Package stats implements the admin dashboard's aggregate counts
// (AdminDashboard.tsx's `backend.stats.get()`). All four entity types now
// read from Postgres — Accommodation, Restaurant, Service, and Attraction
// have all migrated off the in-memory appdb.DB store.
package stats

import (
	"context"

	"backend_encore/internal/appdb"
)

type Response struct {
	TotalAccommodations int `json:"totalAccommodations"`
	TotalRestaurants    int `json:"totalRestaurants"`
	TotalServices       int `json:"totalServices"`
	TotalAttractions    int `json:"totalAttractions"`
	TotalPartners       int `json:"totalPartners"`
	ActivePartners      int `json:"activePartners"`
	InactivePartners    int `json:"inactivePartners"`

	AccommodationStats appdb.CategoryStats `json:"accommodationStats"`
	RestaurantStats    appdb.CategoryStats `json:"restaurantStats"`
	ServiceStats       appdb.CategoryStats `json:"serviceStats"`
	AttractionStats    appdb.CategoryStats `json:"attractionStats"`
}

func countTable(ctx context.Context, table string) (total, active int, err error) {
	row := appdb.SQLDB.QueryRowContext(ctx,
		"SELECT count(*), count(*) FILTER (WHERE is_active) FROM "+table)
	err = row.Scan(&total, &active)
	return total, active, err
}

//encore:api auth method=GET path=/stats
func Get(ctx context.Context) (*Response, error) {
	resp := &Response{}

	accTotal, accActive, err := countTable(ctx, "accommodations")
	if err != nil {
		return nil, err
	}
	resp.TotalAccommodations = accTotal
	resp.AccommodationStats = appdb.CategoryStats{TotalCount: accTotal, ActiveCount: accActive, InactiveCount: accTotal - accActive}

	restTotal, restActive, err := countTable(ctx, "restaurants")
	if err != nil {
		return nil, err
	}
	resp.TotalRestaurants = restTotal
	resp.RestaurantStats = appdb.CategoryStats{TotalCount: restTotal, ActiveCount: restActive, InactiveCount: restTotal - restActive}

	svcTotal, svcActive, err := countTable(ctx, "services")
	if err != nil {
		return nil, err
	}
	resp.TotalServices = svcTotal
	resp.ServiceStats = appdb.CategoryStats{TotalCount: svcTotal, ActiveCount: svcActive, InactiveCount: svcTotal - svcActive}

	attTotal, attActive, err := countTable(ctx, "attractions")
	if err != nil {
		return nil, err
	}
	resp.TotalAttractions = attTotal
	resp.AttractionStats = appdb.CategoryStats{TotalCount: attTotal, ActiveCount: attActive, InactiveCount: attTotal - attActive}

	// "Partners" = restaurants + services + attractions. Accommodations are
	// guest lodging (role "Guest" at login), not partner listings, so
	// they're excluded here — matching the Restaurant/Service/Attraction-only
	// "Partner" role used throughout auth.go.
	resp.TotalPartners = resp.TotalRestaurants + resp.TotalServices + resp.TotalAttractions
	resp.ActivePartners = resp.RestaurantStats.ActiveCount + resp.ServiceStats.ActiveCount + resp.AttractionStats.ActiveCount
	resp.InactivePartners = resp.RestaurantStats.InactiveCount + resp.ServiceStats.InactiveCount + resp.AttractionStats.InactiveCount

	return resp, nil
}
