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
	"backend_encore/internal/mailer"
	"backend_encore/store"
)

var (
	restaurants = store.NewRestaurantStore()
	services    = store.NewServiceStore()
	attractions = store.NewAttractionStore()
)

var validEntities = map[string]bool{"restaurant": true, "service": true, "attraction": true}

// localAlreadyRedeemedThisMonth reports whether a Local has already redeemed this
// partner's discount in the current calendar month. Locals are limited to one
// redemption per partner per calendar month; holiday guests are unrestricted.
func localAlreadyRedeemedThisMonth(ctx context.Context, voterKey, entityType string, entityID int64) (bool, error) {
	var cnt int
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM discount_redemptions
		WHERE voter_key = $1 AND voter_type = 'local_guest'
		  AND entity_type = $2 AND entity_id = $3
		  AND status = 'redeemed'
		  AND date_trunc('month', redeemed_at) = date_trunc('month', now())`,
		voterKey, entityType, entityID,
	).Scan(&cnt)
	return cnt > 0, err
}

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
	// Locals may redeem each partner's discount only once per calendar month.
	if voterType == "local_guest" {
		used, err := localAlreadyRedeemedThisMonth(ctx, voterKey, req.EntityType, req.EntityID)
		if err != nil {
			return nil, err
		}
		if used {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "You've already used this partner's discount this month. Locals can redeem each partner's discount once per calendar month."}
		}
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

// partnerNameEmail resolves a partner's display name and notification email.
func partnerNameEmail(ctx context.Context, entityType string, entityID int64) (name, email string) {
	switch entityType {
	case "restaurant":
		if r, e := restaurants.Get(ctx, entityID); e == nil {
			return r.Name, r.OfficialEmail
		}
	case "service":
		if svc, e := services.Get(ctx, entityID); e == nil {
			return svc.Name, svc.OfficialEmail
		}
	case "attraction":
		if a, e := attractions.Get(ctx, entityID); e == nil {
			return a.Name, a.OfficialEmail
		}
	}
	return "", ""
}

// guestAccommodationName returns the name of the accommodation a holiday guest
// (identified by their rating/voter key = user id) is booked into, or "".
func guestAccommodationName(ctx context.Context, voterKey string) string {
	id, err := strconv.ParseInt(voterKey, 10, 64)
	if err != nil {
		return ""
	}
	var name string
	_ = appdb.SQLDB.QueryRowContext(ctx,
		`SELECT COALESCE(a.name, '') FROM users u LEFT JOIN accommodations a ON a.id = u.accommodation_id WHERE u.id = $1`,
		id,
	).Scan(&name)
	return name
}

// notifyPartnerOfRedemption emails the partner that a guest/local has redeemed
// their discount. Best-effort: runs in its own goroutine with a background
// context and never affects the redemption result.
func notifyPartnerOfRedemption(entityType string, entityID int64, voterKey, voterType string) {
	ctx := context.Background()
	name, email := partnerNameEmail(ctx, entityType, entityID)
	email = strings.TrimSpace(email)
	if email == "" {
		return
	}
	var msg string
	if voterType == "local_guest" {
		msg = "The discount offer and code you have on your Around You Partner portal for Local has been redeemed."
	} else {
		acc := strings.TrimSpace(guestAccommodationName(ctx, voterKey))
		if acc == "" {
			acc = "an accommodation"
		}
		msg = "The discount offer and code you have on your Around You Partner portal for Guest has been redeemed by a guest booked into " + acc + "."
	}
	greeting := "Hi,"
	if strings.TrimSpace(name) != "" {
		greeting = "Hi " + strings.TrimSpace(name) + ","
	}
	html := "<p>" + greeting + "</p><p>" + msg + "</p><p>— Around You</p>"
	_ = mailer.Send(email, "Your Around You discount was redeemed", html)
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
	var status, voterKey, voterType string
	if err := appdb.SQLDB.QueryRowContext(ctx,
		`SELECT entity_type, entity_id, status, voter_key, voter_type FROM discount_redemptions WHERE token = $1`, token,
	).Scan(&entityType, &entityID, &status, &voterKey, &voterType); err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "this code is not valid"}
	}
	if status == "redeemed" {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "this discount has already been redeemed"}
	}
	// Enforce the Local monthly cap at scan time too (guards against a Local who
	// generated a token before already redeeming this partner this month).
	if voterType == "local_guest" {
		used, err := localAlreadyRedeemedThisMonth(ctx, voterKey, entityType, entityID)
		if err != nil {
			return nil, err
		}
		if used {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "This local has already redeemed this partner's discount this month."}
		}
	}
	if _, err := appdb.SQLDB.ExecContext(ctx,
		`UPDATE discount_redemptions SET status = 'redeemed', redeemed_at = now() WHERE token = $1 AND status = 'pending'`, token,
	); err != nil {
		return nil, err
	}
	go notifyPartnerOfRedemption(entityType, entityID, voterKey, voterType)
	return &RedeemResponse{OK: true, EntityType: entityType, EntityID: entityID}, nil
}
