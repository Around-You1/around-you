// Package admin implements SuperAdmin-only bulk operations on partner profiles:
// bulk activate/deactivate, bulk delete (archive), and the archive view with
// reinstate + permanent purge.
//
// Lifecycle rules (per Dave's spec):
//   * Deactivate  -> is_active=false AND the profile's Access Code + Edit Code
//                    are disabled (access code toggled inactive, edit code
//                    rotated to a fresh unknown value).
//   * Activate    -> is_active=true AND brand-new Access + Edit codes are issued.
//   * Delete      -> the full profile is moved to archived_partners (a JSON
//                    snapshot) and removed from its live table; its codes go
//                    with it.
//   * Reinstate   -> the profile is re-created from the snapshot with a NEW id
//                    and brand-new Access + Edit codes; the archive row is removed.
//   * Purge       -> the archive row is permanently deleted.
package admin

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/billing"
	"backend_encore/internal/errs"
	"backend_encore/store"
)

var (
	restaurants    = store.NewRestaurantStore()
	services       = store.NewServiceStore()
	attractions    = store.NewAttractionStore()
	accommodations = store.NewStore()
)

var tables = map[string]string{
	"restaurant":    "restaurants",
	"service":       "services",
	"attraction":    "attractions",
	"accommodation": "accommodations",
}

func requireSuperAdmin(ctx context.Context) error {
	d := auth.FromContext(ctx)
	if d == nil || d.User == nil || d.User.Role != "SuperAdmin" {
		return &errs.Error{Code: errs.PermissionDenied, Message: "only a SuperAdmin can manage profiles in bulk"}
	}
	return nil
}

func intInClause(ids []int64) string {
	var b strings.Builder
	b.WriteString("(")
	for i, id := range ids {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString(strconv.FormatInt(id, 10))
	}
	b.WriteString(")")
	return b.String()
}

// --- Bulk activate / deactivate ------------------------------------------------

type BulkRequest struct {
	EntityType string  `json:"entityType"`
	IDs        []int64 `json:"ids"`
	Active     bool    `json:"active"` // used by BulkSetActive
}

type BulkResponse struct {
	Affected int `json:"affected"`
}

// BulkSetActive sets is_active for the given profiles and updates their codes:
// deactivating disables both codes; activating issues fresh ones.
//
//encore:api auth method=POST path=/admin/bulk-set-active
func BulkSetActive(ctx context.Context, req *BulkRequest) (*BulkResponse, error) {
	if err := requireSuperAdmin(ctx); err != nil {
		return nil, err
	}
	table, ok := tables[req.EntityType]
	if !ok {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "unknown entity type"}
	}
	if len(req.IDs) == 0 {
		return &BulkResponse{}, nil
	}
	if _, err := appdb.SQLDB.ExecContext(ctx,
		fmt.Sprintf("UPDATE %s SET is_active = $1, updated_at = now() WHERE id IN %s", table, intInClause(req.IDs)),
		req.Active,
	); err != nil {
		return nil, err
	}
	for _, id := range req.IDs {
		if req.Active {
			enableCodes(ctx, req.EntityType, id)
			// Activation is what triggers a partner's first invoice + starts the
			// monthly billing cycle (idempotent: a re-activation won't re-invoice).
			if err := billing.OnPartnerActivated(ctx, req.EntityType, id); err != nil {
				log.Printf("admin: partner activated but invoicing failed (%s %d): %v", req.EntityType, id, err)
			}
		} else {
			disableCodes(ctx, req.EntityType, id)
			if err := billing.PausePartnerBilling(ctx, req.EntityType, id); err != nil {
				log.Printf("admin: could not pause billing on deactivate (%s %d): %v", req.EntityType, id, err)
			}
		}
	}
	return &BulkResponse{Affected: len(req.IDs)}, nil
}

// disableCodes turns the Access Code off and rotates the Edit Code so the old
// one stops working. Best-effort — errors are non-fatal.
func disableCodes(ctx context.Context, entityType string, id int64) {
	rot := appdb.RandomCode(10)
	switch entityType {
	case "restaurant":
		_ = restaurants.TogglePartnerCode(ctx, id, false)
		_, _ = restaurants.RegenerateEditCode(ctx, id, rot)
	case "service":
		_ = services.TogglePartnerCode(ctx, id, false)
		_, _ = services.RegenerateEditCode(ctx, id, rot)
	case "attraction":
		_ = attractions.TogglePartnerCode(ctx, id, false)
		_, _ = attractions.RegenerateEditCode(ctx, id, rot)
	case "accommodation":
		_ = accommodations.ToggleAccessCode(ctx, id, false)
		_, _ = accommodations.RegenerateEditCode(ctx, id, rot)
	}
}

// enableCodes issues a brand-new Access Code (active) and Edit Code.
func enableCodes(ctx context.Context, entityType string, id int64) {
	switch entityType {
	case "restaurant":
		_, _, _ = restaurants.RegeneratePartnerCode(ctx, id, appdb.RandomCode(10))
		_, _ = restaurants.RegenerateEditCode(ctx, id, appdb.RandomCode(10))
	case "service":
		_, _, _ = services.RegeneratePartnerCode(ctx, id, appdb.RandomCode(10))
		_, _ = services.RegenerateEditCode(ctx, id, appdb.RandomCode(10))
	case "attraction":
		_, _, _ = attractions.RegeneratePartnerCode(ctx, id, appdb.RandomCode(10))
		_, _ = attractions.RegenerateEditCode(ctx, id, appdb.RandomCode(10))
	case "accommodation":
		_, _, _ = accommodations.RegenerateAccessCode(ctx, id, appdb.RandomCode(12))
		_, _ = accommodations.RegenerateEditCode(ctx, id, appdb.RandomCode(10))
	}
}

// --- Bulk delete (archive) -----------------------------------------------------

// BulkDelete archives each profile (JSON snapshot in archived_partners) and
// removes it from its live table.
//
//encore:api auth method=POST path=/admin/bulk-delete
func BulkDelete(ctx context.Context, req *BulkRequest) (*BulkResponse, error) {
	if err := requireSuperAdmin(ctx); err != nil {
		return nil, err
	}
	if _, ok := tables[req.EntityType]; !ok {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "unknown entity type"}
	}
	actor := auth.ActorLabel(ctx)
	n := 0
	for _, id := range req.IDs {
		if err := archiveOne(ctx, req.EntityType, id, actor); err != nil {
			continue // best-effort; skip failures
		}
		n++
	}
	return &BulkResponse{Affected: n}, nil
}

func archiveOne(ctx context.Context, entityType string, id int64, actor string) error {
	var name, province, area string
	var payload []byte
	var err error

	switch entityType {
	case "restaurant":
		var r *appdb.Restaurant
		if r, err = restaurants.Get(ctx, id); err != nil {
			return err
		}
		name, province, area = r.Name, r.Province, r.Area
		payload, err = json.Marshal(r)
	case "service":
		var s *appdb.ServiceData
		if s, err = services.Get(ctx, id); err != nil {
			return err
		}
		name, province, area = s.Name, s.Province, s.Area
		payload, err = json.Marshal(s)
	case "attraction":
		var a *appdb.AttractionData
		if a, err = attractions.Get(ctx, id); err != nil {
			return err
		}
		name, province, area = a.Name, a.Province, a.Area
		payload, err = json.Marshal(a)
	case "accommodation":
		var a *appdb.Accommodation
		if a, err = accommodations.Get(ctx, id); err != nil {
			return err
		}
		name, province, area = a.Name, a.Province, a.Area
		payload, err = json.Marshal(a)
	default:
		return errors.New("unknown entity type")
	}
	if err != nil {
		return err
	}

	if _, err = appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO archived_partners (entity_type, original_id, name, province, area, payload, archived_by)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
		entityType, id, name, province, area, string(payload), actor,
	); err != nil {
		return err
	}
	return deleteLive(ctx, entityType, id)
}

func deleteLive(ctx context.Context, entityType string, id int64) error {
	switch entityType {
	case "restaurant":
		return restaurants.Delete(ctx, id)
	case "service":
		return services.Delete(ctx, id)
	case "attraction":
		return attractions.Delete(ctx, id)
	case "accommodation":
		return accommodations.Delete(ctx, id)
	}
	return nil
}

// --- Archive view: list / reinstate / purge -----------------------------------

type ArchivedRow struct {
	ID         int64  `json:"id"`
	EntityType string `json:"entityType"`
	OriginalID int64  `json:"originalId"`
	Name       string `json:"name"`
	Province   string `json:"province"`
	Area       string `json:"area"`
	ArchivedBy string `json:"archivedBy"`
	Reason     string `json:"reason"`
	ArchivedAt string `json:"archivedAt"`
}

type ListArchivedResponse struct {
	Archived []ArchivedRow `json:"archived"`
}

// ListArchived returns the recycle bin, newest first. SuperAdmin only.
//
//encore:api auth method=GET path=/admin/archived
func ListArchived(ctx context.Context) (*ListArchivedResponse, error) {
	if err := requireSuperAdmin(ctx); err != nil {
		return nil, err
	}
	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT id, entity_type, COALESCE(original_id, 0), name, province, area, archived_by, reason,
		       COALESCE(to_char(archived_at, 'YYYY-MM-DD HH24:MI'), '')
		FROM archived_partners
		ORDER BY archived_at DESC
		LIMIT 1000`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := &ListArchivedResponse{Archived: []ArchivedRow{}}
	for rows.Next() {
		var a ArchivedRow
		if err := rows.Scan(&a.ID, &a.EntityType, &a.OriginalID, &a.Name, &a.Province, &a.Area,
			&a.ArchivedBy, &a.Reason, &a.ArchivedAt); err != nil {
			return nil, err
		}
		out.Archived = append(out.Archived, a)
	}
	return out, rows.Err()
}

type ReinstateRequest struct {
	ArchiveID int64 `json:"archiveId"`
}

type ReinstateResponse struct {
	EntityType string `json:"entityType"`
	NewID      int64  `json:"newId"`
	Name       string `json:"name"`
	AccessCode string `json:"accessCode"`
	EditCode   string `json:"editCode"`
}

// Reinstate re-creates an archived profile with a new id and fresh codes, then
// removes the archive row. SuperAdmin only.
//
//encore:api auth method=POST path=/admin/reinstate
func Reinstate(ctx context.Context, req *ReinstateRequest) (*ReinstateResponse, error) {
	if err := requireSuperAdmin(ctx); err != nil {
		return nil, err
	}
	var entityType string
	var payload []byte
	err := appdb.SQLDB.QueryRowContext(ctx,
		`SELECT entity_type, payload FROM archived_partners WHERE id = $1`, req.ArchiveID,
	).Scan(&entityType, &payload)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "archived profile not found"}
	}
	if err != nil {
		return nil, err
	}

	resp := &ReinstateResponse{EntityType: entityType}
	switch entityType {
	case "restaurant":
		var r appdb.Restaurant
		if err := json.Unmarshal(payload, &r); err != nil {
			return nil, err
		}
		r.ID = 0
		r.IsActive = true
		r.ProfileReferenceCode = appdb.RandomCode(12)
		r.PartnerCode = appdb.PartnerCode{Code: appdb.RandomCode(10), Active: true}
		created, err := restaurants.Create(ctx, &r)
		if err != nil {
			return nil, err
		}
		edit, _ := restaurants.GetEditCode(ctx, created.ID)
		resp.NewID, resp.Name, resp.AccessCode, resp.EditCode = created.ID, created.Name, created.PartnerCode.Code, edit
	case "service":
		var s appdb.ServiceData
		if err := json.Unmarshal(payload, &s); err != nil {
			return nil, err
		}
		s.ID = 0
		s.IsActive = true
		s.ProfileReferenceCode = appdb.RandomCode(12)
		s.PartnerCode = appdb.PartnerCode{Code: appdb.RandomCode(10), Active: true}
		created, err := services.Create(ctx, &s)
		if err != nil {
			return nil, err
		}
		edit, _ := services.GetEditCode(ctx, created.ID)
		resp.NewID, resp.Name, resp.AccessCode, resp.EditCode = created.ID, created.Name, created.PartnerCode.Code, edit
	case "attraction":
		var a appdb.AttractionData
		if err := json.Unmarshal(payload, &a); err != nil {
			return nil, err
		}
		a.ID = 0
		a.IsActive = true
		a.ProfileReferenceCode = appdb.RandomCode(12)
		a.PartnerCode = appdb.PartnerCode{Code: appdb.RandomCode(10), Active: true}
		created, err := attractions.Create(ctx, &a)
		if err != nil {
			return nil, err
		}
		edit, _ := attractions.GetEditCode(ctx, created.ID)
		resp.NewID, resp.Name, resp.AccessCode, resp.EditCode = created.ID, created.Name, created.PartnerCode.Code, edit
	case "accommodation":
		var a appdb.Accommodation
		if err := json.Unmarshal(payload, &a); err != nil {
			return nil, err
		}
		a.ID = 0
		a.IsActive = true
		created, err := accommodations.Create(ctx, &a) // regenerates profile_reference_code + edit_code via defaults
		if err != nil {
			return nil, err
		}
		access, _, _ := accommodations.GetAccessCode(ctx, created.ID)
		edit, _ := accommodations.GetEditCode(ctx, created.ID)
		resp.NewID, resp.Name, resp.AccessCode, resp.EditCode = created.ID, created.Name, access, edit
	default:
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "unknown entity type"}
	}

	if _, err := appdb.SQLDB.ExecContext(ctx, `DELETE FROM archived_partners WHERE id = $1`, req.ArchiveID); err != nil {
		return nil, err
	}
	return resp, nil
}

// PurgeArchived permanently deletes an archive row. SuperAdmin only.
//
//encore:api auth method=POST path=/admin/purge
func PurgeArchived(ctx context.Context, req *ReinstateRequest) (*BulkResponse, error) {
	if err := requireSuperAdmin(ctx); err != nil {
		return nil, err
	}
	if _, err := appdb.SQLDB.ExecContext(ctx, `DELETE FROM archived_partners WHERE id = $1`, req.ArchiveID); err != nil {
		return nil, err
	}
	return &BulkResponse{Affected: 1}, nil
}
