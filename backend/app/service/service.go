package service

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

//encore:api auth method=GET path=/service
func List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	out := make([]appdb.ServiceData, 0, len(appdb.DB.Services))
	for _, s := range appdb.DB.Services {
		out = append(out, *s)
	}
	sortServices(out, req.SortBy, req.SortOrder)
	return &ListResponse{Services: out}, nil
}

func sortServices(items []appdb.ServiceData, sortBy, sortOrder string) {
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

//encore:api auth method=GET path=/service/by-municipality
func ListByMunicipality(ctx context.Context, req *ListByMunicipalityRequest) (*ListResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	out := make([]appdb.ServiceData, 0)
	for _, s := range appdb.DB.Services {
		if s.IsActive && strings.EqualFold(s.Area, req.Area) {
			out = append(out, *s)
		}
	}
	return &ListResponse{Services: out}, nil
}

//encore:api auth method=GET path=/service/nearby
func ListNearby(ctx context.Context, req *ListNearbyRequest) (*ListResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	out := make([]appdb.ServiceData, 0)
	for _, s := range appdb.DB.Services {
		if !s.IsActive || s.Latitude == nil || s.Longitude == nil {
			continue
		}
		if appdb.HaversineKm(req.Latitude, req.Longitude, *s.Latitude, *s.Longitude) <= req.RadiusKm {
			out = append(out, *s)
		}
	}
	return &ListResponse{Services: out}, nil
}

func lookup(serviceID string) (int64, error) {
	id, err := strconv.ParseInt(serviceID, 10, 64)
	if err != nil {
		return 0, &errs.Error{Code: errs.InvalidArgument, Message: "invalid serviceId"}
	}
	return id, nil
}

//encore:api auth method=GET path=/service/get
func Get(ctx context.Context, req *GetRequest) (*appdb.ServiceData, error) {
	id, err := lookup(req.ServiceID)
	if err != nil {
		return nil, err
	}
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	s, ok := appdb.DB.Services[id]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
	}
	return s, nil
}

//encore:api auth method=POST path=/service
func Create(ctx context.Context, req *CreateRequest) (*appdb.ServiceData, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "name is required"}
	}
	now := time.Now()
	id := appdb.DB.NextID()
	s := &appdb.ServiceData{
		ID:                     id,
		ServiceID:              strconv.FormatInt(id, 10),
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
		ServiceCategories:      req.ServiceCategories,
		LittleExplorerApproved: req.LittleExplorerApproved,
		PaymentMethods: appdb.PaymentMethods{
			PaymentCard:   req.PaymentCard,
			PaymentCash:   req.PaymentCash,
			PaymentMobile: req.PaymentMobile,
		},
		WheelchairAccess:    req.WheelchairAccess,
		ParkingAvailability: req.ParkingAvailability,
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
	appdb.DB.Services[id] = s
	appdb.DB.Unlock()

	return s, nil
}

//encore:api auth method=PUT path=/service
func Update(ctx context.Context, req *UpdateRequest) (*appdb.ServiceData, error) {
	id, err := lookup(req.ServiceID)
	if err != nil {
		return nil, err
	}

	appdb.DB.Lock()
	defer appdb.DB.Unlock()

	s, ok := appdb.DB.Services[id]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
	}

	if req.Name != nil {
		s.Name = *req.Name
	}
	if req.Address != nil {
		s.Address = *req.Address
	}
	if req.Latitude != nil {
		s.Latitude = req.Latitude
	}
	if req.Longitude != nil {
		s.Longitude = req.Longitude
	}
	if req.Country != nil {
		s.Country = *req.Country
	}
	if req.Province != nil {
		s.Province = *req.Province
	}
	if req.Area != nil {
		s.Area = *req.Area
	}
	if req.PostalCode != nil {
		s.PostalCode = *req.PostalCode
	}
	if req.ContactNumber != nil {
		s.ContactNumber = *req.ContactNumber
	}
	if req.Description != nil {
		s.Description = *req.Description
	}
	if req.ServiceCategories != nil {
		s.ServiceCategories = req.ServiceCategories
	}
	if req.LittleExplorerApproved != nil {
		s.LittleExplorerApproved = *req.LittleExplorerApproved
	}
	if req.PaymentCard != nil {
		s.PaymentCard = *req.PaymentCard
	}
	if req.PaymentCash != nil {
		s.PaymentCash = *req.PaymentCash
	}
	if req.PaymentMobile != nil {
		s.PaymentMobile = *req.PaymentMobile
	}
	if req.WheelchairAccess != nil {
		s.WheelchairAccess = *req.WheelchairAccess
	}
	if req.ParkingAvailability != nil {
		s.ParkingAvailability = *req.ParkingAvailability
	}
	if req.DiscountOffered != nil {
		s.DiscountOffered = *req.DiscountOffered
	}
	if req.DiscountCode != nil {
		s.DiscountCode = *req.DiscountCode
	}
	if req.ImageUrl != nil {
		s.ImageUrl = *req.ImageUrl
	}
	if req.IsActive != nil {
		s.IsActive = *req.IsActive
	}
	if req.OfficialHoldingCompany != nil {
		s.OfficialHoldingCompany = *req.OfficialHoldingCompany
	}
	if req.OfficialContactName != nil {
		s.OfficialContactName = *req.OfficialContactName
	}
	if req.OfficialContactNumber != nil {
		s.OfficialContactNumber = *req.OfficialContactNumber
	}
	if req.OfficialEmail != nil {
		s.OfficialEmail = *req.OfficialEmail
	}
	if req.OfficialRepCode != nil {
		s.OfficialRepCode = *req.OfficialRepCode
	}
	if req.GuestType != nil {
		s.GuestType = *req.GuestType
	}
	if req.AccessLevel != nil {
		s.AccessLevel = *req.AccessLevel
	}
	s.UpdatedAt = time.Now()

	return s, nil
}

//encore:api auth method=DELETE path=/service
func DeleteService(ctx context.Context, req *DeleteRequest) (*DeleteServiceResponse, error) {
	id, err := lookup(req.ServiceID)
	if err != nil {
		return nil, err
	}
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	if _, ok := appdb.DB.Services[id]; !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
	}
	delete(appdb.DB.Services, id)
	return &DeleteServiceResponse{Success: true}, nil
}

//encore:api auth method=GET path=/service/partner-code
func GetPartnerCode(ctx context.Context, req *PartnerCodeRequest) (*PartnerCodeResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	s, ok := appdb.DB.Services[req.ID]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
	}
	return &PartnerCodeResponse{PartnerCode: s.PartnerCode.Code, CodeActive: s.PartnerCode.Active}, nil
}

//encore:api auth method=POST path=/service/partner-code/regenerate
func RegeneratePartnerCode(ctx context.Context, req *RegeneratePartnerCodeRequest) (*PartnerCodeResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	s, ok := appdb.DB.Services[req.ID]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
	}
	s.PartnerCode.Code = appdb.RandomCode(10)
	s.PartnerCode.Active = true
	return &PartnerCodeResponse{PartnerCode: s.PartnerCode.Code, CodeActive: s.PartnerCode.Active}, nil
}

//encore:api auth method=POST path=/service/partner-code/toggle
func TogglePartnerCode(ctx context.Context, req *TogglePartnerCodeRequest) (*TogglePartnerCodeResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	s, ok := appdb.DB.Services[req.ID]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
	}
	s.PartnerCode.Active = req.Active
	return &TogglePartnerCodeResponse{Success: true}, nil
}

var csvHeaders = []string{
	"name", "address", "latitude", "longitude", "country", "province", "area", "postalCode",
	"contactNumber", "serviceCategories", "imageUrl", "discountOffered", "discountCode", "description",
	"paymentCard", "paymentCash", "paymentMobile", "wheelchairAccess", "parkingAvailability",
	"littleExplorerApproved", "isActive",
}

//encore:api auth method=GET path=/service/template
func Template(ctx context.Context) (*CSVResponse, error) {
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(csvHeaders)
	_ = w.Write([]string{
		"Sample Spa", "1 Main Rd", "-33.9", "18.4", "South Africa", "Western Cape", "Cape Town", "8001",
		"+27 21 000 0000", "Wellness,Beauty", "https://example.com/image.jpg", "15% off first visit",
		"RELAX15", "A relaxing day spa.", "true", "true", "true", "true", "true", "false", "true",
	})
	w.Flush()
	return &CSVResponse{CSV: sb.String()}, nil
}

//encore:api auth method=GET path=/service/export
func ExportServices(ctx context.Context) (*CSVResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(csvHeaders)
	for _, s := range appdb.DB.Services {
		_ = w.Write([]string{
			s.Name, s.Address, floatStr(s.Latitude), floatStr(s.Longitude), s.Country, s.Province, s.Area, s.PostalCode,
			s.ContactNumber, strings.Join(s.ServiceCategories, ","), s.ImageUrl, s.DiscountOffered, s.DiscountCode,
			s.Description, strconv.FormatBool(s.PaymentCard), strconv.FormatBool(s.PaymentCash), strconv.FormatBool(s.PaymentMobile),
			strconv.FormatBool(s.WheelchairAccess), strconv.FormatBool(s.ParkingAvailability),
			strconv.FormatBool(s.LittleExplorerApproved), strconv.FormatBool(s.IsActive),
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

//encore:api auth method=POST path=/service/import
func ImportServices(ctx context.Context, req *ImportRequest) (*ImportResponse, error) {
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
		id := appdb.DB.NextIDLocked()
		s := &appdb.ServiceData{
			ID:                   id,
			ServiceID:            strconv.FormatInt(id, 10),
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
			ServiceCategories:    splitCSVList(row.ServiceCategories),
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
			LittleExplorerApproved: parseBool(row.LittleExplorerApproved),
			IsActive:               parseBool(row.IsActive),
			PartnerCode:            appdb.PartnerCode{Code: appdb.RandomCode(10), Active: true},
			CreatedAt:              now,
			UpdatedAt:              now,
		}
		appdb.DB.Services[id] = s
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
