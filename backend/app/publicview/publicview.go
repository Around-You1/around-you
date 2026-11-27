package publicview

import (
	"context"
	"strings"

	"backend_encore/internal/appdb"
)

type ResolveRequest struct {
	Code string `query:"code"`
}

type ResolveResponse struct {
	Found bool   `json:"found"`
	Type  string `json:"type"`
	ID    int64  `json:"id"`
}

// Resolve maps a scanned profile reference code to the partner it belongs to so
// the public poster view (/view) can show that business without anyone signing
// in. Public — it returns only the id/type; the profile itself is fetched via
// the /public/<type> endpoints, which strip the Official-Use fields for
// non-privileged callers.
//
//encore:api public method=GET path=/public/resolve
func Resolve(ctx context.Context, req *ResolveRequest) (*ResolveResponse, error) {
	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" {
		return &ResolveResponse{}, nil
	}
	tables := []struct{ typ, name string }{
		{"restaurant", "restaurants"},
		{"service", "services"},
		{"attraction", "attractions"},
		{"retail", "retail"},
		{"nonprofit", "nonprofits"},
		{"accommodation", "accommodations"},
	}
	for _, t := range tables {
		var id int64
		err := appdb.SQLDB.QueryRowContext(ctx,
			"SELECT id FROM "+t.name+" WHERE upper(COALESCE(profile_reference_code,'')) = $1 AND is_active LIMIT 1",
			code).Scan(&id)
		if err == nil && id > 0 {
			return &ResolveResponse{Found: true, Type: t.typ, ID: id}, nil
		}
	}
	return &ResolveResponse{}, nil
}
