// Package editcode manages the per-partner "edit code" — a secret, separate
// from partner_code, that lets a partner unlock editing of their OWN profile
// from the Partner Dashboard.
//
//   - Get / Regenerate are admin/rep only (they reveal the code so it can be
//     shared with the partner out-of-band).
//   - Verify is what a partner calls: it checks a code they typed against the
//     stored one, and a Partner may only verify their own entity.
//
// The actual profile save reuses the existing PUT /{entity} update endpoint;
// the edit code gates access to the edit form.
package editcode

import (
	"context"
	"errors"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
	"backend_encore/store"
)

var (
	restaurants    = store.NewRestaurantStore()
	services       = store.NewServiceStore()
	attractions    = store.NewAttractionStore()
	accommodations = store.NewStore()
	estateAgencies = store.NewEstateAgencyStore()
	estateAgents   = store.NewEstateAgentStore()
)

type GetRequest struct {
	EntityType string `query:"entityType"`
	EntityID   int64  `query:"entityId"`
}

type CodeResponse struct {
	EditCode string `json:"editCode"`
}

type RegenerateRequest struct {
	EntityType string `json:"entityType"`
	EntityID   int64  `json:"entityId"`
}

type VerifyRequest struct {
	EntityType string `json:"entityType"`
	EntityID   int64  `json:"entityId"`
	Code       string `json:"code"`
}

type VerifyResponse struct {
	Valid bool `json:"valid"`
}

func getCode(ctx context.Context, entityType string, id int64) (string, error) {
	switch entityType {
	case "restaurant":
		return restaurants.GetEditCode(ctx, id)
	case "service":
		return services.GetEditCode(ctx, id)
	case "attraction":
		return attractions.GetEditCode(ctx, id)
	case "accommodation":
		return accommodations.GetEditCode(ctx, id)
	case "estate_agency":
		return estateAgencies.GetEditCode(ctx, id)
	case "estate_agent":
		return estateAgents.GetEditCode(ctx, id)
	default:
		return "", &errs.Error{Code: errs.InvalidArgument, Message: "invalid entityType"}
	}
}

func regenCode(ctx context.Context, entityType string, id int64, newCode string) (string, error) {
	switch entityType {
	case "restaurant":
		return restaurants.RegenerateEditCode(ctx, id, newCode)
	case "service":
		return services.RegenerateEditCode(ctx, id, newCode)
	case "attraction":
		return attractions.RegenerateEditCode(ctx, id, newCode)
	case "accommodation":
		return accommodations.RegenerateEditCode(ctx, id, newCode)
	case "estate_agency":
		return estateAgencies.RegenerateEditCode(ctx, id, newCode)
	case "estate_agent":
		return estateAgents.RegenerateEditCode(ctx, id, newCode)
	default:
		return "", &errs.Error{Code: errs.InvalidArgument, Message: "invalid entityType"}
	}
}

// privileged is true for the roles allowed to read/regenerate an edit code
// (never partners — they receive it out-of-band and only Verify).
func privileged(ctx context.Context) bool {
	d := auth.FromContext(ctx)
	if d == nil || d.User == nil {
		return false
	}
	switch d.User.Role {
	case "SuperAdmin", "Admin", "Rep":
		return true
	}
	return false
}

func mapNotFound(err error) error {
	if errors.Is(err, store.ErrRestaurantNotFound) ||
		errors.Is(err, store.ErrServiceNotFound) ||
		errors.Is(err, store.ErrAttractionNotFound) ||
		errors.Is(err, store.ErrNotFound) ||
		errors.Is(err, store.ErrEstateAgencyNotFound) ||
		errors.Is(err, store.ErrEstateAgentNotFound) {
		return &errs.Error{Code: errs.NotFound, Message: "partner not found"}
	}
	return err
}

// Get returns the edit code for an entity. Admin/Rep only.
//
//encore:api auth method=GET path=/edit-code
func Get(ctx context.Context, req *GetRequest) (*CodeResponse, error) {
	if !privileged(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "not allowed"}
	}
	code, err := getCode(ctx, req.EntityType, req.EntityID)
	if err != nil {
		return nil, mapNotFound(err)
	}
	return &CodeResponse{EditCode: code}, nil
}

// Regenerate issues a fresh edit code. Admin/Rep only.
//
//encore:api auth method=POST path=/edit-code/regenerate
func Regenerate(ctx context.Context, req *RegenerateRequest) (*CodeResponse, error) {
	if !privileged(ctx) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "not allowed"}
	}
	code, err := regenCode(ctx, req.EntityType, req.EntityID, appdb.RandomCode(10))
	if err != nil {
		return nil, mapNotFound(err)
	}
	return &CodeResponse{EditCode: code}, nil
}

// Verify checks a code a partner typed against the stored one. A Partner may
// only verify their OWN entity; admins/reps may verify any.
//
//encore:api auth method=POST path=/edit-code/verify
func Verify(ctx context.Context, req *VerifyRequest) (*VerifyResponse, error) {
	d := auth.FromContext(ctx)
	if d != nil && d.User != nil && d.User.Role == "Partner" {
		if d.User.EntityType != req.EntityType || d.User.EntityID != req.EntityID {
			return nil, &errs.Error{Code: errs.PermissionDenied, Message: "you can only edit your own profile"}
		}
	}
	code, err := getCode(ctx, req.EntityType, req.EntityID)
	if err != nil {
		return nil, mapNotFound(err)
	}
	entered := strings.TrimSpace(req.Code)
	valid := entered != "" && strings.EqualFold(entered, strings.TrimSpace(code))
	return &VerifyResponse{Valid: valid}, nil
}
