// Package emergency powers the "Emergency" button on the Guest and Local pages.
// For a given postal code it returns the key contacts — Ambulance, Police,
// Fire, NSRI, Snake Catchers, Doctor and Vet. Doctor/Vet prefer the highest-rated matching service
// partner in the postal code; everything else (and the Doctor/Vet fallback)
// comes from the emergency numbers guesthouses capture on their profiles.
package emergency

import (
	"context"
	"database/sql"
	"encoding/json"
	"sort"
	"strings"

	"github.com/lib/pq"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

type Contact struct {
	Label   string `json:"label"`
	Name    string `json:"name,omitempty"`
	Number  string `json:"number"`
	Address string `json:"address,omitempty"`
	Source  string `json:"source"` // "partner" | "guesthouse"
}

type Request struct {
	PostalCode      string `query:"postalCode"`
	AccommodationID int64  `query:"accommodationId"` // optional: the guest's own guesthouse (prioritised)
}

type Response struct {
	Ambulance     *Contact `json:"ambulance,omitempty"`
	Police        *Contact `json:"police,omitempty"`
	Fire          *Contact `json:"fire,omitempty"`
	Nsri          *Contact `json:"nsri,omitempty"`
	SnakeCatchers *Contact `json:"snakeCatchers,omitempty"`
	Doctor        *Contact `json:"doctor,omitempty"`
	Vet           *Contact `json:"vet,omitempty"`
}

func norm(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

type emEntry struct {
	Name    string `json:"name"`
	Number  string `json:"number"`
	Address string `json:"address"`
}

type accRow struct {
	id        int64
	name      string
	ambulance string
	privAmb   string
	police    string
	fire      string
	doctorC   string
	vetC      string
	snake     string
	nsri      string
	doctors   []emEntry
	vets      []emEntry
	lat       *float64
	lng       *float64
	postal    string
	own       bool
}

// Contacts returns the five emergency contacts for a postal code.
//
//encore:api auth method=GET path=/emergency/contacts
func Contacts(ctx context.Context, req *Request) (*Response, error) {
	if d := auth.FromContext(ctx); d == nil || d.User == nil {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "sign in first"}
	}
	code := norm(req.PostalCode)
	if code == "" && req.AccommodationID == 0 {
		return &Response{}, nil
	}

	accs, err := loadAccommodations(ctx, code, req.AccommodationID)
	if err != nil {
		return nil, err
	}

	resp := &Response{}

	// Ambulance: own guesthouse public → any public → own private → any private.
	if c := firstField(accs, func(a accRow) string { return a.ambulance }); c != "" {
		resp.Ambulance = &Contact{Label: "Ambulance", Number: c, Source: "guesthouse"}
	} else if c := firstField(accs, func(a accRow) string { return a.privAmb }); c != "" {
		resp.Ambulance = &Contact{Label: "Ambulance (Private)", Number: c, Source: "guesthouse"}
	}
	if c := firstField(accs, func(a accRow) string { return a.police }); c != "" {
		resp.Police = &Contact{Label: "Police", Number: c, Source: "guesthouse"}
	}
	if c := firstField(accs, func(a accRow) string { return a.fire }); c != "" {
		resp.Fire = &Contact{Label: "Fire Department", Number: c, Source: "guesthouse"}
	}
	if c := firstField(accs, func(a accRow) string { return a.nsri }); c != "" {
		resp.Nsri = &Contact{Label: "NSRI (Sea Rescue)", Number: c, Source: "guesthouse"}
	}
	if c := firstField(accs, func(a accRow) string { return a.snake }); c != "" {
		resp.SnakeCatchers = &Contact{Label: "Snake Catchers", Number: c, Source: "guesthouse"}
	}

	// Doctor: highest-rated matching service partner (postal-code wide), else the
	// guesthouse's own doctor contact.
	if code != "" {
		resp.Doctor = bestPartner(ctx, code, []string{"Medical Services", "Doctor / GP"}, "Doctor")
	}
	if resp.Doctor == nil {
		resp.Doctor = guesthousePerson(accs, "Doctor", func(a accRow) ([]emEntry, string) { return a.doctors, a.doctorC })
	}
	// Vet: highest-rated Veterinary partner, else guesthouse vet.
	if code != "" {
		resp.Vet = bestPartner(ctx, code, []string{"Veterinary"}, "Vet")
	}
	if resp.Vet == nil {
		resp.Vet = guesthousePerson(accs, "Vet", func(a accRow) ([]emEntry, string) { return a.vets, a.vetC })
	}

	return resp, nil
}

func loadAccommodations(ctx context.Context, code string, ownID int64) ([]accRow, error) {
	const cols = `id, COALESCE(name,''),
		COALESCE(ambulance_contact,''), COALESCE(private_ambulance_contact,''),
		COALESCE(police_contact,''), COALESCE(fire_department_contact,''),
		COALESCE(doctor_contact,''), COALESCE(vet_contact,''),
		COALESCE(snake_catchers_contact,''), COALESCE(nsri_contact,''),
		COALESCE(doctors,'[]'::jsonb), COALESCE(vets,'[]'::jsonb),
		latitude, longitude, COALESCE(postal_code,'')`

	seen := map[int64]bool{}
	var all []accRow
	scan := func(rows *sql.Rows) error {
		defer rows.Close()
		for rows.Next() {
			var a accRow
			var docsRaw, vetsRaw []byte
			if err := rows.Scan(&a.id, &a.name, &a.ambulance, &a.privAmb, &a.police, &a.fire,
				&a.doctorC, &a.vetC, &a.snake, &a.nsri, &docsRaw, &vetsRaw, &a.lat, &a.lng, &a.postal); err != nil {
				return err
			}
			if seen[a.id] {
				continue
			}
			seen[a.id] = true
			_ = json.Unmarshal(docsRaw, &a.doctors)
			_ = json.Unmarshal(vetsRaw, &a.vets)
			a.own = ownID != 0 && a.id == ownID
			all = append(all, a)
		}
		return rows.Err()
	}

	// All active, non-test-named guesthouses. We filter to the search area in Go
	// using real distance (own coordinates, else postal-code centroid) so a Local
	// is matched to every guesthouse within ~50 km — not only one whose postal
	// code is character-for-character identical. (Test partners are excluded by
	// NAME only; real partners self-onboarded under the default rep must count.)
	rows, err := appdb.SQLDB.QueryContext(ctx,
		"SELECT "+cols+" FROM accommodations WHERE is_active = true AND lower(trim(name)) !~ '^test([^a-z]|$)'")
	if err != nil {
		return nil, err
	}
	if err := scan(rows); err != nil {
		return nil, err
	}

	// Always include the guest's OWN guesthouse by id, regardless of its postal
	// code or distance (it may be blank or differ) — unless it is a test profile.
	if ownID != 0 && !seen[ownID] {
		orows, err := appdb.SQLDB.QueryContext(ctx,
			"SELECT "+cols+" FROM accommodations WHERE id = $1 AND lower(trim(name)) !~ '^test([^a-z]|$)'", ownID)
		if err != nil {
			return nil, err
		}
		if err := scan(orows); err != nil {
			return nil, err
		}
	}

	// Keep the guest's own guesthouse plus every guesthouse within 50 km of the
	// searcher's postal code.
	wantPostal := norm(code)
	searchLat, searchLng, haveSearch := appdb.SearcherCoords(0, 0, code)
	const radiusKm = 50.0
	var out []accRow
	for _, a := range all {
		if a.own || appdb.WithinRadius(searchLat, searchLng, haveSearch, a.lat, a.lng, a.postal, wantPostal, radiusKm) {
			out = append(out, a)
		}
	}

	// Guest's own guesthouse first.
	sort.SliceStable(out, func(i, j int) bool { return out[i].own && !out[j].own })
	return out, nil
}

// firstField returns the first non-empty value of a field across accommodations
// (own guesthouse first thanks to the sort above).
func firstField(accs []accRow, get func(accRow) string) string {
	for _, a := range accs {
		if v := strings.TrimSpace(get(a)); v != "" {
			return v
		}
	}
	return ""
}

// guesthousePerson builds a Doctor/Vet contact from guesthouse data: the first
// entry (with a number) from the multi-entry list, else the legacy single field.
func guesthousePerson(accs []accRow, label string, get func(accRow) ([]emEntry, string)) *Contact {
	for _, a := range accs {
		list, legacy := get(a)
		for _, e := range list {
			if strings.TrimSpace(e.Number) != "" {
				return &Contact{Label: label, Name: strings.TrimSpace(e.Name), Number: strings.TrimSpace(e.Number), Address: strings.TrimSpace(e.Address), Source: "guesthouse"}
			}
		}
		if strings.TrimSpace(legacy) != "" {
			return &Contact{Label: label, Number: strings.TrimSpace(legacy), Source: "guesthouse"}
		}
	}
	return nil
}

type svcCand struct {
	id      int64
	name    string
	number  string
	address string
	avg     float64
}

// bestPartner finds the highest-rated active service partner in the postal code
// whose categories overlap the given list and which has a contact number.
func bestPartner(ctx context.Context, code string, categories []string, label string) *Contact {
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT id, COALESCE(name,''), COALESCE(contact_number,''), COALESCE(address,'')
		FROM services
		WHERE is_active = true
		  AND lower(trim(postal_code)) = $1
		  AND service_categories && $2
		  AND COALESCE(contact_number,'') <> ''
		  AND lower(trim(name)) !~ '^test([^a-z]|$)'`,
		code, pq.Array(categories))
	if err != nil {
		return nil
	}
	defer rows.Close()
	var cands []svcCand
	var ids []int64
	for rows.Next() {
		var c svcCand
		if err := rows.Scan(&c.id, &c.name, &c.number, &c.address); err != nil {
			return nil
		}
		cands = append(cands, c)
		ids = append(ids, c.id)
	}
	if len(cands) == 0 {
		return nil
	}
	// Average rating per candidate (0 when unrated).
	ratingByID := map[int64]float64{}
	rrows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT entity_id, AVG(stars) FROM ratings
		WHERE entity_type = 'service' AND entity_id = ANY($1)
		GROUP BY entity_id`, pq.Array(ids))
	if err == nil {
		defer rrows.Close()
		for rrows.Next() {
			var id int64
			var avg sql.NullFloat64
			if err := rrows.Scan(&id, &avg); err == nil && avg.Valid {
				ratingByID[id] = avg.Float64
			}
		}
	}
	for i := range cands {
		cands[i].avg = ratingByID[cands[i].id]
	}
	sort.SliceStable(cands, func(i, j int) bool { return cands[i].avg > cands[j].avg })
	best := cands[0]
	return &Contact{Label: label, Name: strings.TrimSpace(best.name), Number: strings.TrimSpace(best.number), Address: strings.TrimSpace(best.address), Source: "partner"}
}
