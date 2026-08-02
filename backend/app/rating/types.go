package rating

// SubmitRatingRequest matches the star-rating widget shown next to a
// Restaurant/Service/Attraction name once a guest opens its detail view.
type SubmitRatingRequest struct {
	EntityType string `json:"entityType"` // "restaurant" | "service" | "attraction"
	EntityID   int64  `json:"entityId"`
	Stars      int    `json:"stars"` // 1-5
}

// Summary is what the partner list views (RestaurantList.tsx etc.) render
// next to each name: the average, how many votes it's based on, and — if
// the caller has already voted — their own star count, so the UI can show
// "you rated this" instead of an empty/re-votable widget.
type Summary struct {
	EntityType    string  `json:"entityType"`
	EntityID      int64   `json:"entityId"`
	AverageRating float64 `json:"averageRating"`
	RatingCount   int     `json:"ratingCount"`
	MyRating      int     `json:"myRating,omitempty"`
}

type SubmitRatingResponse struct {
	Summary Summary `json:"summary"`
}

// ListSummariesRequest lets a list screen fetch ratings for every entity
// it's about to render in one round trip, instead of one call per row.
type ListSummariesRequest struct {
	EntityType string  `json:"entityType"`
	EntityIDs  []int64 `json:"entityIds"`
}

type ListSummariesResponse struct {
	Summaries []Summary `json:"summaries"`
}
