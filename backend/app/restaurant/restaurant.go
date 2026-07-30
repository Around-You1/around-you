package restaurant

import (
	"context"
	"encoding/csv"
	"errors"
	"strconv"
	"strings"

	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
	"backend_encore/store"
)

var restaurants = store.NewRestaurantStore()

//encore:api auth method=GET path=/restaurant
func List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	items, err := restaurants.List(ctx, req.SortBy, req.SortOrder)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Restaurants: items}, nil
}

//encore:api auth method=GET path=/restaurant/by-municipality
func ListByMunicipality(ctx context.Context, req *ListByMunicipalityRequest) (*ListResponse, error) {
	items, err := restaurants.ListByMunicipality(ctx, req.Area)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Restaurants: items}, nil
}

//encore:api auth method=GET path=/restaurant/nearby
func ListNearby(ctx context.Context, req *ListNearbyRequest) (*ListResponse, error) {
	all, err := restaurants.ListNearby(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]appdb.Restaurant, 0, len(all))
	for _, r := range all {
		if appdb.HaversineKm(req.Latitude, req.Longitude, *r.Latitude, *r.Longitude) <= req.RadiusKm {
			out = append(out, r)
		}
	}
	return &ListResponse{Restaurants: out}, nil
}

//encore:api auth method=GET path=/restaurant/get
func Get(ctx context.Context, req *GetRequest) (*appdb.Restaurant, error) {
	r, err := restaurants.Get(ctx, req.ID)
	if err != nil {
		if errors.Is(err, store.ErrRestaurantNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
		}
		return nil, err
	}
	return r, nil
}

//encore:api auth method=POST path=/restaurant
func Create(ctx context.Context, req *CreateRequest) (*appdb.Restaurant, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "name is required"}
	}
	in := &appdb.Restaurant{
		Name:                   req.Name,
		Address:                req.Address,
		Latitude:               req.Latitude,
		Longitude:              req.Longitude,
		Country:                req.Country,
		Province:               req.Province,
		Area:                   req.Area,
		PostalCode:             req.PostalCode,
		ContactNumber:          req.ContactNumber,
		Description:            req.Description,
		ProfileReferenceCode:   appdb.RandomCode(12),
		CuisineTypes:           req.CuisineTypes,
		MenuLink:               req.MenuLink,
		ServiceDineIn:          req.ServiceDineIn,
		ServiceTakeaway:        req.ServiceTakeaway,
		ServiceDelivery:        req.ServiceDelivery,
		LittleExplorerApproved: req.LittleExplorerApproved,
		PaymentMethods: appdb.PaymentMethods{
			PaymentCard:   req.PaymentCard,
			PaymentCash:   req.PaymentCash,
			PaymentMobile: req.PaymentMobile,
		},
		WheelchairAccess:    req.WheelchairAccess,
		ParkingAvailability: req.ParkingAvailability,
		WifiNetwork:         req.WifiNetwork,
		WifiPassword:        req.WifiPassword,
		DiscountOffered:     req.DiscountOffered,
		DiscountCode:        req.DiscountCode,
		ImageUrl:            req.ImageUrl,
		IsActive:            req.IsActive,
		OfficialUse: appdb.OfficialUse{
			OfficialHoldingCompany: req.OfficialHoldingCompany,
			OfficialContactName:    req.OfficialContactName,
			OfficialContactNumber:  req.OfficialContactNumber,
			OfficialEmail:          req.OfficialEmail,
			OfficialRepCode:        req.OfficialRepCode,
			GuestType:              req.GuestType,
			AccessLevel:            req.AccessLevel,
		},
		PartnerCode: appdb.PartnerCode{Code: appdb.RandomCode(10), Active: true},
	}
	return restaurants.Create(ctx, in)
}

//encore:api auth method=PUT path=/restaurant
func Update(ctx context.Context, req *UpdateRequest) (*appdb.Restaurant, error) {
	patch := store.RestaurantPatch{
		Name:                   req.Name,
		Address:                req.Address,
		Latitude:               req.Latitude,
		Longitude:              req.Longitude,
		Country:                req.Country,
		Province:               req.Province,
		Area:                   req.Area,
		PostalCode:             req.PostalCode,
		ContactNumber:          req.ContactNumber,
		Description:            req.Description,
		CuisineTypes:           req.CuisineTypes,
		MenuLink:               req.MenuLink,
		ServiceDineIn:          req.ServiceDineIn,
		ServiceTakeaway:        req.ServiceTakeaway,
		ServiceDelivery:        req.ServiceDelivery,
		LittleExplorerApproved: req.LittleExplorerApproved,
		PaymentCard:            req.PaymentCard,
		PaymentCash:            req.PaymentCash,
		PaymentMobile:          req.PaymentMobile,
		WheelchairAccess:       req.WheelchairAccess,
		ParkingAvailability:    req.ParkingAvailability,
		WifiNetwork:            req.WifiNetwork,
		WifiPassword:           req.WifiPassword,
		DiscountOffered:        req.DiscountOffered,
		DiscountCode:           req.DiscountCode,
		ImageUrl:               req.ImageUrl,
		IsActive:               req.IsActive,
		OfficialHoldingCompany: req.OfficialHoldingCompany,
		OfficialContactName:    req.OfficialContactName,
		OfficialContactNumber:  req.OfficialContactNumber,
		OfficialEmail:          req.OfficialEmail,
		OfficialRepCode:        req.OfficialRepCode,
		GuestType:              req.GuestType,
		AccessLevel:            req.AccessLevel,
	}
	r, err := restaurants.Update(ctx, req.ID, patch)
	if err != nil {
		if errors.Is(err, store.ErrRestaurantNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
		}
		return nil, err
	}
	return r, nil
}

//encore:api auth method=DELETE path=/restaurant
func DeleteRestaurant(ctx context.Context, req *DeleteRequest) (*DeleteRestaurantResponse, error) {
	if err := restaurants.Delete(ctx, req.ID); err != nil {
		if errors.Is(err, store.ErrRestaurantNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
		}
		return nil, err
	}
	return &DeleteRestaurantResponse{Success: true}, nil
}

//encore:api auth method=GET path=/restaurant/partner-code
func GetPartnerCode(ctx context.Context, req *PartnerCodeRequest) (*PartnerCodeResponse, error) {
	code, active, err := restaurants.GetPartnerCode(ctx, req.ID)
	if err != nil {
		if errors.Is(err, store.ErrRestaurantNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
		}
		return nil, err
	}
	return &PartnerCodeResponse{PartnerCode: code, CodeActive: active}, nil
}

//encore:api auth method=POST path=/restaurant/partner-code/regenerate
func RegeneratePartnerCode(ctx context.Context, req *RegeneratePartnerCodeRequest) (*PartnerCodeResponse, error) {
	code, active, err := restaurants.RegeneratePartnerCode(ctx, req.ID, appdb.RandomCode(10))
	if err != nil {
		if errors.Is(err, store.ErrRestaurantNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
		}
		return nil, err
	}
	return &PartnerCodeResponse{PartnerCode: code, CodeActive: active}, nil
}

//encore:api auth method=POST path=/restaurant/partner-code/toggle
func TogglePartnerCode(ctx context.Context, req *TogglePartnerCodeRequest) (*TogglePartnerCodeResponse, error) {
	if err := restaurants.TogglePartnerCode(ctx, req.ID, req.Active); err != nil {
		if errors.Is(err, store.ErrRestaurantNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
		}
		return nil, err
	}
	return &TogglePartnerCodeResponse{Success: true}, nil
}

var csvHeaders = []string{
	"name", "address", "latitude", "longitude", "country", "province", "area", "postalCode",
	"contactNumber", "cuisineTypes", "menuLink", "imageUrl", "discountOffered", "discountCode",
	"description", "paymentCard", "paymentCash", "paymentMobile", "wheelchairAccess",
	"parkingAvailability", "serviceDineIn", "serviceTakeaway", "serviceDelivery", "wifiNetwork",
	"wifiPassword", "littleExplorerApproved", "isActive",
}

//encore:api auth method=GET path=/restaurant/template
func Template(ctx context.Context) (*CSVResponse, error) {
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(csvHeaders)
	_ = w.Write([]string{
		"Sample Bistro", "1 Main Rd", "-33.9", "18.4", "South Africa", "Western Cape", "Cape Town", "8001",
		"+27 21 000 0000", "Italian,Seafood", "https://example.com/menu.pdf", "https://example.com/image.jpg",
		"10% off mains", "SAVE10", "A cozy bistro by the sea.", "true", "true", "true", "true", "true",
		"true", "true", "false", "GuestWifi", "password123", "false", "true",
	})
	w.Flush()
	return &CSVResponse{CSV: sb.String()}, nil
}

//encore:api auth method=GET path=/restaurant/export
func ExportRestaurants(ctx context.Context) (*CSVResponse, error) {
	items, err := restaurants.List(ctx, "", "")
	if err != nil {
		return nil, err
	}
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(csvHeaders)
	for _, r := range items {
		_ = w.Write([]string{
			r.Name, r.Address, floatStr(r.Latitude), floatStr(r.Longitude), r.Country, r.Province, r.Area, r.PostalCode,
			r.ContactNumber, strings.Join(r.CuisineTypes, ","), r.MenuLink, r.ImageUrl, r.DiscountOffered, r.DiscountCode,
			r.Description, strconv.FormatBool(r.PaymentCard), strconv.FormatBool(r.PaymentCash), strconv.FormatBool(r.PaymentMobile),
			strconv.FormatBool(r.WheelchairAccess), strconv.FormatBool(r.ParkingAvailability), strconv.FormatBool(r.ServiceDineIn),
			strconv.FormatBool(r.ServiceTakeaway), strconv.FormatBool(r.ServiceDelivery), r.WifiNetwork, r.WifiPassword,
			strconv.FormatBool(r.LittleExplorerApproved), strconv.FormatBool(r.IsActive),
		})
	}
	w.Flush()
	return &CSVResponse{CSV: sb.String()}, nil
}

func floatStr(f *float64) string {
	if f == nil {
		return ""
	}
	return strconv.FormatFloat(*f, 'f', -1, 64)
}

//encore:api auth method=POST path=/restaurant/import
func ImportRestaurants(ctx context.Context, req *ImportRequest) (*ImportResponse, error) {
	resp := &ImportResponse{Errors: []string{}}

	for i, row := range req.Rows {
		if strings.TrimSpace(row.Name) == "" {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Name, "name is required"))
			continue
		}
		lat, lng := row.Latitude, row.Longitude
		in := &appdb.Restaurant{
			Name:                 row.Name,
			Address:              row.Address,
			Latitude:             &lat,
			Longitude:            &lng,
			Country:              row.Country,
			Province:             row.Province,
			Area:                 row.Area,
			PostalCode:           row.PostalCode,
			ContactNumber:        row.ContactNumber,
			ProfileReferenceCode: appdb.RandomCode(12),
			CuisineTypes:         splitCSVList(row.CuisineTypes),
			MenuLink:             row.MenuLink,
			ImageUrl:             row.ImageUrl,
			DiscountOffered:      row.DiscountOffered,
			DiscountCode:         row.DiscountCode,
			Description:          row.Description,
			PaymentMethods: appdb.PaymentMethods{
				PaymentCard:   parseBool(row.PaymentCard),
				PaymentCash:   parseBool(row.PaymentCash),
				PaymentMobile: parseBool(row.PaymentMobile),
			},
			WheelchairAccess:       parseBool(row.WheelchairAccess),
			ParkingAvailability:    parseBool(row.ParkingAvailability),
			ServiceDineIn:          parseBool(row.ServiceDineIn),
			ServiceTakeaway:        parseBool(row.ServiceTakeaway),
			ServiceDelivery:        parseBool(row.ServiceDelivery),
			WifiNetwork:            row.WifiNetwork,
			WifiPassword:           row.WifiPassword,
			LittleExplorerApproved: parseBool(row.LittleExplorerApproved),
			IsActive:               parseBool(row.IsActive),
			PartnerCode:            appdb.PartnerCode{Code: appdb.RandomCode(10), Active: true},
		}
		if _, err := restaurants.Create(ctx, in); err != nil {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Name, err.Error()))
			continue
		}
		resp.Imported++
	}

	resp.Success = resp.Failed == 0
	return resp, nil
}

func splitCSVList(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

func parseBool(s string) bool {
	v, _ := strconv.ParseBool(strings.TrimSpace(s))
	return v
}

func rowError(index int, name, msg string) string {
	if name == "" {
		name = "unnamed"
	}
	return "Row " + strconv.Itoa(index+2) + " (" + name + "): " + msg
}
