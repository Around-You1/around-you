// Package auth implements login (access code / secondary / local guest) and
// Validate, which resolves the Bearer token that the HTTP middleware
// (cmd/server/main.go) requires on every authenticated endpoint.
//
// Sessions are process-local: a successful login mints a random token stored
// in appdb.DB.Sessions, and Validate looks tokens back up there. This is the
// same model as before — only the transport changed from Encore's auth handler
// to standard net/http middleware.
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
// Encore `auth` tag; the token/session model is otherwise unchanged.
func Validate(authorization string) (*Data, error) {
	token := strings.TrimPrefix(authorization, "Bearer ")
	if token == "" {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing bearer token"}
	}

	appdb.DB.Lock()
	userID, ok := appdb.DB.Sessions[token]
	var user *appdb.User
	if ok {
		user = appdb.DB.Users[userID]
	}
	appdb.DB.Unlock()

	if !ok || user == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid or expired token"}
	}

	return &Data{UserID: userID, User: user}, nil
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
	return issueSession(match)
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
	return issueSession(match)
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
	Email    string `json:"email"`
	Province string `json:"province"`
	Area     string `json:"area"`
}

// LocalGuestLogin signs in a local (non-touring) guest by email + area, used
// by the "I live here" panel on LoginPage.tsx. Reuses the existing user
// record if this email has signed in before.
//
//encore:api public method=POST path=/auth/local-guest-login
func LocalGuestLogin(ctx context.Context, req *LocalGuestLoginRequest) (*LoginResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || req.Province == "" || strings.TrimSpace(req.Area) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "email, province, and area are required"}
	}

	existing := findLocalGuestByEmail(email)
	if existing != nil {
		existing.Area = req.Area
		return issueSession(existing)
	}

	return issueSession(&appdb.User{Email: email, Role: "LocalGuest", Area: req.Area})
}

func findLocalGuestByEmail(email string) *appdb.User {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	for _, u := range appdb.DB.Users {
		if u.Role == "LocalGuest" && strings.EqualFold(u.Email, email) {
			return u
		}
	}
	return nil
}

// issueSession assigns the user an ID (if new), stores it, mints a session
// token, and returns the login response. Locks the store itself — callers
// must NOT already hold the lock when calling this.
func issueSession(u *appdb.User) (*LoginResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()

	if u.ID == 0 {
		u.ID = appdb.DB.NextIDLocked()
		appdb.DB.Users[u.ID] = u
	}

	token := appdb.RandomCode(32)
	appdb.DB.Sessions[token] = u.ID

	return &LoginResponse{Token: token, User: u}, nil
}
