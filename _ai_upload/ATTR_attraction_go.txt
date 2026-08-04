package attraction

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

var attractions = store.NewAttractionStore()

func lookup(attractionID string) (int64, error) {
	id, err := strconv.ParseInt(attractionID, 10, 64)
	if err != nil {
		return 0, &errs.Error{Code: errs.InvalidArgument, Message: "invalid attractionId"}
	}
	return id, nil
}

//encore:api auth method=GET path=/attraction
func List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	items, err := attractions.List(ctx, req.SortBy, req.SortOrder)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Attractions: items}, nil
}

//encore:api auth method=GET path=/attraction/by-municipality
func ListByMunicipality(ctx context.Context, req *ListByMunicipalityRequest) (*ListResponse, error) {
	items, err := attractions.ListByMunicipality(ctx, req.Area)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Attractions: items}, nil
}

//encore:api auth method=GET path=/attraction/nearby
func ListNearby(ctx context.Context, req *ListNearbyRequest) (*ListResponse, error) {
	all, err := attractions.ListNearby(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]appdb.AttractionData, 0, len(all))
	for _, a := range all {
		if appdb.HaversineKm(req.Latitude, req.Longitude, *a.Latitude, *a.Longitude) <= req.RadiusKm {
			out = append(out, a)
		}
	}
	return &ListResponse{Attractions: out}, nil
}

//encore:api auth method=GET path=/attraction/get
func Get(ctx context.Context, req *GetRequest) (*appdb.AttractionData, error) {
	id, err := lookup(req.AttractionID)
	if err != nil {
		return nil, err
	}
	item, err := attractions.Get(ctx, id)
	if err != nil {
		if errors.Is(err, store.ErrAttractionNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "attraction not found"}
		}
		return nil, err
	}
	return item, nil
}

//encore:api auth method=POST path=/attraction
func Create(ctx context.Context, req *CreateRequest) (*appdb.AttractionData, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "name is required"}
	}
	in := &appdb.AttractionData{
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
		AttractionType:         req.AttractionType,
		LittleExplorerApproved: req.LittleExplorerApproved,
		PaymentMethods: appdb.PaymentMethods{
			PaymentCard:     req.PaymentCard,
			PaymentCash:     req.PaymentCash,
			PaymentMobile:   req.PaymentMobile,
			PaymentGaap:     req.PaymentGaap,
			PaymentSnapScan: req.PaymentSnapScan,
			PaymentYoco:     req.PaymentYoco,
			PaymentZapper:   req.PaymentZapper,
		},
		WheelchairAccess:    req.WheelchairAccess,
		ParkingAvailability: req.ParkingAvailability,
		DiscountOffered:     req.DiscountOffered,
		DiscountCode:        req.DiscountCode,
		ExperienceInfo: appdb.ExperienceInfo{
			SafetyInfo:      req.SafetyInfo,
			AgeRestrictions: req.AgeRestrictions,
			FitnessLevel:    req.FitnessLevel,
			BestTimeOfDay:   req.BestTimeOfDay,
			WhatToBring:     req.WhatToBring,
		},
		TrailDifficulty:  req.TrailDifficulty,
		WildlifeCautions: req.WildlifeCautions,
		TideWarnings:     req.TideWarnings,
		ParkingNotes:     req.ParkingNotes,
		PhotographySpots: req.PhotographySpots,
		Socials: appdb.Socials{
			SocialsWebsite:   req.SocialsWebsite,
			SocialsFacebook:  req.SocialsFacebook,
			SocialsInstagram: req.SocialsInstagram,
			SocialsTiktok:    req.SocialsTiktok,
			SocialsTwitter:   req.SocialsTwitter,
		},
		ImageUrl:  req.ImageUrl,
		ImageUrls: req.ImageUrls,
		IsActive:  req.IsActive,
		OfficialUse: appdb.OfficialUse{
			OfficialHoldingCompany: req.OfficialHoldingCompany,
			OfficialContactName:    req.OfficialContactName,
			OfficialContactNumber:  req.OfficialContactNumber,
			OfficialEmail:          req.OfficialEmail,
			OfficialRepCode:        req.OfficialRepCode,
			OfficialRepName:        req.OfficialRepName,
			CompanyRegNumber:       req.CompanyRegNumber,
			CompanyVatNumber:       req.CompanyVatNumber,
			GuestType:              req.GuestType,
			AccessLevel:            req.AccessLevel,
		},
		PartnerCode: appdb.PartnerCode{Code: appdb.RandomCode(10), Active: true},
	}
	return attractions.Create(ctx, in)
}

//encore:api auth method=PUT path=/attraction
func Update(ctx context.Context, req *UpdateRequest) (*appdb.AttractionData, error) {
	id, err := lookup(req.AttractionID)
	if err != nil {
		return nil, err
	}
	patch := store.AttractionPatch{
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
		AttractionType:         req.AttractionType,
		LittleExplorerApproved: req.LittleExplorerApproved,
		PaymentCard:            req.PaymentCard,
		PaymentCash:            req.PaymentCash,
		PaymentMobile:          req.PaymentMobile,
		PaymentGaap:            req.PaymentGaap,
		PaymentSnapScan:        req.PaymentSnapScan,
		PaymentYoco:            req.PaymentYoco,
		PaymentZapper:          req.PaymentZapper,
		WheelchairAccess:       req.WheelchairAccess,
		ParkingAvailability:    req.ParkingAvailability,
		DiscountOffered:        req.DiscountOffered,
		DiscountCode:           req.DiscountCode,
		SafetyInfo:             req.SafetyInfo,
		AgeRestrictions:        req.AgeRestrictions,
		FitnessLevel:           req.FitnessLevel,
		BestTimeOfDay:          req.BestTimeOfDay,
		WhatToBring:            req.WhatToBring,
		TrailDifficulty:        req.TrailDifficulty,
		WildlifeCautions:       req.WildlifeCautions,
		TideWarnings:           req.TideWarnings,
		ParkingNotes:           req.ParkingNotes,
		PhotographySpots:       req.PhotographySpots,
		SocialsWebsite:         req.SocialsWebsite,
		SocialsFacebook:        req.SocialsFacebook,
		SocialsInstagram:       req.SocialsInstagram,
		SocialsTiktok:          req.SocialsTiktok,
		SocialsTwitter:         req.SocialsTwitter,
		ImageUrl:               req.ImageUrl,
		ImageUrls:              req.ImageUrls,
		IsActive:               req.IsActive,
		OfficialHoldingCompany: req.OfficialHoldingCompany,
		OfficialContactName:    req.OfficialContactName,
		OfficialContactNumber:  req.OfficialContactNumber,
		OfficialEmail:          req.OfficialEmail,
		OfficialRepCode:        req.OfficialRepCode,
		OfficialRepName:        req.OfficialRepName,
		CompanyRegNumber:       req.CompanyRegNumber,
		CompanyVatNumber:       req.CompanyVatNumber,
		GuestType:              req.GuestType,
		AccessLevel:            req.AccessLevel,
	}
	item, err := attractions.Update(ctx, id, patch)
	if err != nil {
		if errors.Is(err, store.ErrAttractionNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "attraction not found"}
		}
		return nil, err
	}
	return item, nil
}

//encore:api auth method=DELETE path=/attraction
func DeleteAttraction(ctx context.Context, req *DeleteRequest) (*DeleteAttractionResponse, error) {
	id, err := lookup(req.AttractionID)
	if err != nil {
		return nil, err
	}
	if err := attractions.Delete(ctx, id); err != nil {
		if errors.Is(err, store.ErrAttractionNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "attraction not found"}
		}
		return nil, err
	}
	return &DeleteAttractionResponse{Success: true}, nil
}

//encore:api auth method=GET path=/attraction/partner-code
func GetPartnerCode(ctx context.Context, req *PartnerCodeRequest) (*PartnerCodeResponse, error) {
	code, active, err := attractions.GetPartnerCode(ctx, req.ID)
	if err != nil {
		if errors.Is(err, store.ErrAttractionNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "attraction not found"}
		}
		return nil, err
	}
	return &PartnerCodeResponse{PartnerCode: code, CodeActive: active}, nil
}

//encore:api auth method=POST path=/attraction/partner-code/regenerate
func RegeneratePartnerCode(ctx context.Context, req *RegeneratePartnerCodeRequest) (*PartnerCodeResponse, error) {
	code, active, err := attractions.RegeneratePartnerCode(ctx, req.ID, appdb.RandomCode(10))
	if err != nil {
		if errors.Is(err, store.ErrAttractionNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "attraction not found"}
		}
		return nil, err
	}
	return &PartnerCodeResponse{PartnerCode: code, CodeActive: active}, nil
}

//encore:api auth method=POST path=/attraction/partner-code/toggle
func TogglePartnerCode(ctx context.Context, req *TogglePartnerCodeRequest) (*TogglePartnerCodeResponse, error) {
	if err := attractions.TogglePartnerCode(ctx, req.ID, req.Active); err != nil {
		if errors.Is(err, store.ErrAttractionNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "attraction not found"}
		}
		return nil, err
	}
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
	items, err := attractions.List(ctx, "", "")
	if err != nil {
		return nil, err
	}
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(csvHeaders)
	for _, a := range items {
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

	for i, row := range req.Rows {
		if strings.TrimSpace(row.Name) == "" {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Name, "name is required"))
			continue
		}
		lat, lng := row.Latitude, row.Longitude
		in := &appdb.AttractionData{
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
		}
		if _, err := attractions.Create(ctx, in); err != nil {
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
