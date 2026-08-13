package booking

import "backend_encore/internal/appdb"

type CreateRequest struct {
	EntityType    string              `json:"entityType"`
	EntityID      int64               `json:"entityId"`
	CustomerName  string              `json:"customerName"`
	CustomerEmail string              `json:"customerEmail"`
	CustomerPhone string              `json:"customerPhone,omitempty"`
	BookingDate   string              `json:"bookingDate"`
	BookingTime   string              `json:"bookingTime,omitempty"`
	Items         []appdb.BookingItem `json:"items"`
	PartySize     int                 `json:"partySize,omitempty"` // restaurant table bookings: headcount
}

type MineRequest struct {
	Email string `query:"email"`
}

type ForPartnerRequest struct {
	EntityType string `query:"entityType"`
	EntityID   int64  `query:"entityId"`
}

type ListResponse struct {
	Bookings []appdb.Booking `json:"bookings"`
}

type CancelRequest struct {
	ID    int64  `json:"id"`
	Email string `json:"email"`
}

type CancelResponse struct {
	Success bool `json:"success"`
}

// UpdateRequest reschedules an existing booking. Only the client (verified by
// matching email) can do this; items/total are unchanged.
type UpdateRequest struct {
	ID          int64  `json:"id"`
	Email       string `json:"email"`
	BookingDate string `json:"bookingDate"`
	BookingTime string `json:"bookingTime,omitempty"`
}

type UpdateResponse struct {
	Success bool `json:"success"`
}
