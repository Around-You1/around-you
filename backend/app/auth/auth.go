// Package auth implements login (access code / secondary / local guest) and
// Validate, which resolves the Bearer token that the HTTP middleware
// (cmd/server/main.go) requires on every authenticated endpoint.
//
// Sessions and users are persisted in Postgres (see
// migrations/000002_create_users_sessions.sql) — a successful login mints a
// random token, inserts a row into sessions, and Validate resolves it back
// via a join. This used to be a plain in-memory map, which meant every
// server restart silently invalidated every session; that's fixed now.
package auth

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// isNoRows reports whether err is the "no matching row" sentinel from a
// QueryRow call — the expected, non-error outcome when a code/name/address
// simply doesn't match any accommodation, as opposed to a real DB failure.
func isNoRows(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}

// ---- Authentication --------------------------------------------------------

// Data identifies the caller behind a valid bearer token. It replaces the
// value Encore's auth handler used to expose via auth.Data().
type Data struct {
	UserID int64
	User   *appdb.User
}

// Validate resolves a bearer token to the signed-in user, or returns an
// *errs.Error with code Unauthenticated. The HTTP middleware (see
// cmd/server/main.go) calls this for every route that previously carried the
// Encore `auth` tag.
//
// Every text/nullable-bigint column below is COALESCE'd — the exact bug class
// already hit once for accommodations (a NULL column crashing row.Scan) would
// otherwise resurface here immediately, since profile_type/entity_type/area/
// municipality/accommodation_id/entity_id are all nullable and unset for most
// logins (e.g. a LocalGuest row has no accommodation_id or entity_id at all).
func Validate(ctx context.Context, authorization string) (*Data, error) {
	token := strings.TrimPrefix(authorization, "Bearer ")
	if token == "" {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing bearer token"}
	}

	var u appdb.User
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT u.id, u.email, u.role,
		       COALESCE(u.profile_type, '') as profile_type,
		       COALESCE(u.accommodation_id, 0) as accommodation_id,
		       COALESCE(u.entity_type, '') as entity_type,
		       COALESCE(u.entity_id, 0) as entity_id,
		       COALESCE(u.area, '') as area,
		       COALESCE(u.municipality, '') as municipality,
		       COALESCE(u.postal_code, '') as postal_code
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.token = $1`, token,
	).Scan(&u.ID, &u.Email, &u.Role, &u.ProfileType, &u.AccommodationID, &u.EntityType, &u.EntityID, &u.Area, &u.Municipality, &u.PostalCode)
	if err != nil {
		if isNoRows(err) {
			return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid or expired token"}
		}
		return nil, err
	}

	return &Data{UserID: u.ID, User: &u}, nil
}

// ---- Login endpoints --------------------------------------------------------

type LoginResponse struct {
	Token string      `json:"token"`
	User  *appdb.User `json:"user"`
}

type AccessCodeLoginRequest struct {
	AccessCode string `json:"accessCode"`
}

// AccessCodeLogin resolves a QR/profile-reference code (guest login at an
// accommodation, restaurant, service, or attraction) or a partner access code
// (see PartnerAccessCodeDisplay.tsx) into a session.
//
//encore:api public method=POST path=/auth/access-code-login
func AccessCodeLogin(ctx context.Context, req *AccessCodeLoginRequest) (*LoginResponse, error) {
	code := strings.ToUpper(strings.TrimSpace(req.AccessCode))
	if code == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "access code is required"}
	}

	match, err := findByAccessCode(ctx, code)
	if err != nil {
		return nil, err
	}
	if match == nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "invalid or expired access code"}
	}
	return issueSession(ctx, match)
}

// findByAccessCode searches every entity type for a matching profile
// reference code or (for partners) active partner code. Accommodations now
// live in Postgres (Phase 5) so that lookup is a real query; restaurants/
// services/attractions are still the in-memory appdb.DB store until they
// migrate too. Returns a *new*, not-yet-persisted appdb.User — the caller
// (issueSession) is responsible for assigning it an ID and saving it.
func findByAccessCode(ctx context.Context, code string) (*appdb.User, error) {
	var accID int64
	var accName string
	err := appdb.SQLDB.QueryRowContext(ctx,
		`SELECT id, name FROM accommodations WHERE upper(profile_reference_code) = upper($1)`, code,
	).Scan(&accID, &accName)
	if err == nil {
		return &appdb.User{Email: "guest@" + accName, Role: "Guest", ProfileType: "accommodation", AccommodationID: accID}, nil
	}
	if !isNoRows(err) {
		return nil, err
	}

	appdb.DB.Lock()
	defer appdb.DB.Unlock()

	for _, r := range appdb.DB.Restaurants {
		if strings.EqualFold(r.ProfileReferenceCode, code) || (r.PartnerCode.Active && strings.EqualFold(r.PartnerCode.Code, code)) {
			return &appdb.User{Email: "partner@" + r.Name, Role: "Partner", ProfileType: "restaurant", EntityType: "restaurant", EntityID: r.ID}, nil
		}
	}
	for _, s := range appdb.DB.Services {
		if strings.EqualFold(s.ProfileReferenceCode, code) || (s.PartnerCode.Active && strings.EqualFold(s.PartnerCode.Code, code)) {
			return &appdb.User{Email: "partner@" + s.Name, Role: "Partner", ProfileType: "service", EntityType: "service", EntityID: s.ID}, nil
		}
	}
	for _, a := range appdb.DB.Attractions {
		if strings.EqualFold(a.ProfileReferenceCode, code) || (a.PartnerCode.Active && strings.EqualFold(a.PartnerCode.Code, code)) {
			return &appdb.User{Email: "partner@" + a.Name, Role: "Partner", ProfileType: "attraction", EntityType: "attraction", EntityID: a.ID}, nil
		}
	}
	return nil, nil
}

type SecondaryLoginRequest struct {
	PartnerName string `json:"partnerName"`
	Address     string `json:"address"`
	Province    string `json:"province"`
	Area        string `json:"area"`
}

// SecondaryLogin matches a holiday guest to their accommodation, or a partner
// to their business, by name + address + province (the "secondary" method
// shown on LoginPage.tsx when the user doesn't have their code handy).
//
//encore:api public method=POST path=/auth/secondary-login
func SecondaryLogin(ctx context.Context, req *SecondaryLoginRequest) (*LoginResponse, error) {
	name := strings.TrimSpace(req.PartnerName)
	if name == "" || strings.TrimSpace(req.Address) == "" || req.Province == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "name, address, and province are required"}
	}

	match, err := findByNameAddressProvince(ctx, name, req.Address, req.Province)
	if err != nil {
		return nil, err
	}
	if match == nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "no matching partner or accommodation found"}
	}
	return issueSession(ctx, match)
}

func findByNameAddressProvince(ctx context.Context, name, address, province string) (*appdb.User, error) {
	var accID int64
	var accName string
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, name FROM accommodations
		WHERE lower(trim(name)) = lower($1) AND lower(trim(address)) = lower($2) AND lower(province) = lower($3)`,
		name, strings.TrimSpace(address), province,
	).Scan(&accID, &accName)
	if err == nil {
		return &appdb.User{Email: "guest@" + accName, Role: "Guest", ProfileType: "accommodation", AccommodationID: accID}, nil
	}
	if !isNoRows(err) {
		return nil, err
	}

	appdb.DB.Lock()
	defer appdb.DB.Unlock()

	matches := func(entityName, entityAddress, entityProvince string) bool {
		return strings.EqualFold(strings.TrimSpace(entityName), name) &&
			strings.EqualFold(strings.TrimSpace(entityAddress), strings.TrimSpace(address)) &&
			strings.EqualFold(entityProvince, province)
	}

	for _, r := range appdb.DB.Restaurants {
		if matches(r.Name, r.Address, r.Province) {
			return &appdb.User{Email: "partner@" + r.Name, Role: "Partner", ProfileType: "restaurant", EntityType: "restaurant", EntityID: r.ID}, nil
		}
	}
	for _, s := range appdb.DB.Services {
		if matches(s.Name, s.Address, s.Province) {
			return &appdb.User{Email: "partner@" + s.Name, Role: "Partner", ProfileType: "service", EntityType: "service", EntityID: s.ID}, nil
		}
	}
	for _, a := range appdb.DB.Attractions {
		if matches(a.Name, a.Address, a.Province) {
			return &appdb.User{Email: "partner@" + a.Name, Role: "Partner", ProfileType: "attraction", EntityType: "attraction", EntityID: a.ID}, nil
		}
	}
	return nil, nil
}

type LocalGuestLoginRequest struct {
	Email      string `json:"email"`
	Province   string `json:"province"`
	Area       string `json:"area,omitempty"`
	PostalCode string `json:"postalCode"`
}

// LocalGuestLogin signs in a local (non-touring) guest by email + postal
// code, used by the "I live here" panel on LoginPage.tsx. Reuses the
// existing user record if this email has signed in before.
//
//encore:api public method=POST path=/auth/local-guest-login
func LocalGuestLogin(ctx context.Context, req *LocalGuestLoginRequest) (*LoginResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || req.Province == "" || strings.TrimSpace(req.PostalCode) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "email, province, and postal code are required"}
	}

	existing, err := findLocalGuestByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		existing.PostalCode = req.PostalCode
		return issueSession(ctx, existing)
	}

	return issueSession(ctx, &appdb.User{Email: email, Role: "LocalGuest", Area: req.Area, PostalCode: req.PostalCode})
}

func findLocalGuestByEmail(ctx context.Context, email string) (*appdb.User, error) {
	var u appdb.User
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, email, role,
		       COALESCE(profile_type, '') as profile_type,
		       COALESCE(accommodation_id, 0) as accommodation_id,
		       COALESCE(entity_type, '') as entity_type,
		       COALESCE(entity_id, 0) as entity_id,
		       COALESCE(area, '') as area,
		       COALESCE(municipality, '') as municipality,
		       COALESCE(postal_code, '') as postal_code
		FROM users WHERE role = 'LocalGuest' AND lower(email) = lower($1)`, email,
	).Scan(&u.ID, &u.Email, &u.Role, &u.ProfileType, &u.AccommodationID, &u.EntityType, &u.EntityID, &u.Area, &u.Municipality, &u.PostalCode)
	if err != nil {
		if isNoRows(err) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

// issueSession assigns the user an ID (if new), persists it, mints a session
// token, and returns the login response. Both users and sessions now live in
// Postgres (see 000002_create_users_sessions.sql) instead of the in-memory
// maps that were wiped on every restart.
func issueSession(ctx context.Context, u *appdb.User) (*LoginResponse, error) {
	if u.ID == 0 {
		var accID, entID sql.NullInt64
		if u.AccommodationID != 0 {
			accID = sql.NullInt64{Int64: u.AccommodationID, Valid: true}
		}
		if u.EntityID != 0 {
			entID = sql.NullInt64{Int64: u.EntityID, Valid: true}
		}

		err := appdb.SQLDB.QueryRowContext(ctx, `
			INSERT INTO users (email, role, profile_type, accommodation_id, entity_type, entity_id, area, municipality, postal_code)
			VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), $6, NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''))
			RETURNING id`,
			u.Email, u.Role, u.ProfileType, accID, u.EntityType, entID, u.Area, u.Municipality, u.PostalCode,
		).Scan(&u.ID)
		if err != nil {
			return nil, err
		}
	}

	token := appdb.RandomCode(32)
	if _, err := appdb.SQLDB.ExecContext(ctx,
		`INSERT INTO sessions (token, user_id) VALUES ($1, $2)`, token, u.ID,
	); err != nil {
		return nil, err
	}

	return &LoginResponse{Token: token, User: u}, nil
}
