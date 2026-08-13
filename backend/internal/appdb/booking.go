package appdb

import "time"

// Booking is a customer's booking request against a Booking partner
// (a restaurant/service/attraction whose accessLevel is "Booking"). The
// selected items are snapshotted as JSON so the record stays accurate even
// if the partner later edits their item list or prices. Total and Commission
// are computed server-side at creation (commission = total * 0.10).
type Booking struct {
	ID            int64        `json:"id"`
	EntityType    string       `json:"entityType"` // "restaurant" | "service" | "attraction"
	EntityID      int64        `json:"entityId"`
	EntityName    string       `json:"entityName"`
	CustomerName  string       `json:"customerName"`
	CustomerEmail string       `json:"customerEmail"`
	CustomerPhone string       `json:"customerPhone"`
	BookingDate   string       `json:"bookingDate"` // "YYYY-MM-DD"
	BookingTime   string       `json:"bookingTime"`
	Items         BookingItems `json:"items"`
	Total         float64      `json:"total"`
	Commission    float64      `json:"commission"`
	PartySize     int          `json:"partySize"` // restaurant table bookings: headcount (0 for item bookings)
	Status        string       `json:"status"`    // pending | confirmed | completed | cancelled
	CreatedAt     time.Time    `json:"createdAt"`
	UpdatedAt     time.Time    `json:"updatedAt"`
}
