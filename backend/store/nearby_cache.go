package store

import (
	"time"

	"backend_encore/internal/appdb"
	"backend_encore/internal/cache"
)

// Short-lived caches for the public "nearby" lists. Each of these endpoints
// fetches every active partner in a category and filters by distance in Go, so
// the query result is identical for every caller — ideal to cache for a few
// seconds so a launch-day burst is served from memory instead of Postgres.
const nearbyTTL = 60 * time.Second

var (
	restaurantNearbyCache = cache.NewTTL[string, []appdb.Restaurant](nearbyTTL)
	serviceNearbyCache    = cache.NewTTL[string, []appdb.ServiceData](nearbyTTL)
	retailNearbyCache     = cache.NewTTL[string, []appdb.ServiceData](nearbyTTL)
	nonprofitNearbyCache  = cache.NewTTL[string, []appdb.ServiceData](nearbyTTL)
	attractionNearbyCache = cache.NewTTL[string, []appdb.AttractionData](nearbyTTL)
	accommodationLocalsCache = cache.NewTTL[string, []appdb.Accommodation](nearbyTTL)
)
