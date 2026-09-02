package restaurant

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
	"backend_encore/internal/dedupe"
	"backend_encore/internal/errs"
	"backend_encore/internal/moderation"
	"backend_encore/store"
)

var restaurants = store.NewRestaurantStore()

// publicize strips sensitive fields (see appdb.Restaurant.StripSensitive) unless
// the caller is an internal role. Applied to every guest-reachable read so a
// scraped guest token only ever receives display fields.
func publicize(ctx context.Context, items []appdb.Restaurant) []appdb.Restaurant {
	if auth.IsPrivileged(ctx) {
		return items
	}
	for i := range items {
		items[i].StripSensitive()
	}
	return items
}

//encore:api auth method=GET path=/restaurant
func List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	items, err := restaurants.List(ctx, req.SortBy, req.SortOrder)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Restaurants: publicize(ctx, items)}, nil
}

//encore:api auth method=GET path=/restaurant/by-municipality
func ListByMunicipality(ctx context.Context, req *ListByMunicipalityRequest) (*ListResponse, error) {
	items, err := restaurants.ListByMunicipality(ctx, req.Area)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Restaurants: publicize(ctx, items)}, nil
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
	return &ListResponse{Restaurants: publicize(ctx, out)}, nil
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
	if !auth.IsPrivileged(ctx) {
		r.StripSensitive()
	}
	return r, nil
}

//encore:api auth method=POST path=/restaurant
func Create(ctx context.Context, req *CreateRequest) (*appdb.Restaurant, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "name is required"}
	}
	if err := moderation.BlockError(
		moderation.NamedField{Name: "name", Value: req.Name},
		moderation.NamedField{Name: "description", Value: req.Description},
		moderation.NamedField{Name: "discountOffered", Value: req.DiscountOffered},
	); err != nil {
		return nil, err
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
		RestaurantType:         req.RestaurantType,
		Atmosphere:             req.Atmosphere,
		Features:               req.Features,
		MenuLink:               req.MenuLink,
		ServiceDineIn:          req.ServiceDineIn,
		ServiceTakeaway:        req.ServiceTakeaway,
		ServiceDelivery:        req.ServiceDelivery,
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
		WifiNetwork:         req.WifiNetwork,
		WifiPassword:        req.WifiPassword,
		DiscountOffered:     req.DiscountOffered,
		DiscountCode:        req.DiscountCode,
		LocalDiscountOffered: req.LocalDiscountOffered,
		LocalDiscountCode:    req.LocalDiscountCode,
		BookingsEmail:         req.BookingsEmail,
		BookingsContactNumber: req.BookingsContactNumber,
		Socials: appdb.Socials{
			SocialsWebsite:   req.SocialsWebsite,
			SocialsFacebook:  req.SocialsFacebook,
			SocialsInstagram: req.SocialsInstagram,
			SocialsTiktok:    req.SocialsTiktok,
			SocialsTwitter:   req.SocialsTwitter,
		},
		ImageUrl:            req.ImageUrl,
		ImageUrls:           req.ImageUrls,
		IsActive:            req.IsActive,
		BookingItems:        req.BookingItems,
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
	created, err := restaurants.Create(ctx, in)
	if err != nil {
		return nil, err
	}
	// Create the billing subscription from the partner's tier/audience. Failure
	// here must not block onboarding — it is idempotent, so a later edit/re-save
	// will reconcile it; we log and continue.
	if subErr := billing.OnPartnerOnboarded(ctx, "restaurant", created.ID, created.AccessLevel, created.GuestType, created.OfficialRepCode); subErr != nil {
		log.Printf("restaurant %d created but subscription upsert failed: %v", created.ID, subErr)
	}
	moderation.ScanAndFlag(ctx, "partner_profile", "restaurant", created.ID, created.Name, auth.ActorLabel(ctx),
		moderation.NamedField{Name: "name", Value: created.Name},
		moderation.NamedField{Name: "description", Value: created.Description},
		moderation.NamedField{Name: "discountOffered", Value: created.DiscountOffered},
	)
	dedupe.CheckOnCreate(ctx, "restaurants", "contact_number", "restaurant", created.ID,
		created.Name, created.ContactNumber, created.Address, created.OfficialRepCode, auth.ActorLabel(ctx))
	return created, nil
}

//encore:api auth method=PUT path=/restaurant
func Update(ctx context.Context, req *UpdateRequest) (*appdb.Restaurant, error) {
	if err := moderation.BlockError(
		moderation.PtrField("name", req.Name),
		moderation.PtrField("description", req.Description),
		moderation.PtrField("discountOffered", req.DiscountOffered),
	); err != nil {
		return nil, err
	}
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
		RestaurantType:         req.RestaurantType,
		Atmosphere:             req.Atmosphere,
		Features:               req.Features,
		MenuLink:               req.MenuLink,
		ServiceDineIn:          req.ServiceDineIn,
		ServiceTakeaway:        req.ServiceTakeaway,
		ServiceDelivery:        req.ServiceDelivery,
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
		WifiNetwork:            req.WifiNetwork,
		WifiPassword:           req.WifiPassword,
		DiscountOffered:        req.DiscountOffered,
		DiscountCode:           req.DiscountCode,
		LocalDiscountOffered:   req.LocalDiscountOffered,
		LocalDiscountCode:      req.LocalDiscountCode,
		BookingsEmail:          req.BookingsEmail,
		BookingsContactNumber:  req.BookingsContactNumber,
		SocialsWebsite:         req.SocialsWebsite,
		SocialsFacebook:        req.SocialsFacebook,
		SocialsInstagram:       req.SocialsInstagram,
		SocialsTiktok:          req.SocialsTiktok,
		SocialsTwitter:         req.SocialsTwitter,
		ImageUrl:               req.ImageUrl,
		ImageUrls:              req.ImageUrls,
		MenuPdfUrls:            req.MenuPdfUrls,
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
	r, err := restaurants.Update(ctx, req.ID, patch)
	if err != nil {
		if errors.Is(err, store.ErrRestaurantNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
		}
		return nil, err
	}
	moderation.ScanAndFlag(ctx, "partner_profile", "restaurant", r.ID, r.Name, auth.ActorLabel(ctx),
		moderation.NamedField{Name: "name", Value: r.Name},
		moderation.NamedField{Name: "description", Value: r.Description},
		moderation.NamedField{Name: "discountOffered", Value: r.DiscountOffered},
	)
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
	// Extended fields (append-only; existing columns above are unchanged).
	"guestType", "accessLevel",
	"officialRepCode", "officialRepName", "officialHoldingCompany", "officialContactName",
	"officialContactNumber", "officialEmail", "companyRegNumber", "companyVatNumber",
	"localDiscountOffered", "localDiscountCode",
	"paymentGaap", "paymentSnapScan", "paymentYoco", "paymentZapper",
	"socialsWebsite", "socialsFacebook", "socialsInstagram", "socialsTiktok", "socialsTwitter",
	"restaurantType", "atmosphere", "features", "imageUrls", "menuPdfUrls",
	"bookingsEmail", "bookingsContactNumber",
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
		// Extended fields
		"Guest Only", "Tier 2",
		"Rep00000002", "Jane Rep", "Holding Co (Pty) Ltd", "Contact Person",
		"+27 21 000 0003", "owner@example.com", "2020/123456/07", "4001234567",
		"10% off for locals", "LOCAL10",
		"false", "true", "false", "false",
		"https://example.com", "https://facebook.com/example", "https://instagram.com/example", "", "",
		"Fine Dining,Casual", "Romantic,Family Friendly", "Outdoor Seating,Live Music", "https://example.com/1.jpg,https://example.com/2.jpg", "https://example.com/menu2.pdf",
		"bookings@example.com", "+27 21 000 0004",
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
			// Extended fields
			r.GuestType, r.AccessLevel,
			r.OfficialRepCode, r.OfficialRepName, r.OfficialHoldingCompany, r.OfficialContactName,
			r.OfficialContactNumber, r.OfficialEmail, r.CompanyRegNumber, r.CompanyVatNumber,
			r.LocalDiscountOffered, r.LocalDiscountCode,
			strconv.FormatBool(r.PaymentGaap), strconv.FormatBool(r.PaymentSnapScan), strconv.FormatBool(r.PaymentYoco), strconv.FormatBool(r.PaymentZapper),
			r.SocialsWebsite, r.SocialsFacebook, r.SocialsInstagram, r.SocialsTiktok, r.SocialsTwitter,
			strings.Join(r.RestaurantType, ","), strings.Join(r.Atmosphere, ","), strings.Join(r.Features, ","), strings.Join(r.ImageUrls, ","), strings.Join(r.MenuPdfUrls, ","),
			r.BookingsEmail, r.BookingsContactNumber,
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
				PaymentCard:     parseBool(row.PaymentCard),
				PaymentCash:     parseBool(row.PaymentCash),
				PaymentMobile:   parseBool(row.PaymentMobile),
				PaymentGaap:     parseBool(row.PaymentGaap),
				PaymentSnapScan: parseBool(row.PaymentSnapScan),
				PaymentYoco:     parseBool(row.PaymentYoco),
				PaymentZapper:   parseBool(row.PaymentZapper),
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
			RestaurantType:         splitCSVList(row.RestaurantType),
			Atmosphere:             splitCSVList(row.Atmosphere),
			Features:               splitCSVList(row.Features),
			ImageUrls:              splitCSVList(row.ImageUrls),
			MenuPdfUrls:            splitCSVList(row.MenuPdfUrls),
			LocalDiscountOffered:   row.LocalDiscountOffered,
			LocalDiscountCode:      row.LocalDiscountCode,
			BookingsEmail:          row.BookingsEmail,
			BookingsContactNumber:  row.BookingsContactNumber,
			Socials: appdb.Socials{
				SocialsWebsite:   row.SocialsWebsite,
				SocialsFacebook:  row.SocialsFacebook,
				SocialsInstagram: row.SocialsInstagram,
				SocialsTiktok:    row.SocialsTiktok,
				SocialsTwitter:   row.SocialsTwitter,
			},
			OfficialUse: appdb.OfficialUse{
				OfficialHoldingCompany: row.OfficialHoldingCompany,
				OfficialContactName:    row.OfficialContactName,
				OfficialContactNumber:  row.OfficialContactNumber,
				OfficialEmail:          row.OfficialEmail,
				OfficialRepCode:        row.OfficialRepCode,
				OfficialRepName:        row.OfficialRepName,
				CompanyRegNumber:       row.CompanyRegNumber,
				CompanyVatNumber:       row.CompanyVatNumber,
				GuestType:              row.GuestType,
				AccessLevel:            row.AccessLevel,
			},
			PartnerCode: appdb.PartnerCode{Code: appdb.RandomCode(10), Active: true},
		}
		created, err := restaurants.Create(ctx, in)
		if err != nil {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Name, err.Error()))
			continue
		}
		// Set up billing like the normal onboarding path (paused until a
		// SuperAdmin activates the profile). Non-fatal — a later save reconciles.
		if subErr := billing.OnPartnerOnboarded(ctx, "restaurant", created.ID, created.AccessLevel, created.GuestType, created.OfficialRepCode); subErr != nil {
			log.Printf("restaurant import %d: subscription setup failed: %v", created.ID, subErr)
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
