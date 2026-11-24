package push

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/lib/pq"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

// Ward councillors register (pending), a SuperAdmin approves (issuing an access
// code), and they then post geo-scoped alerts to residents/partners in their
// wards' postal codes. Reuses the push fanout + the notifications inbox.

func councillorHash(code string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(code)))
	return hex.EncodeToString(sum[:])
}

func councillorGenCode() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 10)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return "WC-" + string(b)
}

func councillorIsSuperAdmin(ctx context.Context) bool {
	d := auth.FromContext(ctx)
	return d != nil && d.User != nil && d.User.Role == "SuperAdmin"
}

func cleanCodes(in []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, c := range in {
		c = strings.TrimSpace(c)
		if c == "" || seen[c] {
			continue
		}
		seen[c] = true
		out = append(out, c)
	}
	return out
}

// ---- Public registration ----

type CouncillorRegisterRequest struct {
	FullName    string   `json:"fullName"`
	IDNumber    string   `json:"idNumber"`
	StaffNumber string   `json:"staffNumber"`
	PostalCodes []string `json:"postalCodes"`
}
type CouncillorRegisterResponse struct {
	OK bool `json:"ok"`
}

//encore:api public method=POST path=/councillor/register
func CouncillorRegister(ctx context.Context, req *CouncillorRegisterRequest) (*CouncillorRegisterResponse, error) {
	name := strings.TrimSpace(req.FullName)
	if name == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "full name is required"}
	}
	codes := cleanCodes(req.PostalCodes)
	if len(codes) == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "at least one postal code is required"}
	}
	if _, err := appdb.SQLDB.ExecContext(ctx,
		`INSERT INTO ward_councillors (full_name, id_number, staff_number, postal_codes, status)
		 VALUES ($1, $2, $3, $4, 'pending')`,
		name, strings.TrimSpace(req.IDNumber), strings.TrimSpace(req.StaffNumber), pq.Array(codes)); err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: err.Error()}
	}
	return &CouncillorRegisterResponse{OK: true}, nil
}

// ---- Admin: list / approve / enable-disable ----

type CouncillorRow struct {
	ID          int64    `json:"id"`
	FullName    string   `json:"fullName"`
	IDNumber    string   `json:"idNumber"`
	StaffNumber string   `json:"staffNumber"`
	PostalCodes []string `json:"postalCodes"`
	Status      string   `json:"status"`
	CreatedAt   string   `json:"createdAt"`
}
type CouncillorsResponse struct {
	Councillors []CouncillorRow `json:"councillors"`
}

//encore:api auth method=GET path=/admin/councillors
func ListCouncillors(ctx context.Context) (*CouncillorsResponse, error) {
	if !councillorIsSuperAdmin(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view councillors"}
	}
	rows, err := appdb.SQLDB.QueryContext(ctx,
		`SELECT id, full_name, COALESCE(id_number,''), COALESCE(staff_number,''), postal_codes, status, created_at
		 FROM ward_councillors ORDER BY (status = 'pending') DESC, created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CouncillorRow{}
	for rows.Next() {
		var r CouncillorRow
		var created time.Time
		var codes pq.StringArray
		if err := rows.Scan(&r.ID, &r.FullName, &r.IDNumber, &r.StaffNumber, &codes, &r.Status, &created); err != nil {
			return nil, err
		}
		r.PostalCodes = []string(codes)
		r.CreatedAt = created.UTC().Format(time.RFC3339)
		out = append(out, r)
	}
	return &CouncillorsResponse{Councillors: out}, rows.Err()
}

type CouncillorIDRequest struct {
	ID int64 `json:"id"`
}
type ApproveCouncillorResponse struct {
	AccessCode string `json:"accessCode"`
}

//encore:api auth method=POST path=/admin/councillors/approve
func ApproveCouncillor(ctx context.Context, req *CouncillorIDRequest) (*ApproveCouncillorResponse, error) {
	if !councillorIsSuperAdmin(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can approve councillors"}
	}
	code := councillorGenCode()
	res, err := appdb.SQLDB.ExecContext(ctx,
		`UPDATE ward_councillors SET code_hash = $2, status = 'active', approved_at = now(), approved_by = $3 WHERE id = $1`,
		req.ID, councillorHash(code), auth.ActorLabel(ctx))
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: err.Error()}
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, &errs.Error{Code: errs.NotFound, Message: "councillor not found"}
	}
	return &ApproveCouncillorResponse{AccessCode: code}, nil
}

type SetCouncillorStatusRequest struct {
	ID     int64  `json:"id"`
	Status string `json:"status"` // "active" | "disabled"
}
type CouncillorOKResponse struct {
	OK bool `json:"ok"`
}

//encore:api auth method=POST path=/admin/councillors/status
func SetCouncillorStatus(ctx context.Context, req *SetCouncillorStatusRequest) (*CouncillorOKResponse, error) {
	if !councillorIsSuperAdmin(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can change a councillor"}
	}
	if req.Status != "active" && req.Status != "disabled" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "status must be active or disabled"}
	}
	if _, err := appdb.SQLDB.ExecContext(ctx,
		`UPDATE ward_councillors SET status = $2 WHERE id = $1`, req.ID, req.Status); err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: err.Error()}
	}
	return &CouncillorOKResponse{OK: true}, nil
}

// ---- Councillor sign-in (by access code) + post alert ----

func councillorLookup(ctx context.Context, accessCode string) (int64, string, []string, error) {
	var id int64
	var name string
	var codes pq.StringArray
	err := appdb.SQLDB.QueryRowContext(ctx,
		`SELECT id, full_name, postal_codes FROM ward_councillors WHERE code_hash = $1 AND status = 'active'`,
		councillorHash(accessCode)).Scan(&id, &name, &codes)
	return id, name, []string(codes), err
}

type CouncillorMeRequest struct {
	AccessCode string `json:"accessCode"`
}
type CouncillorMeResponse struct {
	FullName    string   `json:"fullName"`
	PostalCodes []string `json:"postalCodes"`
}

//encore:api public method=POST path=/councillor/me
func CouncillorMe(ctx context.Context, req *CouncillorMeRequest) (*CouncillorMeResponse, error) {
	id, name, codes, err := councillorLookup(ctx, req.AccessCode)
	if err != nil || id == 0 {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "invalid or inactive access code"}
	}
	return &CouncillorMeResponse{FullName: name, PostalCodes: codes}, nil
}

type CouncillorAlertRequest struct {
	AccessCode string `json:"accessCode"`
	Title      string `json:"title"`
	Body       string `json:"body"`
	EndsAt     string `json:"endsAt"` // RFC3339, optional
}
type CouncillorAlertResponse struct {
	Sent int `json:"sent"`
}

//encore:api public method=POST path=/councillor/alert
func CouncillorAlert(ctx context.Context, req *CouncillorAlertRequest) (*CouncillorAlertResponse, error) {
	id, _, codes, err := councillorLookup(ctx, req.AccessCode)
	if err != nil || id == 0 {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "invalid or inactive access code"}
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "a title is required"}
	}
	if len(codes) == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "no postal codes assigned to this ward"}
	}
	var expiresAt *time.Time
	if e := strings.TrimSpace(req.EndsAt); e != "" {
		if t, perr := time.Parse(time.RFC3339, e); perr == nil {
			expiresAt = &t
		}
	}
	url := "/local-dashboard?notifications=1"
	// Log to the inbox, scoped to this ward's postal codes.
	_, _ = appdb.SQLDB.ExecContext(ctx,
		`INSERT INTO notifications (title, body, url, audience, expires_at, postal_codes) VALUES ($1, $2, $3, 'local', $4, $5)`,
		title, strings.TrimSpace(req.Body), url, expiresAt, pq.Array(codes))
	// Push to every subscribed device whose user is in one of these postal codes
	// (Locals and Accommodation partners alike).
	rows, err := appdb.SQLDB.QueryContext(ctx,
		`SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
		 FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id
		 WHERE u.postal_code = ANY($1)`, pq.Array(codes))
	if err != nil {
		return nil, err
	}
	var targets []pushTarget
	for rows.Next() {
		var t pushTarget
		if err := rows.Scan(&t.id, &t.endpoint, &t.p256dh, &t.auth); err != nil {
			rows.Close()
			return nil, err
		}
		targets = append(targets, t)
	}
	rows.Close()
	sent, _ := fanout(ctx, title, strings.TrimSpace(req.Body), url, targets)
	return &CouncillorAlertResponse{Sent: sent}, nil
}
