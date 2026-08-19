package service

import (
	"context"
	"encoding/csv"
	"errors"
	"log"
	"strconv"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/billing"
	"backend_encore/internal/errs"
	"backend_encore/internal/moderation"
	"backend_encore/store"
)

var services = store.NewServiceStore()

// publicize strips sensitive fields for non-internal callers (anti-scraping).
func publicize(ctx context.Context, items []appdb.ServiceData) []appdb.ServiceData {
	if auth.IsPrivileged(ctx) {
		return items
	}
	for i := range items {
		items[i].StripSensitive()
	}
	return items
}

func lookup(serviceID string) (int64, error) {
	id, err := strconv.ParseInt(serviceID, 10, 64)
	if err != nil {
		return 0, &errs.Error{Code: errs.InvalidArgument, Message: "invalid serviceId"}
	}
	return id, nil
}

//encore:api auth method=GET path=/service
func List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	items, err := services.List(ctx, req.SortBy, req.SortOrder)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Services: publicize(ctx, items)}, nil
}

//encore:api auth method=GET path=/service/by-municipality
func ListByMunicipality(ctx context.Context, req *ListByMunicipalityRequest) (*ListResponse, error) {
	items, err := services.ListByMunicipality(ctx, req.Area)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Services: publicize(ctx, items)}, nil
}

//encore:api auth method=GET path=/service/nearby
func ListNearby(ctx context.Context, req *ListNearbyRequest) (*ListResponse, error) {
	all, err := services.ListNearby(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]appdb.ServiceData, 0, len(all))
	for _, s := range all {
		if appdb.HaversineKm(req.Latitude, req.Longitude, *s.Latitude, *s.Longitude) <= req.RadiusKm {
			out = append(out, s)
		}
	}
	return &ListResponse{Services: publicize(ctx, out)}, nil
}

//encore:api auth method=GET path=/service/get
func Get(ctx context.Context, req *GetRequest) (*appdb.ServiceData, error) {
	id, err := lookup(req.ServiceID)
	if err != nil {
		return nil, err
	}
	item, err := services.Get(ctx, id)
	if err != nil {
		if errors.Is(err, store.ErrServiceNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
		}
		return nil, err
	}
	if !auth.IsPrivileged(ctx) {
		item.StripSensitive()
	}
	return item, nil
}

//encore:api auth method=POST path=/service
func Create(ctx context.Context, req *CreateRequest) (*appdb.ServiceData, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "name is required"}
	}
	in := &appdb.ServiceData{
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
		Socials: appdb.Socials{
			SocialsWebsite:   req.SocialsWebsite,
			SocialsFacebook:  req.SocialsFacebook,
			SocialsInstagram: req.SocialsInstagram,
			SocialsTiktok:    req.SocialsTiktok,
			SocialsTwitter:   req.SocialsTwitter,
		},
		ImageUrl: req.ImageUrl,
		ImageUrls: req.ImageUrls,
		IsActive: req.IsActive,
		BookingItems: req.BookingItems,
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
	created, err := services.Create(ctx, in)
	if err != nil {
		return nil, err
	}
	// Create the billing subscription from the partner's tier/audience (idempotent).
	if subErr := billing.OnPartnerOnboarded(ctx, "service", created.ID, created.AccessLevel, created.GuestType, created.OfficialRepCode); subErr != nil {
		log.Printf("service %d created but subscription upsert failed: %v", created.ID, subErr)
	}
	moderation.ScanAndFlag(ctx, "partner_profile", "service", created.ID, created.Name, auth.ActorLabel(ctx),
		moderation.NamedField{Name: "name", Value: created.Name},
		moderation.NamedField{Name: "description", Value: created.Description},
		moderation.NamedField{Name: "discountOffered", Value: created.DiscountOffered},
	)
	return created, nil
}

//encore:api auth method=PUT path=/service
func Update(ctx context.Context, req *UpdateRequest) (*appdb.ServiceData, error) {
	id, err := lookup(req.ServiceID)
	if err != nil {
		return nil, err
	}
	patch := store.ServicePatch{
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
		ServiceCategories:      req.ServiceCategories,
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
		BookingItems:           req.BookingItems,
	}
	item, err := services.Update(ctx, id, patch)
	if err != nil {
		if errors.Is(err, store.ErrServiceNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
		}
		return nil, err
	}
	moderation.ScanAndFlag(ctx, "partner_profile", "service", item.ID, item.Name, auth.ActorLabel(ctx),
		moderation.NamedField{Name: "name", Value: item.Name},
		moderation.NamedField{Name: "description", Value: item.Description},
		moderation.NamedField{Name: "discountOffered", Value: item.DiscountOffered},
	)
	return item, nil
}

//encore:api auth method=DELETE path=/service
func DeleteService(ctx context.Context, req *DeleteRequest) (*DeleteServiceResponse, error) {
	id, err := lookup(req.ServiceID)
	if err != nil {
		return nil, err
	}
	if err := services.Delete(ctx, id); err != nil {
		if errors.Is(err, store.ErrServiceNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
		}
		return nil, err
	}
	return &DeleteServiceResponse{Success: true}, nil
}

//encore:api auth method=GET path=/service/partner-code
func GetPartnerCode(ctx context.Context, req *PartnerCodeRequest) (*PartnerCodeResponse, error) {
	code, active, err := services.GetPartnerCode(ctx, req.ID)
	if err != nil {
		if errors.Is(err, store.ErrServiceNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
		}
		return nil, err
	}
	return &PartnerCodeResponse{PartnerCode: code, CodeActive: active}, nil
}

//encore:api auth method=POST path=/service/partner-code/regenerate
func RegeneratePartnerCode(ctx context.Context, req *RegeneratePartnerCodeRequest) (*PartnerCodeResponse, error) {
	code, active, err := services.RegeneratePartnerCode(ctx, req.ID, appdb.RandomCode(10))
	if err != nil {
		if errors.Is(err, store.ErrServiceNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
		}
		return nil, err
	}
	return &PartnerCodeResponse{PartnerCode: code, CodeActive: active}, nil
}

//encore:api auth method=POST path=/service/partner-code/toggle
func TogglePartnerCode(ctx context.Context, req *TogglePartnerCodeRequest) (*TogglePartnerCodeResponse, error) {
	if err := services.TogglePartnerCode(ctx, req.ID, req.Active); err != nil {
		if errors.Is(err, store.ErrServiceNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
		}
		return nil, err
	}
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
	items, err := services.List(ctx, "", "")
	if err != nil {
		return nil, err
	}
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(csvHeaders)
	for _, s := range items {
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

	for i, row := range req.Rows {
		if strings.TrimSpace(row.Name) == "" {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Name, "name is required"))
			continue
		}
		lat, lng := row.Latitude, row.Longitude
		in := &appdb.ServiceData{
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
		}
		if _, err := services.Create(ctx, in); err != nil {
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
