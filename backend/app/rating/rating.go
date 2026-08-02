// Package rating implements star ratings (1-5) for Restaurant, Service, and
// Attraction — never Accommodation, since guests staying there never see
// their own listing. Only Guest (Holiday Guest) and LocalGuest roles may
// vote, and each is limited to one vote per partner.
//
// The "one vote" identity differs by guest type, inherited from how each
// signs in (see app/auth/auth.go):
//   - LocalGuest reuses the same users row across every login (keyed by
//     email), so their UserID is a stable, persistent identity — one vote
//     per partner really does mean one vote, ever.
//   - Guest (Holiday Guest) gets a brand new users row minted on every
//     login (the accommodation access code isn't personal to them), so
//     UserID is only stable for the current session. This is the strongest
//     identity available without adding friction to that login flow, but
//     it isn't airtight against someone deliberately signing in again.
package rating

import (
	"context"
	"strconv"

	"github.com/lib/pq"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

var validEntityTypes = map[string]string{
	"restaurant": "restaurants",
	"service":    "services",
	"attraction": "attractions",
}

func callerVoterKey(ctx context.Context) (voterKey, voterType string, err error) {
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
		return "", "", &errs.Error{Code: errs.PermissionDenied, Message: "only guests can rate partners"}
	}
	return strconv.FormatInt(data.UserID, 10), voterType, nil
}

//encore:api auth method=POST path=/rating/submit
func SubmitRating(ctx context.Context, req *SubmitRatingRequest) (*SubmitRatingResponse, error) {
	table, ok := validEntityTypes[req.EntityType]
	if !ok {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid entityType"}
	}
	if req.Stars < 1 || req.Stars > 5 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "stars must be between 1 and 5"}
	}
	if req.EntityID == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "entityId is required"}
	}

	voterKey, voterType, err := callerVoterKey(ctx)
	if err != nil {
		return nil, err
	}

	var exists bool
	if err := appdb.SQLDB.QueryRowContext(ctx,
		"SELECT EXISTS(SELECT 1 FROM "+table+" WHERE id = $1)", req.EntityID,
	).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, &errs.Error{Code: errs.NotFound, Message: req.EntityType + " not found"}
	}

	_, err = appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO ratings (entity_type, entity_id, voter_key, voter_type, stars)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (entity_type, entity_id, voter_key)
		DO UPDATE SET stars = excluded.stars, updated_at = now()`,
		req.EntityType, req.EntityID, voterKey, voterType, req.Stars,
	)
	if err != nil {
		return nil, err
	}

	summary, err := loadSummary(ctx, req.EntityType, req.EntityID, voterKey)
	if err != nil {
		return nil, err
	}
	return &SubmitRatingResponse{Summary: *summary}, nil
}

func loadSummary(ctx context.Context, entityType string, entityID int64, voterKey string) (*Summary, error) {
	s := &Summary{EntityType: entityType, EntityID: entityID}
	var avg *float64
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT avg(stars), count(*) FROM ratings WHERE entity_type = $1 AND entity_id = $2`,
		entityType, entityID,
	).Scan(&avg, &s.RatingCount)
	if err != nil {
		return nil, err
	}
	if avg != nil {
		s.AverageRating = *avg
	}

	if voterKey != "" {
		var mine int
		err := appdb.SQLDB.QueryRowContext(ctx, `
			SELECT stars FROM ratings WHERE entity_type = $1 AND entity_id = $2 AND voter_key = $3`,
			entityType, entityID, voterKey,
		).Scan(&mine)
		if err == nil {
			s.MyRating = mine
		}
	}
	return s, nil
}

//encore:api auth method=POST path=/rating/summaries
func ListSummaries(ctx context.Context, req *ListSummariesRequest) (*ListSummariesResponse, error) {
	if _, ok := validEntityTypes[req.EntityType]; !ok {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid entityType"}
	}
	if len(req.EntityIDs) == 0 {
		return &ListSummariesResponse{Summaries: []Summary{}}, nil
	}

	// voterKey is best-effort here — an unauthenticated or non-guest caller
	// just won't get a MyRating on each summary, which is fine since list
	// views work whether or not the viewer has voted yet.
	var voterKey string
	if data := auth.FromContext(ctx); data != nil && data.User != nil &&
		(data.User.Role == "LocalGuest" || data.User.Role == "Guest") {
		voterKey = strconv.FormatInt(data.UserID, 10)
	}

	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT entity_id, avg(stars), count(*)
		FROM ratings
		WHERE entity_type = $1 AND entity_id = ANY($2)
		GROUP BY entity_id`,
		req.EntityType, pq.Array(req.EntityIDs),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byID := make(map[int64]*Summary, len(req.EntityIDs))
	for rows.Next() {
		var id int64
		var avg float64
		var count int
		if err := rows.Scan(&id, &avg, &count); err != nil {
			return nil, err
		}
		byID[id] = &Summary{EntityType: req.EntityType, EntityID: id, AverageRating: avg, RatingCount: count}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if voterKey != "" {
		mineRows, err := appdb.SQLDB.QueryContext(ctx, `
			SELECT entity_id, stars FROM ratings
			WHERE entity_type = $1 AND entity_id = ANY($2) AND voter_key = $3`,
			req.EntityType, pq.Array(req.EntityIDs), voterKey,
		)
		if err != nil {
			return nil, err
		}
		defer mineRows.Close()
		for mineRows.Next() {
			var id int64
			var stars int
			if err := mineRows.Scan(&id, &stars); err != nil {
				return nil, err
			}
			if s, ok := byID[id]; ok {
				s.MyRating = stars
			}
		}
		if err := mineRows.Err(); err != nil {
			return nil, err
		}
	}

	out := make([]Summary, 0, len(req.EntityIDs))
	for _, id := range req.EntityIDs {
		if s, ok := byID[id]; ok {
			out = append(out, *s)
		} else {
			out = append(out, Summary{EntityType: req.EntityType, EntityID: id})
		}
	}
	return &ListSummariesResponse{Summaries: out}, nil
}
