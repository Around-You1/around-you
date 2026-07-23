// Package stats implements the admin dashboard's aggregate counts
// (AdminDashboard.tsx's `backend.stats.get()`). Accommodation counts come
// from Postgres now that accommodation has migrated (Phase 5); restaurant/
// service/attraction still read the in-memory appdb.DB store until they
// migrate too.
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

//encore:api auth method=GET path=/stats
func Get(ctx context.Context) (*Response, error) {
	resp := &Response{}

	var total, active int
	row := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT count(*), count(*) FILTER (WHERE is_active) FROM accommodations`)
	if err := row.Scan(&total, &active); err != nil {
		return nil, err
	}
	resp.TotalAccommodations = total
	resp.AccommodationStats = appdb.CategoryStats{TotalCount: total, ActiveCount: active, InactiveCount: total - active}

	appdb.DB.Lock()
	defer appdb.DB.Unlock()

	for _, r := range appdb.DB.Restaurants {
		resp.TotalRestaurants++
		resp.RestaurantStats.TotalCount++
		if r.IsActive {
			resp.RestaurantStats.ActiveCount++
		} else {
			resp.RestaurantStats.InactiveCount++
		}
	}

	for _, s := range appdb.DB.Services {
		resp.TotalServices++
		resp.ServiceStats.TotalCount++
		if s.IsActive {
			resp.ServiceStats.ActiveCount++
		} else {
			resp.ServiceStats.InactiveCount++
		}
	}

	for _, a := range appdb.DB.Attractions {
		resp.TotalAttractions++
		resp.AttractionStats.TotalCount++
		if a.IsActive {
			resp.AttractionStats.ActiveCount++
		} else {
			resp.AttractionStats.InactiveCount++
		}
	}

	// "Partners" = restaurants + services + attractions. Accommodations are
	// guest lodging (role "Guest" at login), not partner listings, so they're
	// excluded here — matching the Restaurant/Service/Attraction-only
	// "Partner" role used throughout auth.go.
	resp.TotalPartners = resp.TotalRestaurants + resp.TotalServices + resp.TotalAttractions
	resp.ActivePartners = resp.RestaurantStats.ActiveCount + resp.ServiceStats.ActiveCount + resp.AttractionStats.ActiveCount
	resp.InactivePartners = resp.RestaurantStats.InactiveCount + resp.ServiceStats.InactiveCount + resp.AttractionStats.InactiveCount

	return resp, nil
}
