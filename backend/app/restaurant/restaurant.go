package restaurant

import (
	"context"
	"encoding/csv"
	"sort"
	"strconv"
	"strings"
	"time"

	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

//encore:api auth method=GET path=/restaurant
func List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	out := make([]appdb.Restaurant, 0, len(appdb.DB.Restaurants))
	for _, r := range appdb.DB.Restaurants {
		out = append(out, *r)
	}
	sortRestaurants(out, req.SortBy, req.SortOrder)
	return &ListResponse{Restaurants: out}, nil
}

func sortRestaurants(items []appdb.Restaurant, sortBy, sortOrder string) {
	desc := sortOrder != "asc"
	less := func(i, j int) bool {
		if sortBy == "name" {
			return items[i].Name < items[j].Name
		}
		return items[i].CreatedAt.Before(items[j].CreatedAt)
	}
	sort.SliceStable(items, func(i, j int) bool {
		if desc {
			return less(j, i)
		}
		return less(i, j)
	})
}

//encore:api auth method=GET path=/restaurant/by-municipality
func ListByMunicipality(ctx context.Context, req *ListByMunicipalityRequest) (*ListResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	out := make([]appdb.Restaurant, 0)
	for _, r := range appdb.DB.Restaurants {
		if r.IsActive && strings.EqualFold(r.Area, req.Area) {
			out = append(out, *r)
		}
	}
	return &ListResponse{Restaurants: out}, nil
}

//encore:api auth method=GET path=/restaurant/nearby
func ListNearby(ctx context.Context, req *ListNearbyRequest) (*ListResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	out := make([]appdb.Restaurant, 0)
	for _, r := range appdb.DB.Restaurants {
		if !r.IsActive || r.Latitude == nil || r.Longitude == nil {
			continue
		}
		if appdb.HaversineKm(req.Latitude, req.Longitude, *r.Latitude, *r.Longitude) <= req.RadiusKm {
			out = append(out, *r)
		}
	}
	return &ListResponse{Restaurants: out}, nil
}

//encore:api auth method=GET path=/restaurant/get
func Get(ctx context.Context, req *GetRequest) (*appdb.Restaurant, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	r, ok := appdb.DB.Restaurants[req.ID]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
	}
	return r, nil
}

//encore:api auth method=POST path=/restaurant
func Create(ctx context.Context, req *CreateRequest) (*appdb.Restaurant, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "name is required"}
	}
	now := time.Now()
	r := &appdb.Restaurant{
		ID:                     appdb.DB.NextID(),
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
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	appdb.DB.Lock()
	appdb.DB.Restaurants[r.ID] = r
	appdb.DB.Unlock()

	return r, nil
}

//encore:api auth method=PUT path=/restaurant
func Update(ctx context.Context, req *UpdateRequest) (*appdb.Restaurant, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()

	r, ok := appdb.DB.Restaurants[req.ID]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
	}

	if req.Name != nil {
		r.Name = *req.Name
	}
	if req.Address != nil {
		r.Address = *req.Address
	}
	if req.Latitude != nil {
		r.Latitude = req.Latitude
	}
	if req.Longitude != nil {
		r.Longitude = req.Longitude
	}
	if req.Country != nil {
		r.Country = *req.Country
	}
	if req.Province != nil {
		r.Province = *req.Province
	}
	if req.Area != nil {
		r.Area = *req.Area
	}
	if req.PostalCode != nil {
		r.PostalCode = *req.PostalCode
	}
	if req.ContactNumber != nil {
		r.ContactNumber = *req.ContactNumber
	}
	if req.Description != nil {
		r.Description = *req.Description
	}
	if req.CuisineTypes != nil {
		r.CuisineTypes = req.CuisineTypes
	}
	if req.MenuLink != nil {
		r.MenuLink = *req.MenuLink
	}
	if req.ServiceDineIn != nil {
		r.ServiceDineIn = *req.ServiceDineIn
	}
	if req.ServiceTakeaway != nil {
		r.ServiceTakeaway = *req.ServiceTakeaway
	}
	if req.ServiceDelivery != nil {
		r.ServiceDelivery = *req.ServiceDelivery
	}
	if req.LittleExplorerApproved != nil {
		r.LittleExplorerApproved = *req.LittleExplorerApproved
	}
	if req.PaymentCard != nil {
		r.PaymentCard = *req.PaymentCard
	}
	if req.PaymentCash != nil {
		r.PaymentCash = *req.PaymentCash
	}
	if req.PaymentMobile != nil {
		r.PaymentMobile = *req.PaymentMobile
	}
	if req.WheelchairAccess != nil {
		r.WheelchairAccess = *req.WheelchairAccess
	}
	if req.ParkingAvailability != nil {
		r.ParkingAvailability = *req.ParkingAvailability
	}
	if req.WifiNetwork != nil {
		r.WifiNetwork = *req.WifiNetwork
	}
	if req.WifiPassword != nil {
		r.WifiPassword = *req.WifiPassword
	}
	if req.DiscountOffered != nil {
		r.DiscountOffered = *req.DiscountOffered
	}
	if req.DiscountCode != nil {
		r.DiscountCode = *req.DiscountCode
	}
	if req.ImageUrl != nil {
		r.ImageUrl = *req.ImageUrl
	}
	if req.IsActive != nil {
		r.IsActive = *req.IsActive
	}
	if req.OfficialHoldingCompany != nil {
		r.OfficialHoldingCompany = *req.OfficialHoldingCompany
	}
	if req.OfficialContactName != nil {
		r.OfficialContactName = *req.OfficialContactName
	}
	if req.OfficialContactNumber != nil {
		r.OfficialContactNumber = *req.OfficialContactNumber
	}
	if req.OfficialEmail != nil {
		r.OfficialEmail = *req.OfficialEmail
	}
	if req.OfficialRepCode != nil {
		r.OfficialRepCode = *req.OfficialRepCode
	}
	if req.GuestType != nil {
		r.GuestType = *req.GuestType
	}
	if req.AccessLevel != nil {
		r.AccessLevel = *req.AccessLevel
	}
	r.UpdatedAt = time.Now()

	return r, nil
}

//encore:api auth method=DELETE path=/restaurant
func DeleteRestaurant(ctx context.Context, req *DeleteRequest) (*DeleteRestaurantResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	if _, ok := appdb.DB.Restaurants[req.ID]; !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
	}
	delete(appdb.DB.Restaurants, req.ID)
	return &DeleteRestaurantResponse{Success: true}, nil
}

//encore:api auth method=GET path=/restaurant/partner-code
func GetPartnerCode(ctx context.Context, req *PartnerCodeRequest) (*PartnerCodeResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	r, ok := appdb.DB.Restaurants[req.ID]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
	}
	return &PartnerCodeResponse{PartnerCode: r.PartnerCode.Code, CodeActive: r.PartnerCode.Active}, nil
}

//encore:api auth method=POST path=/restaurant/partner-code/regenerate
func RegeneratePartnerCode(ctx context.Context, req *RegeneratePartnerCodeRequest) (*PartnerCodeResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	r, ok := appdb.DB.Restaurants[req.ID]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
	}
	r.PartnerCode.Code = appdb.RandomCode(10)
	r.PartnerCode.Active = true
	return &PartnerCodeResponse{PartnerCode: r.PartnerCode.Code, CodeActive: r.PartnerCode.Active}, nil
}

//encore:api auth method=POST path=/restaurant/partner-code/toggle
func TogglePartnerCode(ctx context.Context, req *TogglePartnerCodeRequest) (*TogglePartnerCodeResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	r, ok := appdb.DB.Restaurants[req.ID]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
	}
	r.PartnerCode.Active = req.Active
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
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(csvHeaders)
	for _, r := range appdb.DB.Restaurants {
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

	appdb.DB.Lock()
	defer appdb.DB.Unlock()

	for i, row := range req.Rows {
		if strings.TrimSpace(row.Name) == "" {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Name, "name is required"))
			continue
		}
		now := time.Now()
		lat, lng := row.Latitude, row.Longitude
		r := &appdb.Restaurant{
			ID:                   appdb.DB.NextIDLocked(),
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
			CreatedAt:              now,
			UpdatedAt:              now,
		}
		appdb.DB.Restaurants[r.ID] = r
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
