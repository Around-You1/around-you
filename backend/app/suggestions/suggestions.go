// Package suggestions powers the "My Suggestions" banner: each partner or
// accommodation profile can recommend up to 10 OTHER nearby businesses
// (within 50km). Visitors see those recommendations on the profile and can
// tap through to them. Stored in the profile_suggestions table.
package suggestions

import (
	"context"
	"database/sql"
	"sort"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/app/editcode"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// radiusKm is how far a profile may reach when recommending others.
const radiusKm = 50.0

// maxSuggestions caps how many recommendations a profile may save.
const maxSuggestions = 10

// tableFor maps an entity type to its (fixed, never user-injected) table name.
var tableFor = map[string]string{
	"restaurant":    "restaurants",
	"service":       "services",
	"attraction":    "attractions",
	"accommodation": "accommodations",
	"retail":        "retail",
	"nonprofit":     "nonprofits",
}

// Item is one business, as shown in the picker or the banner.
type Item struct {
	Type string `json:"type"`
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// Ref is one chosen recommendation on save.
type Ref struct {
	Type string `json:"type"`
	ID   int64  `json:"id"`
}

type NearbyRequest struct {
	OwnerType string `query:"ownerType"`
	OwnerID   int64  `query:"ownerId"`
}
type NearbyResponse struct {
	Items []Item `json:"items"`
}

type GetRequest struct {
	OwnerType string `query:"ownerType"`
	OwnerID   int64  `query:"ownerId"`
}
type GetResponse struct {
	Items []Item `json:"items"`
}

type SaveRequest struct {
	OwnerType string `json:"ownerType"`
	OwnerID   int64  `json:"ownerId"`
	EditCode  string `json:"editCode"`
	Items     []Ref  `json:"items"`
}
type SaveResponse struct {
	Saved int `json:"saved"`
}

func validType(t string) bool {
	_, ok := tableFor[t]
	return ok
}

// coords returns the lat/lng of one entity (ok=false when either is null).
func coords(ctx context.Context, entityType string, id int64) (lat, lng float64, ok bool, err error) {
	table, valid := tableFor[entityType]
	if !valid {
		return 0, 0, false, &errs.Error{Code: errs.InvalidArgument, Message: "unknown profile type"}
	}
	var la, lo sql.NullFloat64
	row := appdb.SQLDB.QueryRowContext(ctx,
		"SELECT latitude, longitude FROM "+table+" WHERE id = $1", id)
	if err := row.Scan(&la, &lo); err != nil {
		if err == sql.ErrNoRows {
			return 0, 0, false, &errs.Error{Code: errs.NotFound, Message: "profile not found"}
		}
		return 0, 0, false, err
	}
	if !la.Valid || !lo.Valid {
		return 0, 0, false, nil
	}
	return la.Float64, lo.Float64, true, nil
}

type nearRow struct {
	id   int64
	name string
	lat  sql.NullFloat64
	lng  sql.NullFloat64
	dist float64
}

// Nearby lists active businesses within 50km of the owner profile, nearest
// first, excluding the owner itself. Used by the owner's picker.
//
//encore:api auth method=GET path=/suggestions/nearby
func Nearby(ctx context.Context, req *NearbyRequest) (*NearbyResponse, error) {
	if d := auth.FromContext(ctx); d == nil || d.User == nil {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "sign in first"}
	}
	if !validType(req.OwnerType) {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "unknown profile type"}
	}
	oLat, oLng, ok, err := coords(ctx, req.OwnerType, req.OwnerID)
	if err != nil {
		return nil, err
	}
	if !ok {
		// Owner has no coordinates — we can't measure distance, so return none.
		return &NearbyResponse{Items: []Item{}}, nil
	}

	var out []Item
	for _, typ := range []string{"restaurant", "service", "attraction", "accommodation", "retail", "nonprofit"} {
		table := tableFor[typ]
		rows, err := appdb.SQLDB.QueryContext(ctx,
			"SELECT id, name, latitude, longitude FROM "+table+" WHERE is_active = true")
		if err != nil {
			return nil, err
		}
		var cands []nearRow
		for rows.Next() {
			var r nearRow
			if err := rows.Scan(&r.id, &r.name, &r.lat, &r.lng); err != nil {
				rows.Close()
				return nil, err
			}
			if typ == req.OwnerType && r.id == req.OwnerID {
				continue // never suggest yourself
			}
			if !r.lat.Valid || !r.lng.Valid {
				continue
			}
			r.dist = appdb.HaversineKm(oLat, oLng, r.lat.Float64, r.lng.Float64)
			if r.dist <= radiusKm {
				cands = append(cands, r)
			}
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, err
		}
		sort.Slice(cands, func(i, j int) bool { return cands[i].dist < cands[j].dist })
		for _, c := range cands {
			name := strings.TrimSpace(c.name)
			if name == "" {
				continue
			}
			out = append(out, Item{Type: typ, ID: c.id, Name: name})
		}
	}
	if out == nil {
		out = []Item{}
	}
	return &NearbyResponse{Items: out}, nil
}

// nameFor looks up an active entity's display name (ok=false if missing/inactive).
func nameFor(ctx context.Context, entityType string, id int64) (string, bool, error) {
	table, valid := tableFor[entityType]
	if !valid {
		return "", false, nil
	}
	var name string
	row := appdb.SQLDB.QueryRowContext(ctx,
		"SELECT name FROM "+table+" WHERE id = $1 AND is_active = true", id)
	if err := row.Scan(&name); err != nil {
		if err == sql.ErrNoRows {
			return "", false, nil
		}
		return "", false, err
	}
	return strings.TrimSpace(name), true, nil
}

// Get returns the owner's saved recommendations, resolved to current names and
// skipping any that have since been removed or deactivated. Used by the banner.
//
//encore:api auth method=GET path=/suggestions
func Get(ctx context.Context, req *GetRequest) (*GetResponse, error) {
	if d := auth.FromContext(ctx); d == nil || d.User == nil {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "sign in first"}
	}
	if !validType(req.OwnerType) {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "unknown profile type"}
	}
	rows, err := appdb.SQLDB.QueryContext(ctx,
		"SELECT target_type, target_id FROM profile_suggestions WHERE owner_type = $1 AND owner_id = $2 ORDER BY position, created_at",
		req.OwnerType, req.OwnerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Item
	for rows.Next() {
		var t string
		var id int64
		if err := rows.Scan(&t, &id); err != nil {
			return nil, err
		}
		name, ok, err := nameFor(ctx, t, id)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		out = append(out, Item{Type: t, ID: id, Name: name})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if out == nil {
		out = []Item{}
	}
	return &GetResponse{Items: out}, nil
}

// Save replaces the owner's recommendation list. Authorised either by a matching
// Partner session or by the profile's edit code (accommodations and any other
// owner). Caps the list at 10 and ignores unknown types / self-references.
//
//encore:api auth method=POST path=/suggestions/save
func Save(ctx context.Context, req *SaveRequest) (*SaveResponse, error) {
	d := auth.FromContext(ctx)
	if d == nil || d.User == nil {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "sign in first"}
	}
	if !validType(req.OwnerType) {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "unknown profile type"}
	}

	// Authorise: a Partner editing their own entity, an Admin, or a correct edit code.
	authorised := false
	switch d.User.Role {
	case "SuperAdmin", "Admin":
		authorised = true
	case "Partner":
		if d.User.EntityType == req.OwnerType && d.User.EntityID == req.OwnerID {
			authorised = true
		}
	}
	if !authorised {
		ok, err := editcode.CheckCode(ctx, req.OwnerType, req.OwnerID, req.EditCode)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, &errs.Error{Code: errs.PermissionDenied, Message: "that edit code doesn't match this profile"}
		}
	}

	// Clean + de-dupe the incoming list, dropping bad types and self-references.
	seen := map[string]bool{}
	var clean []Ref
	for _, it := range req.Items {
		if !validType(it.Type) {
			continue
		}
		if it.Type == req.OwnerType && it.ID == req.OwnerID {
			continue
		}
		key := it.Type + ":" + itoa(it.ID)
		if seen[key] {
			continue
		}
		seen[key] = true
		clean = append(clean, it)
		if len(clean) >= maxSuggestions {
			break
		}
	}

	tx, err := appdb.SQLDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx,
		"DELETE FROM profile_suggestions WHERE owner_type = $1 AND owner_id = $2",
		req.OwnerType, req.OwnerID); err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	for i, it := range clean {
		if _, err := tx.ExecContext(ctx,
			"INSERT INTO profile_suggestions (owner_type, owner_id, target_type, target_id, position) VALUES ($1,$2,$3,$4,$5)",
			req.OwnerType, req.OwnerID, it.Type, it.ID, i); err != nil {
			_ = tx.Rollback()
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &SaveResponse{Saved: len(clean)}, nil
}

// itoa avoids importing strconv for one small use.
func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
