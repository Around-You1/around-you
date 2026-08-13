// Package redemption handles verified discount redemptions: a guest starts a
// redemption (getting a one-time token shown as a QR), and a restaurant redeems
// it by scanning. A redeemed record is the proof-of-visit that unlocks the
// guest's rating for that partner (enforced in app/rating).
package redemption

import (
	"context"
	"strconv"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

var validEntities = map[string]bool{"restaurant": true, "service": true, "attraction": true}

// voterIdentity returns the caller's stable rating identity (matches
// ratings.voter_key) and rejects non-guest callers.
func voterIdentity(ctx context.Context) (voterKey, voterType string, err error) {
	data := auth.FromContext(ctx)
	if data == nil || data.User == nil {
		return "", "", &errs.Error{Code: errs.Unauthenticated, Message: "sign in required"}
	}
	switch data.User.Role {
	case "LocalGuest":
		voterType = "local_guest"
	case "Guest":
		voterType = "holiday_guest"
	default:
		return "", "", &errs.Error{Code: errs.PermissionDenied, Message: "only guests can redeem discounts"}
	}
	return strconv.FormatInt(data.UserID, 10), voterType, nil
}

type StartRequest struct {
	EntityType string `json:"entityType"`
	EntityID   int64  `json:"entityId"`
}

type StartResponse struct {
	Token string `json:"token"`
}

// Start creates a pending redemption for the signed-in guest and returns a
// one-time token to render as a QR. The restaurant redeems it by scanning.
//
//encore:api auth method=POST path=/redemption/start
func Start(ctx context.Context, req *StartRequest) (*StartResponse, error) {
	if !validEntities[req.EntityType] || req.EntityID == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid partner"}
	}
	voterKey, voterType, err := voterIdentity(ctx)
	if err != nil {
		return nil, err
	}
	token := appdb.RandomCode(24)
	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO discount_redemptions (token, entity_type, entity_id, voter_key, voter_type, status)
		VALUES ($1, $2, $3, $4, $5, 'pending')`,
		token, req.EntityType, req.EntityID, voterKey, voterType,
	); err != nil {
		return nil, err
	}
	return &StartResponse{Token: token}, nil
}

type RedeemRequest struct {
	Token string `json:"token"`
}

type RedeemResponse struct {
	OK         bool   `json:"ok"`
	EntityType string `json:"entityType"`
	EntityID   int64  `json:"entityId"`
}

// Redeem marks a scanned token as redeemed. Any signed-in caller may redeem (the
// token itself is the unguessable secret produced by the guest's app), so a
// restaurant scanning a guest's QR completes the redemption.
//
//encore:api auth method=POST path=/redemption/redeem
func Redeem(ctx context.Context, req *RedeemRequest) (*RedeemResponse, error) {
	token := strings.TrimSpace(req.Token)
	if token == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "no code scanned"}
	}
	var entityType string
	var entityID int64
	var status string
	if err := appdb.SQLDB.QueryRowContext(ctx,
		`SELECT entity_type, entity_id, status FROM discount_redemptions WHERE token = $1`, token,
	).Scan(&entityType, &entityID, &status); err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "this code is not valid"}
	}
	if status == "redeemed" {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "this discount has already been redeemed"}
	}
	if _, err := appdb.SQLDB.ExecContext(ctx,
		`UPDATE discount_redemptions SET status = 'redeemed', redeemed_at = now() WHERE token = $1 AND status = 'pending'`, token,
	); err != nil {
		return nil, err
	}
	return &RedeemResponse{OK: true, EntityType: entityType, EntityID: entityID}, nil
}
