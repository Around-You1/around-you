// Package demovis decides whether a signed-in guest is a DEMO guest whose
// partner listings must be restricted to a fixed demo set (see appdb
// demopolicy). Kept separate from appdb because it needs the auth context,
// which appdb must not import.
package demovis

import (
	"context"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
)

// IsRestrictedGuest reports whether the caller is a guest signed in via the demo
// Test Guesthouse accommodation. Such a guest sees ONLY the demo partners.
func IsRestrictedGuest(ctx context.Context) bool {
	d := auth.FromContext(ctx)
	if d == nil || d.User == nil || d.User.Role != "Guest" || d.User.AccommodationID == 0 {
		return false
	}
	var code string
	if err := appdb.SQLDB.QueryRowContext(ctx,
		"SELECT COALESCE(profile_reference_code,'') FROM accommodations WHERE id = $1",
		d.User.AccommodationID,
	).Scan(&code); err != nil {
		return false
	}
	return appdb.IsDemoAccommodationCode(code)
}
