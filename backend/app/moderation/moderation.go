// Package moderation exposes the SuperAdmin-facing content-moderation review
// API: list the flags raised by internal/moderation when partner profiles or
// rep onboarding contained profanity/abuse/discrimination, and mark them
// reviewed or dismissed. Read/write is restricted to SuperAdmin.
package moderation

import (
	"context"
	"database/sql"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

func requireSuperAdmin(ctx context.Context) error {
	d := auth.FromContext(ctx)
	if d == nil || d.User == nil || d.User.Role != "SuperAdmin" {
		return &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can view moderation flags"}
	}
	return nil
}

// Flag is one recorded content-moderation hit.
type Flag struct {
	ID          int64  `json:"id"`
	Source      string `json:"source"`
	EntityType  string `json:"entityType"`
	EntityID    int64  `json:"entityId"`
	Subject     string `json:"subject"`
	Field       string `json:"field"`
	Category    string `json:"category"`
	MatchedTerm string `json:"matchedTerm"`
	Snippet     string `json:"snippet"`
	Actor       string `json:"actor"`
	Status      string `json:"status"`
	ReviewedBy  string `json:"reviewedBy"`
	ReviewedAt  string `json:"reviewedAt"`
	CreatedAt   string `json:"createdAt"`
}

type ListFlagsResponse struct {
	Flags      []Flag `json:"flags"`
	OpenCount  int    `json:"openCount"`
	TotalCount int    `json:"totalCount"`
}

// ListFlags returns the most recent flags (open first), plus the count of open
// flags for the dashboard alert badge. SuperAdmin only.
//
//encore:api auth method=GET path=/moderation/flags
func ListFlags(ctx context.Context) (*ListFlagsResponse, error) {
	if err := requireSuperAdmin(ctx); err != nil {
		return nil, err
	}
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT id, source, entity_type, COALESCE(entity_id, 0), subject, field, category,
		       matched_term, snippet, actor, status, reviewed_by,
		       COALESCE(to_char(reviewed_at, 'YYYY-MM-DD HH24:MI'), ''),
		       COALESCE(to_char(created_at,  'YYYY-MM-DD HH24:MI'), '')
		FROM moderation_flags
		ORDER BY (status = 'open') DESC, created_at DESC
		LIMIT 500`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := &ListFlagsResponse{Flags: []Flag{}}
	for rows.Next() {
		var f Flag
		var entityID sql.NullInt64
		if err := rows.Scan(&f.ID, &f.Source, &f.EntityType, &entityID, &f.Subject, &f.Field,
			&f.Category, &f.MatchedTerm, &f.Snippet, &f.Actor, &f.Status, &f.ReviewedBy,
			&f.ReviewedAt, &f.CreatedAt); err != nil {
			return nil, err
		}
		f.EntityID = entityID.Int64
		if f.Status == "open" {
			out.OpenCount++
		}
		out.TotalCount++
		out.Flags = append(out.Flags, f)
	}
	return out, rows.Err()
}

type SetFlagStatusRequest struct {
	ID     int64  `json:"id"`
	Status string `json:"status"`
}

type SetFlagStatusResponse struct {
	OK bool `json:"ok"`
}

// SetFlagStatus marks a flag reviewed / dismissed / open. SuperAdmin only.
//
//encore:api auth method=POST path=/moderation/flag-status
func SetFlagStatus(ctx context.Context, req *SetFlagStatusRequest) (*SetFlagStatusResponse, error) {
	if err := requireSuperAdmin(ctx); err != nil {
		return nil, err
	}
	status := strings.TrimSpace(req.Status)
	switch status {
	case "open", "reviewed", "dismissed":
	default:
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "status must be open, reviewed, or dismissed"}
	}
	reviewer := auth.ActorLabel(ctx)
	if _, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE moderation_flags
		SET status = $2,
		    reviewed_by = CASE WHEN $2 = 'open' THEN '' ELSE $3 END,
		    reviewed_at = CASE WHEN $2 = 'open' THEN NULL ELSE now() END
		WHERE id = $1`,
		req.ID, status, reviewer,
	); err != nil {
		return nil, err
	}
	return &SetFlagStatusResponse{OK: true}, nil
}
