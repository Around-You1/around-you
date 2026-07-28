package appdb

import (
	"crypto/rand"
	"math"
)

// HaversineKm returns the great-circle distance between two points in km.
// Used by restaurant/service/attraction listNearby endpoints.
func HaversineKm(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadiusKm = 6371.0
	toRad := func(deg float64) float64 { return deg * math.Pi / 180 }

	dLat := toRad(lat2 - lat1)
	dLon := toRad(lon2 - lon1)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(toRad(lat1))*math.Cos(toRad(lat2))*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadiusKm * c
}

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I to avoid ambiguity

// RandomCode generates a random alphanumeric code of the given length, used
// for access codes, partner codes, and profile reference codes.
func RandomCode(length int) string {
	b := make([]byte, length)
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		// crypto/rand failing is effectively unrecoverable; fall back to a
		// fixed pattern rather than panicking mid-request.
		for i := range b {
			b[i] = codeAlphabet[i%len(codeAlphabet)]
		}
		return string(b)
	}
	for i, v := range buf {
		b[i] = codeAlphabet[int(v)%len(codeAlphabet)]
	}
	return string(b)
}
