package booking

import (
	"context"
	"errors"
	"math"
	"strings"

	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
	"backend_encore/store"
)

var (
	bookings    = store.NewBookingStore()
	restaurants = store.NewRestaurantStore()
	services    = store.NewServiceStore()
	attractions = store.NewAttractionStore()
)

func partnerInfo(ctx context.Context, entityType string, entityID int64) (name, accessLevel string, items appdb.BookingItems, err error) {
	switch entityType {
	case "restaurant":
		r, e := restaurants.Get(ctx, entityID)
		if e != nil {
			return "", "", nil, e
		}
		return r.Name, r.AccessLevel, r.BookingItems, nil
	case "service":
		s, e := services.Get(ctx, entityID)
		if e != nil {
			return "", "", nil, e
		}
		return s.Name, s.AccessLevel, s.BookingItems, nil
	case "attraction":
		a, e := attractions.Get(ctx, entityID)
		if e != nil {
			return "", "", nil, e
		}
		return a.Name, a.AccessLevel, a.BookingItems, nil
	default:
		return "", "", nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid entityType"}
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
	name, accessLevel, partnerItems, err := partnerInfo(ctx, req.EntityType, req.EntityID)
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
	return bookings.Create(ctx, b)
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
