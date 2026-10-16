package appdb

import "strings"

// postalCentroids maps a South African postal code to the approximate centre
// (latitude, longitude) of the town it covers. It is focused on the Around You
// operating area — the West Coast of the Western Cape — so that a Local Guest,
// who supplies only a postal code at sign-in (never GPS), can be placed on the
// map and matched to partners by real distance instead of an exact postal-code
// string. A 50 km search radius is forgiving, so town-centre precision is ample.
//
// Codes not in this table fall back to exact postal-code matching, so unknown
// areas degrade gracefully rather than returning nothing.
var postalCentroids = map[string][2]float64{
	// --- Saldanha Bay Municipality ---
	"7380": {-32.9078, 17.9886}, // Vredenburg
	"7385": {-32.9078, 17.9886}, // Vredenburg (surrounds / Jacobsbaai area)
	"7395": {-33.0117, 17.9442}, // Saldanha
	"7390": {-32.7577, 18.0206}, // St Helena Bay
	"7381": {-32.8072, 17.8897}, // Paternoster
	"7357": {-33.0906, 18.0303}, // Langebaan
	"7355": {-33.0622, 18.3503}, // Hopefield
	// --- Bergrivier Municipality ---
	"7365": {-32.7836, 18.1636}, // Velddrif / Laaiplek
	"7350": {-32.7169, 18.2347}, // Dwarskersbos
	"7320": {-32.9064, 18.7569}, // Piketberg
	// --- Swartland Municipality ---
	"7310": {-33.1497, 18.6681}, // Moorreesburg
	"7300": {-33.4608, 18.7281}, // Malmesbury
	"7345": {-33.3858, 18.3847}, // Darling
	"7351": {-33.3406, 18.1553}, // Yzerfontein
	// --- Cederberg / Matzikama (northern West Coast) ---
	"7340": {-32.5872, 19.0153}, // Citrusdal
	"8135": {-32.1830, 18.8903}, // Clanwilliam
	"8130": {-32.0908, 18.3078}, // Lamberts Bay
	"8114": {-32.3119, 18.3344}, // Elands Bay
	"8160": {-31.6686, 18.5008}, // Vredendal
	"8165": {-31.5567, 18.3419}, // Lutzville
	"8170": {-31.6119, 18.7406}, // Vanrhynsdorp
	"8145": {-31.7822, 18.6300}, // Klawer
}

// PostalCentroid returns the approximate town centre for a postal code, and
// ok=false when the code is empty or not in the table.
func PostalCentroid(code string) (lat, lng float64, ok bool) {
	c := strings.TrimSpace(code)
	if c == "" {
		return 0, 0, false
	}
	v, found := postalCentroids[c]
	if !found {
		return 0, 0, false
	}
	return v[0], v[1], true
}

// SearcherCoords resolves the point to search FROM: real GPS coordinates when
// the client supplied them, otherwise the centre of the searcher's postal code.
func SearcherCoords(lat, lng float64, postalCode string) (float64, float64, bool) {
	if lat != 0 || lng != 0 {
		return lat, lng, true
	}
	return PostalCentroid(postalCode)
}

// EntityCoords resolves the point of a partner or accommodation: its own saved
// coordinates when present, otherwise the centre of its postal code — so mobile
// partners and profiles that were never geocoded can still be placed on the map.
func EntityCoords(lat, lng *float64, postalCode string) (float64, float64, bool) {
	if lat != nil && lng != nil && (*lat != 0 || *lng != 0) {
		return *lat, *lng, true
	}
	return PostalCentroid(postalCode)
}

// WithinRadius decides whether an entity falls inside the search area. It
// prefers a real distance match (using resolved coordinates on both sides) and
// falls back to an exact postal-code match when either side cannot be placed on
// the map (e.g. a postal code not yet in the centroid table).
func WithinRadius(searchLat, searchLng float64, haveSearch bool, eLat, eLng *float64, ePostal, wantPostal string, radiusKm float64) bool {
	if haveSearch {
		if elat, elng, haveEntity := EntityCoords(eLat, eLng, ePostal); haveEntity {
			if HaversineKm(searchLat, searchLng, elat, elng) <= radiusKm {
				return true
			}
		}
	}
	if wantPostal != "" && strings.ToLower(strings.TrimSpace(ePostal)) == wantPostal {
		return true
	}
	return false
}
