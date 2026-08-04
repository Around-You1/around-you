package booking

import "backend_encore/internal/appdb"

// CreateRequest is what the guest sends. Prices are NOT trusted from the
// client — the handler re-prices from the partner's own bookable items by
// matching item names. Only entityType, entityId, the customer contact
// details, date/time and the chosen item names matter here.
type CreateRequest struct {
	EntityType    string              `json:"entityType"`
	EntityID      int64               `json:"entityId"`
	CustomerName  string              `json:"customerName"`
	CustomerEmail string              `json:"customerEmail"`
	CustomerPhone string              `json:"customerPhone,omitempty"`
	BookingDate   string              `json:"bookingDate"`
	BookingTime   string              `json:"bookingTime,omitempty"`
	Items         []appdb.BookingItem `json:"items"`
}

// MineRequest looks up a client's bookings by the email they booked with.
type MineRequest struct {
	Email string `query:"email"`
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
