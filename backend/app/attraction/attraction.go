package attraction

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

//encore:api auth method=GET path=/attraction
func List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	out := make([]appdb.AttractionData, 0, len(appdb.DB.Attractions))
	for _, a := range appdb.DB.Attractions {
		out = append(out, *a)
	}
	sortAttractions(out, req.SortBy, req.SortOrder)
	return &ListResponse{Attractions: out}, nil
}

func sortAttractions(items []appdb.AttractionData, sortBy, sortOrder string) {
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

//encore:api auth method=GET path=/attraction/by-municipality
func ListByMunicipality(ctx context.Context, req *ListByMunicipalityRequest) (*ListResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	out := make([]appdb.AttractionData, 0)
	for _, a := range appdb.DB.Attractions {
		if a.IsActive && strings.EqualFold(a.Area, req.Area) {
			out = append(out, *a)
		}
	}
	return &ListResponse{Attractions: out}, nil
}

//encore:api auth method=GET path=/attraction/nearby
func ListNearby(ctx context.Context, req *ListNearbyRequest) (*ListResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	out := make([]appdb.AttractionData, 0)
	for _, a := range appdb.DB.Attractions {
		if !a.IsActive || a.Latitude == nil || a.Longitude == nil {
			continue
		}
		if appdb.HaversineKm(req.Latitude, req.Longitude, *a.Latitude, *a.Longitude) <= req.RadiusKm {
			out = append(out, *a)
		}
	}
	return &ListResponse{Attractions: out}, nil
}

func lookup(attractionID string) (int64, error) {
	id, err := strconv.ParseInt(attractionID, 10, 64)
	if err != nil {
		return 0, &errs.Error{Code: errs.InvalidArgument, Message: "invalid attractionId"}
	}
	return id, nil
}

//encore:api auth method=GET path=/attraction/get
func Get(ctx context.Context, req *GetRequest) (*appdb.AttractionData, error) {
	id, err := lookup(req.AttractionID)
	if err != nil {
		return nil, err
	}
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	a, ok := appdb.DB.Attractions[id]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "attraction not found"}
	}
	return a, nil
}

//encore:api auth method=POST path=/attraction
func Create(ctx context.Context, req *CreateRequest) (*appdb.AttractionData, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "name is required"}
	}
	now := time.Now()
	id := appdb.DB.NextID()
	a := &appdb.AttractionData{
		ID:                     id,
		AttractionID:           strconv.FormatInt(id, 10),
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
		ProfileReferenceCode:   appdb.RandomCode(8),
		AttractionType:         req.AttractionType,
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
	appdb.DB.Attractions[id] = a
	appdb.DB.Unlock()

	return a, nil
}

//encore:api auth method=PUT path=/attraction
func Update(ctx context.Context, req *UpdateRequest) (*appdb.AttractionData, error) {
	id, err := lookup(req.AttractionID)
	if err != nil {
		return nil, err
	}

	appdb.DB.Lock()
	defer appdb.DB.Unlock()

	a, ok := appdb.DB.Attractions[id]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "attraction not found"}
	}

	if req.Name != nil {
		a.Name = *req.Name
	}
	if req.Address != nil {
		a.Address = *req.Address
	}
	if req.Latitude != nil {
		a.Latitude = req.Latitude
	}
	if req.Longitude != nil {
		a.Longitude = req.Longitude
	}
	if req.Country != nil {
		a.Country = *req.Country
	}
	if req.Province != nil {
		a.Province = *req.Province
	}
	if req.Area != nil {
		a.Area = *req.Area
	}
	if req.PostalCode != nil {
		a.PostalCode = *req.PostalCode
	}
	if req.ContactNumber != nil {
		a.ContactNumber = *req.ContactNumber
	}
	if req.Description != nil {
		a.Description = *req.Description
	}
	if req.AttractionType != nil {
		a.AttractionType = req.AttractionType
	}
	if req.LittleExplorerApproved != nil {
		a.LittleExplorerApproved = *req.LittleExplorerApproved
	}
	if req.PaymentCard != nil {
		a.PaymentCard = *req.PaymentCard
	}
	if req.PaymentCash != nil {
		a.PaymentCash = *req.PaymentCash
	}
	if req.PaymentMobile != nil {
		a.PaymentMobile = *req.PaymentMobile
	}
	if req.WheelchairAccess != nil {
		a.WheelchairAccess = *req.WheelchairAccess
	}
	if req.ParkingAvailability != nil {
		a.ParkingAvailability = *req.ParkingAvailability
	}
	if req.DiscountOffered != nil {
		a.DiscountOffered = *req.DiscountOffered
	}
	if req.DiscountCode != nil {
		a.DiscountCode = *req.DiscountCode
	}
	if req.ImageUrl != nil {
		a.ImageUrl = *req.ImageUrl
	}
	if req.IsActive != nil {
		a.IsActive = *req.IsActive
	}
	if req.OfficialHoldingCompany != nil {
		a.OfficialHoldingCompany = *req.OfficialHoldingCompany
	}
	if req.OfficialContactName != nil {
		a.OfficialContactName = *req.OfficialContactName
	}
	if req.OfficialContactNumber != nil {
		a.OfficialContactNumber = *req.OfficialContactNumber
	}
	if req.OfficialEmail != nil {
		a.OfficialEmail = *req.OfficialEmail
	}
	if req.OfficialRepCode != nil {
		a.OfficialRepCode = *req.OfficialRepCode
	}
	if req.GuestType != nil {
		a.GuestType = *req.GuestType
	}
	if req.AccessLevel != nil {
		a.AccessLevel = *req.AccessLevel
	}
	a.UpdatedAt = time.Now()

	return a, nil
}

//encore:api auth method=DELETE path=/attraction
func DeleteAttraction(ctx context.Context, req *DeleteRequest) (*DeleteAttractionResponse, error) {
	id, err := lookup(req.AttractionID)
	if err != nil {
		return nil, err
	}
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	if _, ok := appdb.DB.Attractions[id]; !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "attraction not found"}
	}
	delete(appdb.DB.Attractions, id)
	return &DeleteAttractionResponse{Success: true}, nil
}

//encore:api auth method=GET path=/attraction/partner-code
func GetPartnerCode(ctx context.Context, req *PartnerCodeRequest) (*PartnerCodeResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	a, ok := appdb.DB.Attractions[req.ID]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "attraction not found"}
	}
	return &PartnerCodeResponse{PartnerCode: a.PartnerCode.Code, CodeActive: a.PartnerCode.Active}, nil
}

//encore:api auth method=POST path=/attraction/partner-code/regenerate
func RegeneratePartnerCode(ctx context.Context, req *RegeneratePartnerCodeRequest) (*PartnerCodeResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	a, ok := appdb.DB.Attractions[req.ID]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "attraction not found"}
	}
	a.PartnerCode.Code = appdb.RandomCode(10)
	a.PartnerCode.Active = true
	return &PartnerCodeResponse{PartnerCode: a.PartnerCode.Code, CodeActive: a.PartnerCode.Active}, nil
}

//encore:api auth method=POST path=/attraction/partner-code/toggle
func TogglePartnerCode(ctx context.Context, req *TogglePartnerCodeRequest) (*TogglePartnerCodeResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	a, ok := appdb.DB.Attractions[req.ID]
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "attraction not found"}
	}
	a.PartnerCode.Active = req.Active
	return &TogglePartnerCodeResponse{Success: true}, nil
}

var csvHeaders = []string{
	"name", "address", "latitude", "longitude", "country", "province", "area", "postalCode",
	"contactNumber", "attractionType", "imageUrl", "discountOffered", "discountCode", "description",
	"paymentCard", "paymentCash", "paymentMobile", "wheelchairAccess", "parkingAvailability",
	"littleExplorerApproved", "isActive",
}

//encore:api auth method=GET path=/attraction/template
func Template(ctx context.Context) (*CSVResponse, error) {
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(csvHeaders)
	_ = w.Write([]string{
		"Table Mountain Cableway", "Tafelberg Rd", "-33.96", "18.4", "South Africa", "Western Cape", "Cape Town",
		"8001", "+27 21 000 0000", "Nature,Sightseeing", "https://example.com/image.jpg", "10% off online",
		"CABLE10", "Iconic cableway to the top of Table Mountain.", "true", "true", "true", "false", "true",
		"true", "true",
	})
	w.Flush()
	return &CSVResponse{CSV: sb.String()}, nil
}

//encore:api auth method=GET path=/attraction/export
func ExportAttractions(ctx context.Context) (*CSVResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(csvHeaders)
	for _, a := range appdb.DB.Attractions {
		_ = w.Write([]string{
			a.Name, a.Address, floatStr(a.Latitude), floatStr(a.Longitude), a.Country, a.Province, a.Area, a.PostalCode,
			a.ContactNumber, strings.Join(a.AttractionType, ","), a.ImageUrl, a.DiscountOffered, a.DiscountCode,
			a.Description, strconv.FormatBool(a.PaymentCard), strconv.FormatBool(a.PaymentCash), strconv.FormatBool(a.PaymentMobile),
			strconv.FormatBool(a.WheelchairAccess), strconv.FormatBool(a.ParkingAvailability),
			strconv.FormatBool(a.LittleExplorerApproved), strconv.FormatBool(a.IsActive),
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

//encore:api auth method=POST path=/attraction/import
func ImportAttractions(ctx context.Context, req *ImportRequest) (*ImportResponse, error) {
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
		a := &appdb.AttractionData{
			ID:                   id,
			AttractionID:         strconv.FormatInt(id, 10),
			Name:                 row.Name,
			Address:              row.Address,
			Latitude:             &lat,
			Longitude:            &lng,
			Country:              row.Country,
			Province:             row.Province,
			Area:                 row.Area,
			PostalCode:           row.PostalCode,
			ContactNumber:        row.ContactNumber,
			ProfileReferenceCode: appdb.RandomCode(8),
			AttractionType:       splitCSVList(row.AttractionType),
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
		appdb.DB.Attractions[id] = a
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
