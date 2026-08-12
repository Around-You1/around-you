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
	"fmt"
	"os"
	"strconv"
	"strings"

	"golang.org/x/crypto/bcrypt"

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

	return &LoginResponse{Token: token, User: u}, nil
}

// LoginRequest matches AdminLoginPage.tsx's `backend.auth.login({role, email,
// password})` call. Role is accepted but not itself the security check —
// what actually matters is whether the account found by email has
// role == "SuperAdmin" AND the password matches its stored hash.
type LoginRequest struct {
	Role     string `json:"role"`
	Email    string `json:"email"`
	Password string `json:"password"`
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

	return issueSession(ctx, &u)
}

// RepLoginRequest matches the Rep sign-in panel: full name + a rep code
// (e.g. "Rep00000001") instead of a password. Rep accounts are created only
// by a SuperAdmin via CreateRep below — there is no self-service signup.
type RepLoginRequest struct {
	FullName string `json:"fullName"`
	RepCode  string `json:"repCode"`
}

//encore:api public method=POST path=/auth/rep-login
func RepLogin(ctx context.Context, req *RepLoginRequest) (*LoginResponse, error) {
	fullName := strings.TrimSpace(req.FullName)
	repCode := strings.TrimSpace(req.RepCode)
	if fullName == "" || repCode == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "full name and rep code are required"}
	}

	var u appdb.User
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT id, email, role, full_name, rep_code
		FROM users
		WHERE role = 'Rep' AND lower(full_name) = lower($1) AND lower(rep_code) = lower($2)`,
		fullName, repCode,
	).Scan(&u.ID, &u.Email, &u.Role, &u.FullName, &u.RepCode)
	if err != nil {
		if isNoRows(err) {
			// Same generic message either way — don't reveal which part
			// (name vs. code) was wrong.
			return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid full name or rep code"}
		}
		return nil, err
	}

	return issueSession(ctx, &u)
}

// AccLoginRequest is the accountant sign-in: a single shared access code,
// checked against the ACC_ACCESS_CODE env var (a Fly secret). No self-service
// signup and no per-person accounts yet — this is the shell the accounting
// analytics will hang off later.
type AccLoginRequest struct {
	AccessCode string `json:"accessCode"`
}

//encore:api public method=POST path=/auth/acc-login
func AccLogin(ctx context.Context, req *AccLoginRequest) (*LoginResponse, error) {
	code := strings.TrimSpace(req.AccessCode)
	if code == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "access code is required"}
	}
	expected := strings.TrimSpace(os.Getenv("ACC_ACCESS_CODE"))
	if expected == "" {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "accountant access is not configured"}
	}
	if !strings.EqualFold(code, expected) {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid access code"}
	}

	// Reuse a single accountant user row across logins rather than creating a
	// new one every time (same idea as the LocalGuest dedupe).
	const accEmail = "accountant@aroundyou.co.za"
	var u appdb.User
	err := appdb.SQLDB.QueryRowContext(ctx,
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
		INSERT INTO users (email, role, full_name, rep_code, rep_email)
		VALUES ($1, 'Rep', $2, $3, NULLIF($4, ''))`,
		email, fullName, repCode, strings.TrimSpace(req.Email),
	); err != nil {
		return nil, err
	}

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
		       COALESCE(rep_email, '')
		FROM users WHERE role = 'Rep' ORDER BY rep_code ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reps := []Rep{}
	for rows.Next() {
		var r Rep
		if err := rows.Scan(&r.ID, &r.FullName, &r.RepCode,
			&r.UplineRepCode, &r.IsTeamLeader, &r.Region, &r.Province, &r.Status, &r.Email); err != nil {
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
	RepCode       string `json:"repCode"`
	UplineRepCode string `json:"uplineRepCode"` // "" clears the upline
	IsTeamLeader  bool   `json:"isTeamLeader"`
	Region        string `json:"region"`
	Province      string `json:"province"`
	Status        string `json:"status"` // "Active" | "Inactive"
	Email         string `json:"email"`
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

	res, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE users
		SET upline_rep_code = NULLIF($2, ''),
		    is_team_leader  = $3,
		    region          = NULLIF($4, ''),
		    province        = NULLIF($5, ''),
		    rep_status      = $6,
		    rep_email       = NULLIF($7, '')
		WHERE role = 'Rep' AND lower(rep_code) = lower($1)`,
		repCode, upline, req.IsTeamLeader,
		strings.TrimSpace(req.Region), strings.TrimSpace(req.Province), status,
		strings.TrimSpace(req.Email),
	)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, &errs.Error{Code: errs.NotFound, Message: "rep not found"}
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
		       COALESCE(rep_email, '')
		FROM users WHERE role = 'Rep' AND lower(rep_code) = lower($1)`, repCode,
	).Scan(&r.ID, &r.FullName, &r.RepCode, &r.UplineRepCode, &r.IsTeamLeader,
		&r.Region, &r.Province, &r.Status, &r.Email)
	if err != nil {
		return nil, err
	}
	return &r, nil
}
