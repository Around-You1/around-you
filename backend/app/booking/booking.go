package booking

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"

	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
	"backend_encore/internal/mailer"
	"backend_encore/store"
)

var (
	bookings    = store.NewBookingStore()
	restaurants = store.NewRestaurantStore()
	services    = store.NewServiceStore()
	attractions = store.NewAttractionStore()
)

// partnerInfo pulls the fields the booking flow needs from whichever entity the
// booking is for: display name, notification email, whether it's a Booking
// partner, and its authoritative bookable items (used to price server-side).
func partnerInfo(ctx context.Context, entityType string, entityID int64) (name, email, accessLevel string, items appdb.BookingItems, err error) {
	switch entityType {
	case "restaurant":
		r, e := restaurants.Get(ctx, entityID)
		if e != nil {
			return "", "", "", nil, e
		}
		return r.Name, r.OfficialEmail, r.AccessLevel, r.BookingItems, nil
	case "service":
		s, e := services.Get(ctx, entityID)
		if e != nil {
			return "", "", "", nil, e
		}
		return s.Name, s.OfficialEmail, s.AccessLevel, s.BookingItems, nil
	case "attraction":
		a, e := attractions.Get(ctx, entityID)
		if e != nil {
			return "", "", "", nil, e
		}
		return a.Name, a.OfficialEmail, a.AccessLevel, a.BookingItems, nil
	default:
		return "", "", "", nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid entityType"}
	}
}

//encore:api auth method=POST path=/booking
func Create(ctx context.Context, req *CreateRequest) (*appdb.Booking, error) {
	if strings.TrimSpace(req.CustomerName) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "your name is required"}
	}
	if strings.TrimSpace(req.CustomerEmail) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "your email is required"}
	}
	if strings.TrimSpace(req.BookingDate) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "a booking date is required"}
	}
	if len(req.Items) == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "select at least one item"}
	}
	name, partnerEmail, accessLevel, partnerItems, err := partnerInfo(ctx, req.EntityType, req.EntityID)
	if err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "partner not found"}
	}
	if accessLevel != "Booking" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "this partner does not take bookings"}
	}
	priceByName := map[string]appdb.BookingItem{}
	for _, it := range partnerItems {
		priceByName[strings.ToLower(strings.TrimSpace(it.Name))] = it
	}
	chosen := appdb.BookingItems{}
	var total float64
	for _, it := range req.Items {
		if pi, ok := priceByName[strings.ToLower(strings.TrimSpace(it.Name))]; ok {
			chosen = append(chosen, pi)
			total += pi.Price
		}
	}
	if len(chosen) == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "the selected items are not offered by this partner"}
	}
	commission := math.Round(total*0.15*100) / 100
	b := &appdb.Booking{
		EntityType:    req.EntityType,
		EntityID:      req.EntityID,
		EntityName:    name,
		CustomerName:  strings.TrimSpace(req.CustomerName),
		CustomerEmail: strings.TrimSpace(req.CustomerEmail),
		CustomerPhone: strings.TrimSpace(req.CustomerPhone),
		BookingDate:   strings.TrimSpace(req.BookingDate),
		BookingTime:   strings.TrimSpace(req.BookingTime),
		Items:         chosen,
		Total:         total,
		Commission:    commission,
		Status:        "pending",
	}
	created, err := bookings.Create(ctx, b)
	if err != nil {
		return nil, err
	}

	// Best-effort partner alert email — never blocks or fails the booking.
	if strings.TrimSpace(partnerEmail) != "" {
		subject := "New booking request on Around You"
		go func() { _ = mailer.Send(strings.TrimSpace(partnerEmail), subject, bookingEmailHTML(created)) }()
	}

	return created, nil
}

func bookingEmailHTML(b *appdb.Booking) string {
	itemNames := make([]string, 0, len(b.Items))
	for _, it := range b.Items {
		itemNames = append(itemNames, it.Name)
	}
	when := b.BookingDate
	if b.BookingTime != "" {
		when += " at " + b.BookingTime
	}
	return fmt.Sprintf(
		`<h2>New booking request</h2>`+
			`<p>You have a new booking on Around You for <strong>%s</strong>.</p>`+
			`<ul>`+
			`<li><strong>When:</strong> %s</li>`+
			`<li><strong>Customer:</strong> %s%s</li>`+
			`<li><strong>Items:</strong> %s</li>`+
			`<li><strong>Total:</strong> R %.2f</li>`+
			`</ul>`+
			`<p>This booking is managed by the customer in the app. You cannot change or cancel it; only the customer can.</p>`,
		b.EntityName,
		when,
		b.CustomerName, contactSuffix(b),
		strings.Join(itemNames, ", "),
		b.Total,
	)
}

func contactSuffix(b *appdb.Booking) string {
	parts := []string{}
	if b.CustomerPhone != "" {
		parts = append(parts, b.CustomerPhone)
	}
	if b.CustomerEmail != "" {
		parts = append(parts, b.CustomerEmail)
	}
	if len(parts) == 0 {
		return ""
	}
	return " (" + strings.Join(parts, ", ") + ")"
}

//encore:api auth method=GET path=/booking/mine
func Mine(ctx context.Context, req *MineRequest) (*ListResponse, error) {
	if strings.TrimSpace(req.Email) == "" {
		return &ListResponse{Bookings: []appdb.Booking{}}, nil
	}
	items, err := bookings.ListByEmail(ctx, strings.TrimSpace(req.Email))
	if err != nil {
		return nil, err
	}
	return &ListResponse{Bookings: items}, nil
}

//encore:api auth method=GET path=/booking/for-partner
func ForPartner(ctx context.Context, req *ForPartnerRequest) (*ListResponse, error) {
	if strings.TrimSpace(req.EntityType) == "" || req.EntityID == 0 {
		return &ListResponse{Bookings: []appdb.Booking{}}, nil
	}
	items, err := bookings.ListForPartner(ctx, req.EntityType, req.EntityID)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Bookings: items}, nil
}

//encore:api auth method=POST path=/booking/update
func Update(ctx context.Context, req *UpdateRequest) (*UpdateResponse, error) {
	if strings.TrimSpace(req.BookingDate) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "a booking date is required"}
	}
	if err := bookings.UpdateDateTime(ctx, req.ID, strings.TrimSpace(req.Email), strings.TrimSpace(req.BookingDate), strings.TrimSpace(req.BookingTime)); err != nil {
		if errors.Is(err, store.ErrBookingNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "no matching booking found for that email"}
		}
		return nil, err
	}
	return &UpdateResponse{Success: true}, nil
}

//encore:api auth method=POST path=/booking/cancel
func Cancel(ctx context.Context, req *CancelRequest) (*CancelResponse, error) {
	if err := bookings.Cancel(ctx, req.ID, strings.TrimSpace(req.Email)); err != nil {
		if errors.Is(err, store.ErrBookingNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "no matching booking found for that email"}
		}
		return nil, err
	}
	return &CancelResponse{Success: true}, nil
}
