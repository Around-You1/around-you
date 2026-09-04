// Package partnerapp powers the public self-service partner application form
// (/apply). A prospective partner, referred by a rep's link, submits their
// details; the submission is stored as Pending and emailed to Accounts (reply-
// to/cc the referring rep). A rep/SuperAdmin reviews it in the dashboard and
// onboards the partner. Onboarding itself (tier, activation, billing) stays an
// internal step — this only captures the applicant's information.
package partnerapp

import (
	"context"
	"encoding/json"
	"html"
	"sort"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
	"backend_encore/internal/mailer"
	"backend_encore/internal/moderation"
)

const accountsEmail = "accounts@aroundyou.co.za"

var validCategory = map[string]string{
	"restaurant":    "Restaurant",
	"service":       "Service",
	"attraction":    "Attraction",
	"accommodation": "Accommodation",
	"estate":        "Real Estate & Rentals",
}

// ---- Public submit ----------------------------------------------------------

type SubmitRequest struct {
	Category      string            `json:"category"`
	RepCode       string            `json:"repCode"`
	BusinessName  string            `json:"businessName"`
	ContactName   string            `json:"contactName"`
	ContactEmail  string            `json:"contactEmail"`
	ContactNumber string            `json:"contactNumber"`
	Province      string            `json:"province"`
	Fields        map[string]string `json:"fields"` // all remaining form fields (category-specific)
	Agree         bool              `json:"agree"`
}

type SubmitResponse struct {
	OK bool  `json:"ok"`
	ID int64 `json:"id"`
}

//encore:api method=POST path=/partner-application
func SubmitPartnerApplication(ctx context.Context, req *SubmitRequest) (*SubmitResponse, error) {
	cat := strings.ToLower(strings.TrimSpace(req.Category))
	if _, ok := validCategory[cat]; !ok {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "please choose a valid partner category"}
	}
	name := strings.TrimSpace(req.BusinessName)
	if name == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "business name is required"}
	}
	if !req.Agree {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "please accept the Terms & Conditions and confirm your details are correct"}
	}
	if err := moderation.BlockError(
		moderation.NamedField{Name: "businessName", Value: name},
		moderation.NamedField{Name: "contactName", Value: req.ContactName},
	); err != nil {
		return nil, err
	}

	fields := req.Fields
	if fields == nil {
		fields = map[string]string{}
	}
	payload, _ := json.Marshal(fields)

	var id int64
	if err := appdb.SQLDB.QueryRowContext(ctx, `
		INSERT INTO partner_applications
		  (category, rep_code, business_name, contact_name, contact_email, contact_number, province, payload, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pending')
		RETURNING id`,
		cat, strings.TrimSpace(req.RepCode), name, strings.TrimSpace(req.ContactName),
		strings.TrimSpace(req.ContactEmail), strings.TrimSpace(req.ContactNumber),
		strings.TrimSpace(req.Province), string(payload),
	).Scan(&id); err != nil {
		return nil, err
	}

	// Email Accounts, reply-to/cc the referring rep so they can follow up.
	go func(r SubmitRequest, cat string, fields map[string]string) {
		bgctx := context.Background()
		repEmail := repEmailFor(bgctx, r.RepCode)
		subject := "New Partner Application — " + validCategory[cat] + " — " + name
		body := renderApplicationHTML(cat, &r, fields, repEmail)
		var cc []string
		if repEmail != "" {
			cc = []string{repEmail}
		}
		_ = mailer.SendOpts(accountsEmail, subject, body, repEmail, cc)
	}(*req, cat, fields)

	moderation.ScanAndFlag(ctx, "partner_application", "partner_application", id, name+" ("+validCategory[cat]+")", "Public Apply",
		moderation.NamedField{Name: "businessName", Value: name})

	return &SubmitResponse{OK: true, ID: id}, nil
}

func repEmailFor(ctx context.Context, repCode string) string {
	code := strings.TrimSpace(repCode)
	if code == "" {
		return ""
	}
	var email string
	_ = appdb.SQLDB.QueryRowContext(ctx,
		`SELECT COALESCE(rep_email,'') FROM users WHERE role = 'Rep' AND lower(rep_code) = lower($1)`, code,
	).Scan(&email)
	return strings.TrimSpace(email)
}

func renderApplicationHTML(cat string, r *SubmitRequest, fields map[string]string, repEmail string) string {
	esc := html.EscapeString
	row := func(k, v string) string {
		if strings.TrimSpace(v) == "" {
			return ""
		}
		return `<tr><td style="padding:5px 12px;color:#555;border-bottom:1px solid #eee;vertical-align:top">` + esc(k) +
			`</td><td style="padding:5px 12px;border-bottom:1px solid #eee"><b>` + esc(v) + `</b></td></tr>`
	}
	var b strings.Builder
	b.WriteString(`<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;color:#1a1f2e;">`)
	b.WriteString(`<h2 style="margin:0 0 6px;">New Partner Application</h2>`)
	b.WriteString(`<p style="margin:0 0 12px;">Category: <b style="color:#159a53">` + esc(validCategory[cat]) + `</b>`)
	if strings.TrimSpace(r.RepCode) != "" {
		b.WriteString(` &nbsp;·&nbsp; Referring rep: <b>` + esc(r.RepCode) + `</b>`)
	}
	b.WriteString(`</p><table style="border-collapse:collapse;font-size:14px;width:100%;">`)
	b.WriteString(row("Business name", r.BusinessName))
	b.WriteString(row("Contact person", r.ContactName))
	b.WriteString(row("Contact email", r.ContactEmail))
	b.WriteString(row("Contact number", r.ContactNumber))
	b.WriteString(row("Province", r.Province))
	// Remaining category-specific fields, sorted for stable output.
	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		b.WriteString(row(k, fields[k]))
	}
	b.WriteString(`</table>`)
	b.WriteString(`<p style="color:#777;font-size:12px;margin-top:14px;">Submitted via the Around You public application form. The applicant accepted the Terms & Conditions and confirmed the information is correct. Review and onboard from the Admin Dashboard.</p>`)
	b.WriteString(`</div>`)
	return b.String()
}

// ---- Admin list + status ----------------------------------------------------

type PartnerApplication struct {
	ID            int64             `json:"id"`
	Category      string            `json:"category"`
	RepCode       string            `json:"repCode"`
	BusinessName  string            `json:"businessName"`
	ContactName   string            `json:"contactName"`
	ContactEmail  string            `json:"contactEmail"`
	ContactNumber string            `json:"contactNumber"`
	Province      string            `json:"province"`
	Fields        map[string]string `json:"fields"`
	Status        string            `json:"status"`
	CreatedAt     string            `json:"createdAt"`
}

type ListRequest struct {
	Category string `query:"category"` // "" = all
	Status   string `query:"status"`   // "" = all (defaults to Pending in UI)
}

type ListResponse struct {
	Applications []PartnerApplication `json:"applications"`
}

//encore:api auth method=GET path=/partner-applications
func ListPartnerApplications(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	if !auth.IsPrivileged(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "not allowed"}
	}
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT id, category, COALESCE(rep_code,''), COALESCE(business_name,''),
		       COALESCE(contact_name,''), COALESCE(contact_email,''), COALESCE(contact_number,''),
		       COALESCE(province,''), COALESCE(payload::text,'{}'), status,
		       to_char(created_at, 'YYYY-MM-DD HH24:MI')
		FROM partner_applications
		WHERE ($1 = '' OR category = lower($1))
		  AND ($2 = '' OR status = $2)
		ORDER BY created_at DESC`,
		strings.TrimSpace(req.Category), strings.TrimSpace(req.Status),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []PartnerApplication{}
	for rows.Next() {
		var a PartnerApplication
		var payload string
		if err := rows.Scan(&a.ID, &a.Category, &a.RepCode, &a.BusinessName, &a.ContactName,
			&a.ContactEmail, &a.ContactNumber, &a.Province, &payload, &a.Status, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.Fields = map[string]string{}
		_ = json.Unmarshal([]byte(payload), &a.Fields)
		out = append(out, a)
	}
	return &ListResponse{Applications: out}, rows.Err()
}

type SetStatusRequest struct {
	ID     int64  `json:"id"`
	Status string `json:"status"` // Pending | Onboarded | Declined
}

type OKResponse struct {
	OK bool `json:"ok"`
}

//encore:api auth method=POST path=/partner-application/status
func SetApplicationStatus(ctx context.Context, req *SetStatusRequest) (*OKResponse, error) {
	if !auth.IsPrivileged(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "not allowed"}
	}
	st := strings.TrimSpace(req.Status)
	if st != "Pending" && st != "Onboarded" && st != "Declined" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid status"}
	}

	// Onboarding creates the actual partner record (Inactive) from the
	// application, so it shows up in the relevant admin list for the SuperAdmin
	// to add the map location, pick the tier, and activate. We only mark the
	// application Onboarded once the partner is created, so a failure here
	// leaves it Pending rather than losing the applicant's details.
	if st == "Onboarded" {
		app, err := loadApplication(ctx, req.ID)
		if err != nil {
			return nil, err
		}
		if app.Status != "Onboarded" { // idempotent: don't double-create
			if err := createPartnerFromApplication(ctx, app); err != nil {
				return nil, err
			}
		}
	}

	if _, err := appdb.SQLDB.ExecContext(ctx,
		`UPDATE partner_applications SET status = $2, updated_at = now() WHERE id = $1`, req.ID, st,
	); err != nil {
		return nil, err
	}
	return &OKResponse{OK: true}, nil
}
