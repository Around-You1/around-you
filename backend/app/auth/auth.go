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
	"crypto/subtle"
	"database/sql"
	"errors"
	"fmt"
	htmlpkg "html"
	"os"
	"strconv"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
	"backend_encore/internal/mailer"
	"backend_encore/internal/moderation"
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

// dataContextKey is unexported so only this package can set/read it —
// callers outside app/auth get access only through WithData/FromContext.
type dataContextKey struct{}

// WithData stores the authenticated user's Data on the context. Called by
// cmd/server/main.go's requireAuth middleware right after a successful
// Validate, so downstream handlers (like CreateRep, which needs to confirm
// the caller is actually a SuperAdmin) can retrieve it.
func WithData(ctx context.Context, d *Data) context.Context {
	return context.WithValue(ctx, dataContextKey{}, d)
}

// FromContext retrieves the Data stored by WithData, or nil if none is
// present (e.g. called from a public, non-authenticated endpoint).
func FromContext(ctx context.Context) *Data {
	d, _ := ctx.Value(dataContextKey{}).(*Data)
	return d
}

// IsPrivileged reports whether the caller is an internal role (SuperAdmin /
// Admin / Rep) allowed to see full records. Guests and partners are NOT
// privileged — the read handlers hand them sanitized data (see StripSensitive)
// so a scraped guest token yields only what the UI displays.
func IsPrivileged(ctx context.Context) bool {
	d := FromContext(ctx)
	if d == nil || d.User == nil {
		return false
	}
	switch d.User.Role {
	case "SuperAdmin", "Admin", "Rep":
		return true
	}
	return false
}

// ActorLabel returns a short "email (Role)" label for the authenticated caller,
// or "" if none. Used to record who submitted flagged content, without other
// packages needing to reach into the auth context internals.
func ActorLabel(ctx context.Context) string {
	d := FromContext(ctx)
	if d == nil || d.User == nil {
		return ""
	}
	label := d.User.Email
	if d.User.Role != "" {
		if label != "" {
			label += " "
		}
		label += "(" + d.User.Role + ")"
	}
	return label
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

	var restID int64
	var restName string
	err = appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, name FROM restaurants
		WHERE upper(profile_reference_code) = upper($1)
		   OR (partner_code_active AND upper(partner_code) = upper($1))`, code,
	).Scan(&restID, &restName)
	if err == nil {
		return &appdb.User{Email: "partner@" + restName, Role: "Partner", ProfileType: "restaurant", EntityType: "restaurant", EntityID: restID}, nil
	}
	if !isNoRows(err) {
		return nil, err
	}

	var svcID int64
	var svcName string
	err = appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, name FROM services
		WHERE upper(profile_reference_code) = upper($1)
		   OR (partner_code_active AND upper(partner_code) = upper($1))`, code,
	).Scan(&svcID, &svcName)
	if err == nil {
		return &appdb.User{Email: "partner@" + svcName, Role: "Partner", ProfileType: "service", EntityType: "service", EntityID: svcID}, nil
	}
	if !isNoRows(err) {
		return nil, err
	}

	var attID int64
	var attName string
	err = appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, name FROM attractions
		WHERE upper(profile_reference_code) = upper($1)
		   OR (partner_code_active AND upper(partner_code) = upper($1))`, code,
	).Scan(&attID, &attName)
	if err == nil {
		return &appdb.User{Email: "partner@" + attName, Role: "Partner", ProfileType: "attraction", EntityType: "attraction", EntityID: attID}, nil
	}
	if !isNoRows(err) {
		return nil, err
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

	var restID int64
	var restName string
	err = appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, name FROM restaurants
		WHERE lower(trim(name)) = lower($1) AND lower(trim(address)) = lower($2) AND lower(province) = lower($3)`,
		name, strings.TrimSpace(address), province,
	).Scan(&restID, &restName)
	if err == nil {
		return &appdb.User{Email: "partner@" + restName, Role: "Partner", ProfileType: "restaurant", EntityType: "restaurant", EntityID: restID}, nil
	}
	if !isNoRows(err) {
		return nil, err
	}

	var svcID int64
	var svcName string
	err = appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, name FROM services
		WHERE lower(trim(name)) = lower($1) AND lower(trim(address)) = lower($2) AND lower(province) = lower($3)`,
		name, strings.TrimSpace(address), province,
	).Scan(&svcID, &svcName)
	if err == nil {
		return &appdb.User{Email: "partner@" + svcName, Role: "Partner", ProfileType: "service", EntityType: "service", EntityID: svcID}, nil
	}
	if !isNoRows(err) {
		return nil, err
	}

	var attID int64
	var attName string
	err = appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, name FROM attractions
		WHERE lower(trim(name)) = lower($1) AND lower(trim(address)) = lower($2) AND lower(province) = lower($3)`,
		name, strings.TrimSpace(address), province,
	).Scan(&attID, &attName)
	if err == nil {
		return &appdb.User{Email: "partner@" + attName, Role: "Partner", ProfileType: "attraction", EntityType: "attraction", EntityID: attID}, nil
	}
	if !isNoRows(err) {
		return nil, err
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

	// Best-effort login-event analytics for guests/locals — never blocks login.
	if u.Role == "Guest" || u.Role == "LocalGuest" {
		actorType := "holiday_guest"
		if u.Role == "LocalGuest" {
			actorType = "local_guest"
		}
		_, _ = appdb.SQLDB.ExecContext(ctx, `
			INSERT INTO events (event_type, actor_type, area)
			VALUES ('login', $1, NULLIF($2, ''))`, actorType, u.Area)
	}

	return &LoginResponse{Token: token, User: u}, nil
}

// LoginRequest matches AdminLoginPage.tsx's `backend.auth.login({role, email,
// password})` call. Role is accepted but not itself the security check —
// what actually matters is whether the account found by email has
// role == "SuperAdmin" AND the password matches its stored hash.
type LoginRequest struct {
	Role       string `json:"role"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	AccessCode string `json:"accessCode"`
}

// Login is password-based sign-in for SuperAdmin accounts only — the only
// role that uses a password at all. Every other role (Guest, LocalGuest,
// Partner) signs in via access code or one-time email code; see
// AccessCodeLogin, SecondaryLogin, and LocalGuestLogin above.
//
// There is deliberately no self-service registration for this endpoint —
// SuperAdmin accounts are created directly via a migration (with a bcrypt
// hash generated locally by cmd/hashpassword, never a plaintext password),
// not through any API call.
//
//encore:api public method=POST path=/auth/login
func Login(ctx context.Context, req *LoginRequest) (*LoginResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || req.Password == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "email and password are required"}
	}

	var u appdb.User
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, email, role, password_hash
		FROM users WHERE role = 'SuperAdmin' AND lower(email) = lower($1)`, email,
	).Scan(&u.ID, &u.Email, &u.Role, &u.PasswordHash)
	if err != nil {
		if isNoRows(err) {
			// Deliberately the same generic message as a wrong password
			// below — don't reveal whether an email exists at all.
			return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid email or password"}
		}
		return nil, err
	}

	if u.PasswordHash == "" {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid email or password"}
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid email or password"}
	}

	// Second-factor access code. Enforced only when the ADMIN_LOGIN_CODE Fly
	// secret is set — so it can never lock the admin out (it's off until you set
	// it, and you choose the value). Constant-time compare avoids timing leaks.
	if code := strings.TrimSpace(os.Getenv("ADMIN_LOGIN_CODE")); code != "" {
		if subtle.ConstantTimeCompare([]byte(strings.TrimSpace(req.AccessCode)), []byte(code)) != 1 {
			return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid access code"}
		}
	}

	return issueSession(ctx, &u)
}

// RepLoginRequest matches the Rep sign-in panel: full name + a rep code
// (e.g. "Rep00000001") instead of a password. Rep accounts are created only
// by a SuperAdmin via CreateRep below — there is no self-service signup.
type RepLoginRequest struct {
	FullName   string `json:"fullName"`
	RepCode    string `json:"repCode"`
	AccessCode string `json:"accessCode"`
}

//encore:api public method=POST path=/auth/rep-login
func RepLogin(ctx context.Context, req *RepLoginRequest) (*LoginResponse, error) {
	fullName := strings.TrimSpace(req.FullName)
	repCode := strings.TrimSpace(req.RepCode)
	if fullName == "" || repCode == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "full name and rep code are required"}
	}

	var u appdb.User
	var repStatus, loginCode string
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, email, role, full_name, rep_code, COALESCE(NULLIF(rep_status,''),'Active'), COALESCE(login_code,'')
		FROM users
		WHERE role = 'Rep' AND lower(full_name) = lower($1) AND lower(rep_code) = lower($2)`,
		fullName, repCode,
	).Scan(&u.ID, &u.Email, &u.Role, &u.FullName, &u.RepCode, &repStatus, &loginCode)
	if err != nil {
		if isNoRows(err) {
			// Same generic message either way — don't reveal which part
			// (name vs. code) was wrong.
			return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid full name or rep code"}
		}
		return nil, err
	}

	// Approval gate: applications land as "Inactive" (pending) and cannot sign
	// in until a SuperAdmin activates them on the Reps tab.
	if !strings.EqualFold(repStatus, "Active") {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "Your rep application is pending approval. You'll be able to sign in once it's activated."}
	}

	// Access-code second factor. Enforced only when a code has been issued to
	// this rep (login_code non-empty) — so existing reps without one yet are not
	// locked out. New reps get theirs in the activation welcome email.
	if strings.TrimSpace(loginCode) != "" {
		if subtle.ConstantTimeCompare([]byte(strings.TrimSpace(req.AccessCode)), []byte(loginCode)) != 1 {
			return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid access code"}
		}
	}

	return issueSession(ctx, &u)
}

// AccLoginRequest is the accountant sign-in: a 12-char access code. It first
// matches per-accountant accounts (registered + activated by a SuperAdmin on
// the Admin Dashboard, each with their own login_code). If no per-person code
// matches, it falls back to the shared code — the bcrypt hash a SuperAdmin
// sets in the Admin Billing tab (accountant_access table), or the
// ACC_ACCESS_CODE env var — so the portal keeps working during the transition.
type AccLoginRequest struct {
	AccessCode string `json:"accessCode"`
}

//encore:api public method=POST path=/auth/acc-login
func AccLogin(ctx context.Context, req *AccLoginRequest) (*LoginResponse, error) {
	code := strings.TrimSpace(req.AccessCode)
	if code == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "access code is required"}
	}

	// Per-accountant accounts first: a SuperAdmin registers accountants on the
	// Admin Dashboard, each gets their own 12-char login_code, and is activated
	// (rep_status='Active') before they can sign in. If the entered code matches
	// an active accountant, sign that specific person in.
	{
		var u appdb.User
		err := appdb.SQLDB.QueryRowContext(ctx, `
			SELECT id, email, role, COALESCE(full_name,'')
			FROM users
			WHERE role = 'Accountant'
			  AND COALESCE(login_code,'') <> ''
			  AND login_code = $1
			  AND COALESCE(rep_status,'Active') = 'Active'
			LIMIT 1`, code,
		).Scan(&u.ID, &u.Email, &u.Role, &u.FullName)
		if err == nil {
			return issueSession(ctx, &u)
		}
		if err != nil && !isNoRows(err) {
			return nil, err
		}
		// If the code matches an accountant who exists but is NOT active, block
		// with a clear message rather than silently falling through to the
		// shared code (which would never match anyway).
		var pendingCount int
		if err := appdb.SQLDB.QueryRowContext(ctx, `
			SELECT count(*) FROM users
			WHERE role = 'Accountant' AND COALESCE(login_code,'') <> ''
			  AND login_code = $1 AND COALESCE(rep_status,'Active') <> 'Active'`, code,
		).Scan(&pendingCount); err == nil && pendingCount > 0 {
			return nil, &errs.Error{Code: errs.Unauthenticated, Message: "this accountant account is not active yet — please contact the administrator"}
		}
	}

	// Prefer the in-app code (bcrypt hash in accountant_access). A blank/absent
	// hash means no admin has set one yet, so we fall back to the env secret.
	var hash string
	err := appdb.SQLDB.QueryRowContext(ctx,
		`SELECT code_hash FROM accountant_access WHERE id = 1`,
	).Scan(&hash)
	if err != nil && !isNoRows(err) {
		return nil, err
	}
	if strings.TrimSpace(hash) != "" {
		if bcrypt.CompareHashAndPassword([]byte(hash), []byte(code)) != nil {
			return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid access code"}
		}
	} else {
		expected := strings.TrimSpace(os.Getenv("ACC_ACCESS_CODE"))
		if expected == "" {
			return nil, &errs.Error{Code: errs.Unauthenticated, Message: "accountant access is not configured"}
		}
		if !strings.EqualFold(code, expected) {
			return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid access code"}
		}
	}

	// Reuse a single accountant user row across logins rather than creating a
	// new one every time (same idea as the LocalGuest dedupe).
	const accEmail = "accountant@aroundyou.co.za"
	var u appdb.User
	err = appdb.SQLDB.QueryRowContext(ctx,
		`SELECT id, email, role FROM users WHERE role = 'Accountant' AND lower(email) = lower($1)`, accEmail,
	).Scan(&u.ID, &u.Email, &u.Role)
	if err != nil {
		if isNoRows(err) {
			return issueSession(ctx, &appdb.User{Email: accEmail, Role: "Accountant"})
		}
		return nil, err
	}
	return issueSession(ctx, &u)
}

// SetAccCodeRequest carries a new accountant sign-in code from the Admin
// Billing tab. The plaintext code is hashed here and never stored as-is.
type SetAccCodeRequest struct {
	Code string `json:"code"`
}

type SetAccCodeResponse struct {
	OK bool `json:"ok"`
}

// SetAccCode lets a SuperAdmin set/rotate the accountant access code. Stores a
// bcrypt hash in accountant_access (single row). SuperAdmin only.
//
//encore:api auth method=POST path=/auth/acc-code/set
func SetAccCode(ctx context.Context, req *SetAccCodeRequest) (*SetAccCodeResponse, error) {
	data := FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can set the accountant code"}
	}
	code := strings.TrimSpace(req.Code)
	if len(code) < 12 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "the access code must be at least 12 characters"}
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO accountant_access (id, code_hash, updated_at, updated_by)
		VALUES (1, $1, now(), $2)
		ON CONFLICT (id) DO UPDATE
		SET code_hash = excluded.code_hash, updated_at = now(), updated_by = excluded.updated_by`,
		string(hash), data.User.Email,
	); err != nil {
		return nil, err
	}
	return &SetAccCodeResponse{OK: true}, nil
}

// AccCodeStatusResponse describes whether an accountant code is configured,
// without ever revealing the code. "source" is "in-app" when a SuperAdmin has
// set one here, "fly-secret" when only the ACC_ACCESS_CODE env var is set, or
// "none" when neither is configured.
type AccCodeStatusResponse struct {
	IsSet     bool   `json:"isSet"`
	Source    string `json:"source"`
	UpdatedAt string `json:"updatedAt"`
	UpdatedBy string `json:"updatedBy"`
}

// AccCodeStatus reports whether the accountant code is configured. SuperAdmin only.
//
//encore:api auth method=GET path=/auth/acc-code/status
func AccCodeStatus(ctx context.Context) (*AccCodeStatusResponse, error) {
	data := FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view the accountant code status"}
	}
	var hash, updatedBy string
	var updatedAt string
	err := appdb.SQLDB.QueryRowContext(ctx,
		`SELECT code_hash, COALESCE(to_char(updated_at, 'YYYY-MM-DD'), ''), updated_by FROM accountant_access WHERE id = 1`,
	).Scan(&hash, &updatedAt, &updatedBy)
	if err != nil && !isNoRows(err) {
		return nil, err
	}
	if strings.TrimSpace(hash) != "" {
		return &AccCodeStatusResponse{IsSet: true, Source: "in-app", UpdatedAt: updatedAt, UpdatedBy: updatedBy}, nil
	}
	if strings.TrimSpace(os.Getenv("ACC_ACCESS_CODE")) != "" {
		return &AccCodeStatusResponse{IsSet: true, Source: "fly-secret"}, nil
	}
	return &AccCodeStatusResponse{IsSet: false, Source: "none"}, nil
}

// ---- Per-accountant accounts (SuperAdmin-managed, mirror the Rep flow) ------
//
// An accountant is a users row with role='Accountant' and a non-empty
// login_code (the 12-char access code they sign in with). They are created
// Inactive; a SuperAdmin activates them, which emails a welcome with the code.
// rep_status doubles as the accountant's Active/Inactive status and rep_email
// as their contact email — reusing the existing columns, no new schema.

type Accountant struct {
	ID         int64  `json:"id"`
	FullName   string `json:"fullName"`
	Email      string `json:"email"`
	Status     string `json:"status"`
	AccessCode string `json:"accessCode"` // 12-char login code (SuperAdmin view)
}

type CreateAccountantRequest struct {
	FullName string `json:"fullName"`
	Email    string `json:"email"`
}

type CreateAccountantResponse struct {
	FullName   string `json:"fullName"`
	AccessCode string `json:"accessCode"`
}

// CreateAccountant is SuperAdmin-only. It creates an Inactive accountant with a
// 12-char access code; the code is emailed to them when the SuperAdmin
// activates the account (see UpdateAccountant).
//
//encore:api auth method=POST path=/auth/create-accountant
func CreateAccountant(ctx context.Context, req *CreateAccountantRequest) (*CreateAccountantResponse, error) {
	data := FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can create accountant accounts"}
	}

	fullName := strings.TrimSpace(req.FullName)
	if fullName == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "full name is required"}
	}
	if err := moderation.BlockError(
		moderation.NamedField{Name: "fullName", Value: fullName},
		moderation.NamedField{Name: "email", Value: req.Email},
	); err != nil {
		return nil, err
	}

	loginCode := appdb.RandomCode(12)
	// Accountants sign in with just their access code — no email login — so this
	// synthetic address only satisfies the users table's NOT NULL email
	// constraint (same pattern as reps). The real contact email goes in rep_email.
	syntheticEmail := "acc-" + strings.ToLower(appdb.RandomCode(10)) + "@accts.aroundyou.internal"

	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO users (email, role, full_name, rep_email, rep_status, login_code)
		VALUES ($1, 'Accountant', $2, NULLIF($3, ''), 'Inactive', $4)`,
		syntheticEmail, fullName, strings.TrimSpace(req.Email), loginCode,
	); err != nil {
		return nil, err
	}

	moderation.ScanAndFlag(ctx, "accountant_onboarding", "accountant", 0, fullName, ActorLabel(ctx),
		moderation.NamedField{Name: "fullName", Value: fullName},
		moderation.NamedField{Name: "email", Value: strings.TrimSpace(req.Email)},
	)

	return &CreateAccountantResponse{FullName: fullName, AccessCode: loginCode}, nil
}

type ListAccountantsResponse struct {
	Accountants []Accountant `json:"accountants"`
}

// ListAccountants is SuperAdmin-only. Only per-person accounts (those with a
// login_code) are returned — the legacy shared-login row, if any, is excluded.
//
//encore:api auth method=GET path=/auth/accountants
func ListAccountants(ctx context.Context) (*ListAccountantsResponse, error) {
	data := FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view accountants"}
	}

	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT id, COALESCE(full_name,''), COALESCE(rep_email,''),
		       COALESCE(rep_status,'Inactive'), COALESCE(login_code,'')
		FROM users
		WHERE role = 'Accountant' AND COALESCE(login_code,'') <> ''
		ORDER BY full_name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accountants := []Accountant{}
	for rows.Next() {
		var a Accountant
		if err := rows.Scan(&a.ID, &a.FullName, &a.Email, &a.Status, &a.AccessCode); err != nil {
			return nil, err
		}
		accountants = append(accountants, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &ListAccountantsResponse{Accountants: accountants}, nil
}

type UpdateAccountantRequest struct {
	ID       int64  `json:"id"`
	FullName string `json:"fullName"`
	Email    string `json:"email"`
	Status   string `json:"status"` // "Active" | "Inactive"
}

// UpdateAccountant is SuperAdmin-only. It edits name/email/status of a
// per-person accountant. Activating (Inactive→Active) emails the welcome with
// their access code. Only rows that are already per-person accounts (login_code
// set) can be updated, so the legacy shared-login row is never touched.
//
//encore:api auth method=POST path=/auth/accountant/update
func UpdateAccountant(ctx context.Context, req *UpdateAccountantRequest) (*Accountant, error) {
	data := FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can update accountants"}
	}
	if req.ID <= 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "id is required"}
	}

	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "Active"
	}
	if status != "Active" && status != "Inactive" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "status must be 'Active' or 'Inactive'"}
	}

	fullName := strings.TrimSpace(req.FullName)
	if fullName == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "full name is required"}
	}
	if err := moderation.BlockError(
		moderation.NamedField{Name: "fullName", Value: fullName},
		moderation.NamedField{Name: "email", Value: req.Email},
	); err != nil {
		return nil, err
	}

	// Snapshot current state to (a) ensure a login code exists and (b) detect an
	// Inactive→Active transition for the welcome email.
	var curStatus, curLoginCode, curEmail string
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT COALESCE(rep_status,''), COALESCE(login_code,''), COALESCE(rep_email,'')
		FROM users WHERE id = $1 AND role = 'Accountant' AND COALESCE(login_code,'') <> ''`, req.ID,
	).Scan(&curStatus, &curLoginCode, &curEmail)
	if isNoRows(err) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "accountant not found"}
	}
	if err != nil {
		return nil, err
	}
	loginCode := strings.TrimSpace(curLoginCode)
	if loginCode == "" {
		loginCode = appdb.RandomCode(12)
	}

	if _, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE users
		SET full_name  = $2,
		    rep_email  = NULLIF($3, ''),
		    rep_status = $4,
		    login_code = $5
		WHERE id = $1 AND role = 'Accountant'`,
		req.ID, fullName, strings.TrimSpace(req.Email), status, loginCode,
	); err != nil {
		return nil, err
	}

	// On activation, email the welcome with the access code. Best-effort.
	if strings.EqualFold(status, "Active") && !strings.EqualFold(curStatus, "Active") {
		to := strings.TrimSpace(req.Email)
		if to == "" {
			to = curEmail
		}
		if to != "" {
			go func(addr, name, lc string) {
				_ = mailer.Send(addr, "Welcome to Around You — your Accountant access", renderAccountantWelcomeHTML(name, lc))
			}(to, fullName, loginCode)
		}
	}

	return &Accountant{ID: req.ID, FullName: fullName, Email: strings.TrimSpace(req.Email), Status: status, AccessCode: loginCode}, nil
}

// renderAccountantWelcomeHTML is the email an accountant receives when a
// SuperAdmin activates their account — it carries their sign-in access code.
func renderAccountantWelcomeHTML(fullName, loginCode string) string {
	esc := htmlpkg.EscapeString
	name := strings.TrimSpace(fullName)
	if name == "" {
		name = "there"
	}
	return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#1a1f2e;">` +
		`<h2 style="color:#159a53;margin:0 0 10px;">Welcome to Around You!</h2>` +
		`<p>Hi ` + esc(name) + `, your accountant account has been activated. Here is your sign-in code — please keep it safe and don't share it.</p>` +
		`<table style="border-collapse:collapse;font-size:15px;margin:12px 0;">` +
		`<tr><td style="padding:6px 12px;color:#555;">Full Name</td><td style="padding:6px 12px;"><b>` + esc(name) + `</b></td></tr>` +
		`<tr><td style="padding:6px 12px;color:#555;">Access Code</td><td style="padding:6px 12px;"><b style="font-size:18px;color:#159a53;letter-spacing:1px;">` + esc(loginCode) + `</b></td></tr>` +
		`</table>` +
		`<p>To sign in: open Around You, tap <b>Accountant</b>, then enter your access code.</p>` +
		`<p style="color:#888;font-size:13px;">If you weren't expecting this, please ignore this email.</p>` +
		`</div>`
}

type CreateRepRequest struct {
	FullName string `json:"fullName"`
	Email    string `json:"email"`
}

type CreateRepResponse struct {
	FullName string `json:"fullName"`
	RepCode  string `json:"repCode"`
}

// CreateRep is SuperAdmin-only — checked via FromContext, not just "is this
// caller authenticated at all" (which is all the router's generic auth
// middleware confirms on its own). Generates the next sequential rep code
// (Rep00000001, Rep00000002, ...).
//
//encore:api auth method=POST path=/auth/create-rep
func CreateRep(ctx context.Context, req *CreateRepRequest) (*CreateRepResponse, error) {
	data := FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can create rep accounts"}
	}

	fullName := strings.TrimSpace(req.FullName)
	if fullName == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "full name is required"}
	}
	if err := moderation.BlockError(
		moderation.NamedField{Name: "fullName", Value: fullName},
		moderation.NamedField{Name: "email", Value: req.Email},
	); err != nil {
		return nil, err
	}

	repCode, err := nextRepCode(ctx)
	if err != nil {
		return nil, err
	}

	// Reps don't have a real email (the sign-in form never asks for one) —
	// this synthetic address only exists to satisfy the users table's
	// existing NOT NULL constraint on email, the same pattern already used
	// for Guest/Partner rows created via access-code login.
	email := strings.ToLower(repCode) + "@reps.aroundyou.internal"

	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO users (email, role, full_name, rep_code, rep_email, login_code)
		VALUES ($1, 'Rep', $2, $3, NULLIF($4, ''), $5)`,
		email, fullName, repCode, strings.TrimSpace(req.Email), appdb.RandomCode(12),
	); err != nil {
		return nil, err
	}

	// Screen the rep-onboarding text for profanity/abuse/discrimination. Never
	// blocks — hits become alerts on the Admin Dashboard. entityID 0: reps have
	// no stable numeric entity here, so we key the flag by rep code in subject.
	moderation.ScanAndFlag(ctx, "rep_onboarding", "rep", 0, fullName+" ("+repCode+")", ActorLabel(ctx),
		moderation.NamedField{Name: "fullName", Value: fullName},
		moderation.NamedField{Name: "email", Value: strings.TrimSpace(req.Email)},
	)

	return &CreateRepResponse{FullName: fullName, RepCode: repCode}, nil
}

// nextRepCode finds the highest existing rep code and returns the next one,
// zero-padded to 8 digits (Rep00000001, Rep00000002, ...). Fixed-width
// padding means ORDER BY rep_code DESC sorts correctly as plain text, since
// every code is always the same length.
func nextRepCode(ctx context.Context) (string, error) {
	var lastCode sql.NullString
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT rep_code FROM users
		WHERE role = 'Rep' AND rep_code IS NOT NULL
		ORDER BY rep_code DESC LIMIT 1`,
	).Scan(&lastCode)
	if err != nil && !isNoRows(err) {
		return "", err
	}

	n := 0
	if lastCode.Valid {
		if parsed, convErr := strconv.Atoi(strings.TrimPrefix(lastCode.String, "Rep")); convErr == nil {
			n = parsed
		}
	}
	n++
	return "Rep" + fmt.Sprintf("%08d", n), nil
}

// ---- Self-service Rep Application (public, from the Rep Sign In page) --------

// Where completed applications are emailed for your records. Change if needed.
const repApplicationRecipient = "accounts@aroundyou.co.za"

type RepApplicationRequest struct {
	FullName           string `json:"fullName"`
	IDNumber           string `json:"idNumber"`
	DateOfBirth        string `json:"dateOfBirth"`
	Phone              string `json:"phone"`
	Email              string `json:"email"`
	ResidentialAddress string `json:"residentialAddress"`
	PostalCode         string `json:"postalCode"`
	Province           string `json:"province"`
	TaxNumber          string `json:"taxNumber"`
	VatNumber          string `json:"vatNumber"`
	BankAccountName    string `json:"bankAccountName"`
	BankName           string `json:"bankName"`
	BankAccountNumber  string `json:"bankAccountNumber"`
	BankBranchCode     string `json:"bankBranchCode"`
	BankAccountType    string `json:"bankAccountType"`
	UplineRepCode      string `json:"uplineRepCode"`
	PopiaConsent       bool   `json:"popiaConsent"`
	AgreementConsent   bool   `json:"agreementConsent"`
	SignatureName      string `json:"signatureName"`
}

type RepApplicationResponse struct {
	FullName string `json:"fullName"`
	RepCode  string `json:"repCode"`
}

// SubmitRepApplication is public (reached from the Rep Sign In page). It
// generates the next Rep Code, creates the Rep account so the applicant can
// immediately sign in, and emails the full application to the administrator
// to keep on file. Individuals only — no company fields.
//
//encore:api method=POST path=/auth/rep-application
func SubmitRepApplication(ctx context.Context, req *RepApplicationRequest) (*RepApplicationResponse, error) {
	fullName := strings.TrimSpace(req.FullName)
	// All fields are required except SARS tax number, VAT number and the
	// recruiting rep (upline) code. Validate server-side so the rule holds even
	// if the form is bypassed.
	required := []struct{ label, value string }{
		{"Full legal name", req.FullName},
		{"SA ID / Passport number", req.IDNumber},
		{"Date of birth", req.DateOfBirth},
		{"Mobile", req.Phone},
		{"Email", req.Email},
		{"Residential address", req.ResidentialAddress},
		{"Postal code", req.PostalCode},
		{"Province", req.Province},
		{"Bank account holder", req.BankAccountName},
		{"Bank", req.BankName},
		{"Account type", req.BankAccountType},
		{"Account number", req.BankAccountNumber},
		{"Branch code", req.BankBranchCode},
		{"Signature", req.SignatureName},
	}
	for _, f := range required {
		if strings.TrimSpace(f.value) == "" {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: f.label + " is required"}
		}
	}
	if !req.PopiaConsent || !req.AgreementConsent {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "please accept the POPIA consent and the commission agreement to apply"}
	}
	if err := moderation.BlockError(
		moderation.NamedField{Name: "fullName", Value: fullName},
	); err != nil {
		return nil, err
	}

	// Duplicate guard: a person's ID number (and email) uniquely identify them,
	// so refuse a second application that matches an existing rep. This stops
	// double-submits (a second tap on Submit, a page refresh, or re-applying)
	// from creating multiple rep records for the same person.
	idNum := strings.TrimSpace(req.IDNumber)
	repEmail := strings.TrimSpace(req.Email)
	var dupCount int
	if err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT count(*) FROM users
		WHERE role = 'Rep'
		  AND (
		        (COALESCE(id_number,'') <> '' AND lower(id_number) = lower($1))
		     OR (COALESCE(rep_email,'') <> '' AND lower(rep_email) = lower($2))
		      )`, idNum, repEmail,
	).Scan(&dupCount); err != nil {
		return nil, err
	}
	if dupCount > 0 {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "An application with this ID number or email already exists. If you've already applied, please wait for it to be reviewed or contact Around You — there's no need to apply again."}
	}

	repCode, err := nextRepCode(ctx)
	if err != nil {
		return nil, err
	}
	loginEmail := strings.ToLower(repCode) + "@reps.aroundyou.internal"
	// 12-char access code, issued now and emailed to the rep when a SuperAdmin
	// activates them (see UpdateRep). Kept on file until then.
	loginCode := appdb.RandomCode(12)

	// New applications are created Inactive (pending). A SuperAdmin activates
	// them on the Reps tab before the applicant can sign in.
	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO users (email, role, full_name, rep_code, rep_email, upline_rep_code, rep_status,
		   id_number, login_code, phone, residential_address, province, postal_code,
		   date_of_birth, tax_number, vat_number,
		   bank_account_name, bank_name, bank_account_number, bank_branch_code, bank_account_type)
		VALUES ($1, 'Rep', $2, $3, NULLIF($4,''), NULLIF($5,''), 'Inactive',
		   $6, $7, $8, $9, NULLIF($10,''), $11,
		   $12, $13, $14, $15, $16, $17, $18, $19)`,
		loginEmail, fullName, repCode, strings.TrimSpace(req.Email), strings.TrimSpace(req.UplineRepCode), strings.TrimSpace(req.IDNumber), loginCode,
		strings.TrimSpace(req.Phone), strings.TrimSpace(req.ResidentialAddress), strings.TrimSpace(req.Province), strings.TrimSpace(req.PostalCode),
		strings.TrimSpace(req.DateOfBirth), strings.TrimSpace(req.TaxNumber), strings.TrimSpace(req.VatNumber),
		strings.TrimSpace(req.BankAccountName), strings.TrimSpace(req.BankName), strings.TrimSpace(req.BankAccountNumber),
		strings.TrimSpace(req.BankBranchCode), strings.TrimSpace(req.BankAccountType),
	); err != nil {
		return nil, err
	}

	// Email the completed application (kept on file). Non-blocking.
	go func() {
		_ = mailer.Send(repApplicationRecipient, "New Rep Application — "+fullName+" ("+repCode+")", renderRepApplicationHTML(req, repCode))
	}()

	moderation.ScanAndFlag(ctx, "rep_onboarding", "rep", 0, fullName+" ("+repCode+")", "Rep Application",
		moderation.NamedField{Name: "fullName", Value: fullName},
	)

	return &RepApplicationResponse{FullName: fullName, RepCode: repCode}, nil
}

// renderRepWelcomeHTML is the email a rep receives when a SuperAdmin activates
// their account — it carries their sign-in access code.
func renderRepWelcomeHTML(fullName, repCode, loginCode string) string {
	esc := htmlpkg.EscapeString
	name := strings.TrimSpace(fullName)
	if name == "" {
		name = "there"
	}
	return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#1a1f2e;">` +
		`<h2 style="color:#159a53;margin:0 0 10px;">Welcome to Around You!</h2>` +
		`<p>Hi ` + esc(name) + `, your rep account has been activated. Here are your sign-in details — please keep them safe and don't share them.</p>` +
		`<table style="border-collapse:collapse;font-size:15px;margin:12px 0;">` +
		`<tr><td style="padding:6px 12px;color:#555;">Full Name</td><td style="padding:6px 12px;"><b>` + esc(name) + `</b></td></tr>` +
		`<tr><td style="padding:6px 12px;color:#555;">Rep Code</td><td style="padding:6px 12px;"><b>` + esc(repCode) + `</b></td></tr>` +
		`<tr><td style="padding:6px 12px;color:#555;">Access Code</td><td style="padding:6px 12px;"><b style="font-size:18px;color:#159a53;letter-spacing:1px;">` + esc(loginCode) + `</b></td></tr>` +
		`</table>` +
		`<p>To sign in: open Around You, tap <b>Rep</b>, then enter your full name, rep code and access code.</p>` +
		`<p style="color:#888;font-size:13px;">If you didn't apply to be an Around You rep, please ignore this email.</p>` +
		`</div>`
}

func renderRepApplicationHTML(r *RepApplicationRequest, repCode string) string {
	esc := htmlpkg.EscapeString
	row := func(k, v string) string {
		if strings.TrimSpace(v) == "" {
			v = "—"
		}
		return `<tr><td style="padding:5px 12px;color:#555;border-bottom:1px solid #eee;">` + esc(k) +
			`</td><td style="padding:5px 12px;border-bottom:1px solid #eee;"><b>` + esc(v) + `</b></td></tr>`
	}
	yesno := func(b bool) string {
		if b {
			return "Yes"
		}
		return "No"
	}
	return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;color:#1a1f2e;">` +
		`<h2 style="margin:0 0 6px;">New Rep Application</h2>` +
		`<p style="margin:0 0 14px;">Generated Rep Code: <b style="font-size:18px;color:#159a53;">` + esc(repCode) + `</b></p>` +
		`<table style="border-collapse:collapse;font-size:14px;width:100%;">` +
		row("Full name", r.FullName) +
		row("ID number", r.IDNumber) +
		row("Date of birth", r.DateOfBirth) +
		row("Mobile", r.Phone) +
		row("Email", r.Email) +
		row("Residential address", r.ResidentialAddress) +
		row("Postal code", r.PostalCode) +
		row("Province", r.Province) +
		row("SARS tax number", r.TaxNumber) +
		row("VAT number", r.VatNumber) +
		row("Bank account holder", r.BankAccountName) +
		row("Bank", r.BankName) +
		row("Account number", r.BankAccountNumber) +
		row("Branch code", r.BankBranchCode) +
		row("Account type", r.BankAccountType) +
		row("Recruiting rep (upline)", r.UplineRepCode) +
		row("POPIA consent", yesno(r.PopiaConsent)) +
		row("Commission agreement accepted", yesno(r.AgreementConsent)) +
		row("Signature (typed)", r.SignatureName) +
		`</table>` +
		`<p style="color:#777;font-size:12px;margin-top:14px;">Individual commission-only applicant. Verify ID, tax and banking details before first payout.</p>` +
		`</div>`
}

type Rep struct {
	ID            int64  `json:"id"`
	FullName      string `json:"fullName"`
	RepCode       string `json:"repCode"`
	UplineRepCode string `json:"uplineRepCode"`
	IsTeamLeader  bool   `json:"isTeamLeader"`
	Region        string `json:"region"`
	Province      string `json:"province"`
	Status        string `json:"status"`
	Email         string `json:"email"`
	AccessCode    string `json:"accessCode"` // 12-char login code (SuperAdmin view, for reveal/resend)
	IDNumber      string `json:"idNumber"`
	Phone         string `json:"phone"`
	ResidentialAddress string `json:"residentialAddress"`
	PostalCode    string `json:"postalCode"`
}

type ListRepsResponse struct {
	Reps []Rep `json:"reps"`
}

// ListReps is SuperAdmin-only, same check as CreateRep — powers a future
// "Manage Reps" list in the Admin Dashboard.
//
//encore:api auth method=GET path=/auth/reps
func ListReps(ctx context.Context) (*ListRepsResponse, error) {
	data := FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view reps"}
	}

	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT id, COALESCE(full_name, ''), COALESCE(rep_code, ''),
		       COALESCE(upline_rep_code, ''), is_team_leader,
		       COALESCE(region, ''), COALESCE(province, ''), rep_status,
		       COALESCE(rep_email, ''), COALESCE(login_code, ''),
		       COALESCE(id_number, ''), COALESCE(phone, ''), COALESCE(residential_address, ''), COALESCE(postal_code, '')
		FROM users WHERE role = 'Rep' ORDER BY rep_code ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reps := []Rep{}
	for rows.Next() {
		var r Rep
		if err := rows.Scan(&r.ID, &r.FullName, &r.RepCode,
			&r.UplineRepCode, &r.IsTeamLeader, &r.Region, &r.Province, &r.Status, &r.Email, &r.AccessCode,
			&r.IDNumber, &r.Phone, &r.ResidentialAddress, &r.PostalCode); err != nil {
			return nil, err
		}
		reps = append(reps, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &ListRepsResponse{Reps: reps}, nil
}

type UpdateRepRequest struct {
	RepCode            string `json:"repCode"`
	UplineRepCode      string `json:"uplineRepCode"` // "" clears the upline
	IsTeamLeader       bool   `json:"isTeamLeader"`
	Region             string `json:"region"`
	Province           string `json:"province"`
	Status             string `json:"status"` // "Active" | "Inactive"
	Email              string `json:"email"`
	IDNumber           string `json:"idNumber"`
	Phone              string `json:"phone"`
	ResidentialAddress string `json:"residentialAddress"`
	PostalCode         string `json:"postalCode"`
}

// UpdateRep is SuperAdmin-only. It sets a rep's hierarchy + profile fields:
// upline (their Team Leader), team-leader flag, region/province, and status.
// Assigning an upline also marks that upline as a Team Leader. Basic loop
// guards prevent a rep being their own upline or an immediate A->B->A cycle.
//
//encore:api auth method=POST path=/auth/rep/update
func UpdateRep(ctx context.Context, req *UpdateRepRequest) (*Rep, error) {
	data := FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can update reps"}
	}

	repCode := strings.TrimSpace(req.RepCode)
	if repCode == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "repCode is required"}
	}

	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "Active"
	}
	if status != "Active" && status != "Inactive" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "status must be 'Active' or 'Inactive'"}
	}

	upline := strings.TrimSpace(req.UplineRepCode)
	if upline != "" {
		if strings.EqualFold(upline, repCode) {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "a rep cannot be their own upline"}
		}
		// Upline must be an existing rep, and must not already report to this
		// rep (blocks the obvious two-step loop A->B->A).
		var uplineUpline sql.NullString
		err := appdb.SQLDB.QueryRowContext(ctx, `
			SELECT COALESCE(upline_rep_code, '') FROM users
			WHERE role = 'Rep' AND lower(rep_code) = lower($1)`, upline,
		).Scan(&uplineUpline)
		if isNoRows(err) {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "upline rep code does not exist"}
		}
		if err != nil {
			return nil, err
		}
		if strings.EqualFold(uplineUpline.String, repCode) {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "that would create a reporting loop"}
		}
	}

	// Snapshot current state so we can (a) issue a login code if none exists yet
	// and (b) detect an Inactive→Active transition to fire the welcome email.
	var curStatus, curLoginCode, curRepEmail, curFullName string
	_ = appdb.SQLDB.QueryRowContext(ctx, `
		SELECT COALESCE(rep_status,''), COALESCE(login_code,''), COALESCE(rep_email,''), COALESCE(full_name,'')
		FROM users WHERE role = 'Rep' AND lower(rep_code) = lower($1)`, repCode,
	).Scan(&curStatus, &curLoginCode, &curRepEmail, &curFullName)
	loginCode := strings.TrimSpace(curLoginCode)
	if loginCode == "" {
		loginCode = appdb.RandomCode(12)
	}

	res, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE users
		SET upline_rep_code = NULLIF($2, ''),
		    is_team_leader  = $3,
		    region          = NULLIF($4, ''),
		    province        = NULLIF($5, ''),
		    rep_status      = $6,
		    rep_email       = NULLIF($7, ''),
		    login_code      = $8,
		    id_number       = $9,
		    phone           = $10,
		    residential_address = $11,
		    postal_code     = $12
		WHERE role = 'Rep' AND lower(rep_code) = lower($1)`,
		repCode, upline, req.IsTeamLeader,
		strings.TrimSpace(req.Region), strings.TrimSpace(req.Province), status,
		strings.TrimSpace(req.Email), loginCode,
		strings.TrimSpace(req.IDNumber), strings.TrimSpace(req.Phone), strings.TrimSpace(req.ResidentialAddress), strings.TrimSpace(req.PostalCode),
	)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, &errs.Error{Code: errs.NotFound, Message: "rep not found"}
	}

	// On activation (Inactive→Active), email the rep a welcome with their access
	// code + rep code. Best-effort, never blocks the update.
	if strings.EqualFold(status, "Active") && !strings.EqualFold(curStatus, "Active") {
		to := strings.TrimSpace(req.Email)
		if to == "" {
			to = curRepEmail
		}
		if to != "" {
			go func(addr, name, rc, lc string) {
				_ = mailer.Send(addr, "Welcome to Around You — your Rep access", renderRepWelcomeHTML(name, rc, lc))
			}(to, curFullName, repCode, loginCode)
		}
	}

	// Assigning an upline makes that upline a Team Leader.
	if upline != "" {
		if _, err := appdb.SQLDB.ExecContext(ctx, `
			UPDATE users SET is_team_leader = true
			WHERE role = 'Rep' AND lower(rep_code) = lower($1)`, upline,
		); err != nil {
			return nil, err
		}
	}

	var r Rep
	err = appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, COALESCE(full_name, ''), COALESCE(rep_code, ''),
		       COALESCE(upline_rep_code, ''), is_team_leader,
		       COALESCE(region, ''), COALESCE(province, ''), rep_status,
		       COALESCE(rep_email, ''), COALESCE(login_code, ''),
		       COALESCE(id_number, ''), COALESCE(phone, ''), COALESCE(residential_address, ''), COALESCE(postal_code, '')
		FROM users WHERE role = 'Rep' AND lower(rep_code) = lower($1)`, repCode,
	).Scan(&r.ID, &r.FullName, &r.RepCode, &r.UplineRepCode, &r.IsTeamLeader,
		&r.Region, &r.Province, &r.Status, &r.Email, &r.AccessCode,
		&r.IDNumber, &r.Phone, &r.ResidentialAddress, &r.PostalCode)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

type DeleteRepRequest struct {
	RepCode string `json:"repCode"`
}

type DeleteRepResponse struct {
	OK bool `json:"ok"`
}

// DeleteRep is SuperAdmin-only. As a safety measure it only removes reps that
// are Inactive (pending / not activated) — an Active rep with real accounting
// history can't be deleted here, so onboarded partners, subscriptions and
// commissions are never orphaned by an accidental delete. Use it to clean up
// duplicate or abandoned applications.
//
//encore:api auth method=POST path=/auth/rep/delete
func DeleteRep(ctx context.Context, req *DeleteRepRequest) (*DeleteRepResponse, error) {
	data := FromContext(ctx)
	if data == nil || data.User == nil || data.User.Role != "SuperAdmin" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can delete reps"}
	}

	repCode := strings.TrimSpace(req.RepCode)
	if repCode == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "repCode is required"}
	}

	// Confirm the rep exists and is Inactive before deleting.
	var status string
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT COALESCE(rep_status,'') FROM users
		WHERE role = 'Rep' AND lower(rep_code) = lower($1)`, repCode,
	).Scan(&status)
	if isNoRows(err) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "rep not found"}
	}
	if err != nil {
		return nil, err
	}
	if strings.EqualFold(status, "Active") {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "this rep is Active — set them to Inactive first if you're sure you want to delete them"}
	}

	// Don't strand any reps who reported to this one: clear their upline.
	if _, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE users SET upline_rep_code = NULL
		WHERE role = 'Rep' AND lower(upline_rep_code) = lower($1)`, repCode,
	); err != nil {
		return nil, err
	}

	res, err := appdb.SQLDB.ExecContext(ctx, `
		DELETE FROM users WHERE role = 'Rep' AND lower(rep_code) = lower($1)`, repCode)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, &errs.Error{Code: errs.NotFound, Message: "rep not found"}
	}

	return &DeleteRepResponse{OK: true}, nil
}
