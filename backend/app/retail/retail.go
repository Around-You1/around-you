package retail

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
	"backend_encore/internal/demovis"
	"backend_encore/internal/errs"
	"backend_encore/internal/moderation"
	"backend_encore/store"
)

var repo = store.NewRetailStore()

// publicize strips sensitive fields for non-internal callers (anti-scraping).
func publicize(ctx context.Context, items []appdb.ServiceData) []appdb.ServiceData {
	// Demo guests (Test Guesthouse) are limited to the fixed demo partners.
	if demovis.IsRestrictedGuest(ctx) {
		kept := make([]appdb.ServiceData, 0, len(items))
		for _, it := range items {
			if appdb.DemoGuestAllowsPartner(it.ProfileReferenceCode) {
				kept = append(kept, it)
			}
		}
		items = kept
	}
	// "We support <org>" badge: resolve each partner's Team Leader organisation
	// from its onboarding rep (public display field, survives StripSensitive).
	{
		codes := make([]string, 0, len(items))
		for i := range items {
			codes = append(codes, items[i].OfficialRepCode)
		}
		orgs := appdb.SupportOrgNamesForReps(ctx, codes)
		for i := range items {
			items[i].SupportOrgName = orgs[strings.ToLower(strings.TrimSpace(items[i].OfficialRepCode))]
		}
	}
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
	items, err := repo.List(ctx, req.SortBy, req.SortOrder)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Services: publicize(ctx, items)}, nil
}

//encore:api auth method=GET path=/service/by-municipality
func ListByMunicipality(ctx context.Context, req *ListByMunicipalityRequest) (*ListResponse, error) {
	// A demo (Test Guesthouse) guest sees only the demo partners, ignoring area.
	if demovis.IsRestrictedGuest(ctx) {
		return List(ctx, &ListRequest{})
	}
	items, err := repo.ListByMunicipality(ctx, req.Area)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Services: publicize(ctx, items)}, nil
}

//encore:api auth method=GET path=/service/nearby
func ListNearby(ctx context.Context, req *ListNearbyRequest) (*ListResponse, error) {
	// A demo (Test Guesthouse) guest sees only the demo partners, ignoring distance.
	if demovis.IsRestrictedGuest(ctx) {
		return List(ctx, &ListRequest{})
	}
	all, err := repo.ListNearby(ctx)
	if err != nil {
		return nil, err
	}
	// Resolve the point to search FROM: real GPS when supplied, else the centre
	// of the searcher's postal code (a Local Guest gives only a postal code).
	searchLat, searchLng, haveSearch := appdb.SearcherCoords(req.Latitude, req.Longitude, req.PostalCode)
	wantPostal := strings.ToLower(strings.TrimSpace(req.PostalCode))
	radius := req.RadiusKm
	if radius <= 0 {
		radius = 50
	}
	out := make([]appdb.ServiceData, 0, len(all))
	for _, s := range all {
		// This endpoint serves the dedicated Retail table, so every row belongs
		// here — there is no is_nonprofit split to apply (that filter only makes
		// sense on the shared services table). Filtering by it here wrongly
		// dropped migrated rows whose is_nonprofit flag was still set.
		// Every partner is matched by real distance. A fixed partner uses its own
		// coordinates; a mobile or un-geocoded partner is placed at the centre of
		// its postal code. Exact postal code is kept as a safety net for codes not
		// yet in the centroid table.
		if appdb.WithinRadius(searchLat, searchLng, haveSearch, s.Latitude, s.Longitude, s.PostalCode, wantPostal, radius) {
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
	item, err := repo.Get(ctx, id)
	if err != nil {
		if errors.Is(err, store.ErrRetailNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
		}
		return nil, err
	}
	item.SupportOrgName = appdb.SupportOrgNameForRep(ctx, item.OfficialRepCode)
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
	if err := moderation.BlockError(
		moderation.NamedField{Name: "name", Value: req.Name},
		moderation.NamedField{Name: "description", Value: req.Description},
		moderation.NamedField{Name: "discountOffered", Value: req.DiscountOffered},
	); err != nil {
		return nil, err
	}
	in := &appdb.ServiceData{
		Name:                   req.Name,
		Address:                req.Address,
		AccountingAddress:      req.AccountingAddress,
		IsNonProfit:            req.IsNonProfit,
		NpoNumber:              req.NpoNumber,
		PboNumber:              req.PboNumber,
		BrandColor:             req.BrandColor,
		Latitude:               req.Latitude,
		Longitude:              req.Longitude,
		Country:                req.Country,
		Province:               req.Province,
		Area:                   req.Area,
		PostalCode:             req.PostalCode,
		ContactNumber:          req.ContactNumber,
		Description:            req.Description,
		TradingHours:           req.TradingHours,
		PublicHolidays:         req.PublicHolidays,
		ProfileReferenceCode:   appdb.RandomCode(12),
		ServiceCategories:      req.ServiceCategories,
		OffersBookings:         req.OffersBookings,
		LittleExplorerApproved: req.LittleExplorerApproved,
		PaymentMethods: appdb.PaymentMethods{
			PaymentCard:     req.PaymentCard,
			PaymentCash:     req.PaymentCash,
			PaymentMobile:   req.PaymentMobile,
			PaymentGaap:     req.PaymentGaap,
			PaymentSnapScan: req.PaymentSnapScan,
			PaymentYoco:     req.PaymentYoco,
			PaymentZapper:   req.PaymentZapper,
			PaymentEft:      req.PaymentEft,
		},
		WheelchairAccess:       req.WheelchairAccess,
		ParkingAvailability:    req.ParkingAvailability,
		DiscountOffered:        req.DiscountOffered,
		DiscountCode:           req.DiscountCode,
		LocalDiscountOffered:   req.LocalDiscountOffered,
		LocalDiscountCode:      req.LocalDiscountCode,
		DiscountEnabled:        req.DiscountEnabled,
		LocalDiscountEnabled:   req.LocalDiscountEnabled,
		WorksFromClientAddress: req.WorksFromClientAddress,
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
		ImageUrl:      req.ImageUrl,
		ImageUrls:     req.ImageUrls,
		IsActive:      req.IsActive,
		BookingItems:  req.BookingItems,
		PreOrderItems: req.PreOrderItems,
		Specials:      req.Specials,
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
		PartnerCode: appdb.PartnerCode{Code: appdb.RandomCode(12), Active: true},
	}
	created, err := repo.Create(ctx, in)
	if err != nil {
		return nil, err
	}
	// Create the billing subscription from the partner's tier/audience (idempotent).
	if subErr := billing.OnPartnerOnboarded(ctx, "retail", created.ID, created.AccessLevel, created.GuestType, created.OfficialRepCode); subErr != nil {
		log.Printf("service %d created but subscription upsert failed: %v", created.ID, subErr)
	}
	syncSpecialLoyalty(ctx, created.ID, created.Specials)
	moderation.ScanAndFlag(ctx, "partner_profile", "retail", created.ID, created.Name, auth.ActorLabel(ctx),
		moderation.NamedField{Name: "name", Value: created.Name},
		moderation.NamedField{Name: "description", Value: created.Description},
		moderation.NamedField{Name: "discountOffered", Value: created.DiscountOffered},
	)
	dedupe.CheckOnCreate(ctx, "retail", "contact_number", "retail", created.ID,
		created.Name, created.ContactNumber, created.Address, created.OfficialRepCode, auth.ActorLabel(ctx))
	return created, nil
}

// syncSpecialLoyalty keeps one loyalty program per "My Stamp Card" promotion so
// each promotion is its own stamp card, auto-enabled straight from the promotion
// (no separate toggle). It first disables every promotion-based program for this
// partner, then re-upserts the ones still present and active — so a promotion
// that was removed or switched to a plain Discount drops out of customers' cards.
// Best-effort: a failure here never blocks the profile save.
func syncSpecialLoyalty(ctx context.Context, partnerID int64, specials appdb.RetailSpecials) {
	if _, err := appdb.SQLDB.ExecContext(ctx,
		`UPDATE loyalty_programs SET enabled = false, updated_at = now()
		 WHERE partner_type = 'retail' AND partner_id = $1 AND special_id <> ''`, partnerID); err != nil {
		log.Printf("retail %d: loyalty disable sweep failed: %v", partnerID, err)
	}
	for _, sp := range specials {
		if sp.ID == "" || sp.Type != "stampcard" {
			continue
		}
		th := sp.Threshold
		if th < 1 {
			th = 10
		}
		if _, err := appdb.SQLDB.ExecContext(ctx, `
			INSERT INTO loyalty_programs (partner_type, partner_id, special_id, enabled, threshold, reward_text, label)
			VALUES ('retail', $1, $2, $3, $4, $5, $6)
			ON CONFLICT (partner_type, partner_id, special_id) DO UPDATE SET
			  enabled = EXCLUDED.enabled, threshold = EXCLUDED.threshold,
			  reward_text = EXCLUDED.reward_text, label = EXCLUDED.label, updated_at = now()`,
			partnerID, sp.ID, sp.Enabled, th, sp.Line2, sp.Line1); err != nil {
			log.Printf("retail %d: loyalty sync special %s failed: %v", partnerID, sp.ID, err)
		}
	}
}

//encore:api auth method=PUT path=/service
func Update(ctx context.Context, req *UpdateRequest) (*appdb.ServiceData, error) {
	id, err := lookup(req.ServiceID)
	if err != nil {
		return nil, err
	}
	if err := moderation.BlockError(
		moderation.PtrField("name", req.Name),
		moderation.PtrField("description", req.Description),
		moderation.PtrField("discountOffered", req.DiscountOffered),
	); err != nil {
		return nil, err
	}

	// Authorisation: staff (SuperAdmin/Admin/Rep) may edit any profile. A
	// Partner — including a session obtained by scanning this profile's QR —
	// may edit ONLY their own profile, and ONLY with a valid Edit Code. This
	// is the server-side gate; the dashboard's edit-code prompt is just the UI.
	if !auth.IsPrivileged(ctx) {
		d := auth.FromContext(ctx)
		if d == nil || d.User == nil || d.User.Role != "Partner" || d.User.EntityType != "retail" || d.User.EntityID != id {
			return nil, &errs.Error{Code: errs.PermissionDenied, Message: "you can only edit your own profile"}
		}
		storedEditCode, ecErr := repo.GetEditCode(ctx, id)
		if ecErr != nil {
			return nil, &errs.Error{Code: errs.NotFound, Message: "partner not found"}
		}
		if strings.TrimSpace(req.EditCode) == "" || !strings.EqualFold(strings.TrimSpace(req.EditCode), strings.TrimSpace(storedEditCode)) {
			return nil, &errs.Error{Code: errs.PermissionDenied, Message: "a valid edit code is required to edit this profile"}
		}
	}
	patch := store.RetailPatch{
		Name:                   req.Name,
		Address:                req.Address,
		AccountingAddress:      req.AccountingAddress,
		IsNonProfit:            req.IsNonProfit,
		NpoNumber:              req.NpoNumber,
		PboNumber:              req.PboNumber,
		BrandColor:             req.BrandColor,
		Latitude:               req.Latitude,
		Longitude:              req.Longitude,
		Country:                req.Country,
		Province:               req.Province,
		Area:                   req.Area,
		PostalCode:             req.PostalCode,
		ContactNumber:          req.ContactNumber,
		Description:            req.Description,
		TradingHours:           req.TradingHours,
		PublicHolidays:         req.PublicHolidays,
		ServiceCategories:      req.ServiceCategories,
		OffersBookings:         req.OffersBookings,
		LittleExplorerApproved: req.LittleExplorerApproved,
		PaymentCard:            req.PaymentCard,
		PaymentCash:            req.PaymentCash,
		PaymentMobile:          req.PaymentMobile,
		PaymentGaap:            req.PaymentGaap,
		PaymentSnapScan:        req.PaymentSnapScan,
		PaymentYoco:            req.PaymentYoco,
		PaymentZapper:          req.PaymentZapper,
		PaymentEft:             req.PaymentEft,
		WheelchairAccess:       req.WheelchairAccess,
		ParkingAvailability:    req.ParkingAvailability,
		DiscountOffered:        req.DiscountOffered,
		DiscountCode:           req.DiscountCode,
		LocalDiscountOffered:   req.LocalDiscountOffered,
		LocalDiscountCode:      req.LocalDiscountCode,
		DiscountEnabled:        req.DiscountEnabled,
		LocalDiscountEnabled:   req.LocalDiscountEnabled,
		WorksFromClientAddress: req.WorksFromClientAddress,
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
		PreOrderItems:          req.PreOrderItems,
		Specials:               req.Specials,
	}
	item, err := repo.Update(ctx, id, patch)
	if err != nil {
		if errors.Is(err, store.ErrRetailNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
		}
		return nil, err
	}
	moderation.ScanAndFlag(ctx, "partner_profile", "retail", item.ID, item.Name, auth.ActorLabel(ctx),
		moderation.NamedField{Name: "name", Value: item.Name},
		moderation.NamedField{Name: "description", Value: item.Description},
		moderation.NamedField{Name: "discountOffered", Value: item.DiscountOffered},
	)
	// Keep the billing subscription in sync with the edited profile — notably
	// propagating a changed official rep code to the subscription's rep_code so
	// activation bills (or complimentary-exempts) against the CURRENT rep.
	// Idempotent and must not block the edit; never touches next_bill_date or
	// status, so a paused/unactivated subscription stays paused.
	if subErr := billing.EnsureSubscription(ctx, "retail", item.ID, item.AccessLevel, item.GuestType, item.OfficialRepCode); subErr != nil {
		log.Printf("service %d updated but subscription sync failed: %v", item.ID, subErr)
	}
	syncSpecialLoyalty(ctx, item.ID, item.Specials)
	return item, nil
}

//encore:api auth method=DELETE path=/service
func DeleteService(ctx context.Context, req *DeleteRequest) (*DeleteServiceResponse, error) {
	id, err := lookup(req.ServiceID)
	if err != nil {
		return nil, err
	}
	if err := repo.Delete(ctx, id); err != nil {
		if errors.Is(err, store.ErrRetailNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
		}
		return nil, err
	}
	return &DeleteServiceResponse{Success: true}, nil
}

//encore:api auth method=GET path=/service/partner-code
func GetPartnerCode(ctx context.Context, req *PartnerCodeRequest) (*PartnerCodeResponse, error) {
	code, active, err := repo.GetPartnerCode(ctx, req.ID)
	if err != nil {
		if errors.Is(err, store.ErrRetailNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
		}
		return nil, err
	}
	return &PartnerCodeResponse{PartnerCode: code, CodeActive: active}, nil
}

//encore:api auth method=POST path=/service/partner-code/regenerate
func RegeneratePartnerCode(ctx context.Context, req *RegeneratePartnerCodeRequest) (*PartnerCodeResponse, error) {
	code, active, err := repo.RegeneratePartnerCode(ctx, req.ID, appdb.RandomCode(12))
	if err != nil {
		if errors.Is(err, store.ErrRetailNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "service not found"}
		}
		return nil, err
	}
	return &PartnerCodeResponse{PartnerCode: code, CodeActive: active}, nil
}

//encore:api auth method=POST path=/service/partner-code/toggle
func TogglePartnerCode(ctx context.Context, req *TogglePartnerCodeRequest) (*TogglePartnerCodeResponse, error) {
	if err := repo.TogglePartnerCode(ctx, req.ID, req.Active); err != nil {
		if errors.Is(err, store.ErrRetailNotFound) {
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
	// Extended fields (append-only).
	"guestType", "accessLevel",
	"officialRepCode", "officialRepName", "officialHoldingCompany", "officialContactName",
	"officialContactNumber", "officialEmail", "companyRegNumber", "companyVatNumber",
	"localDiscountOffered", "localDiscountCode",
	"paymentGaap", "paymentSnapScan", "paymentYoco", "paymentZapper",
	"socialsWebsite", "socialsFacebook", "socialsInstagram", "socialsTiktok", "socialsTwitter",
	"imageUrls",
	"safetyInfo", "ageRestrictions", "fitnessLevel", "bestTimeOfDay", "whatToBring",
	"offersBookings",
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
		// Extended fields
		"Guest Only", "Tier 2",
		"Rep00000002", "Jane Rep", "Holding Co (Pty) Ltd", "Contact Person",
		"+27 21 000 0003", "owner@example.com", "2020/123456/07", "4001234567",
		"10% off for locals", "LOCAL10",
		"false", "true", "false", "false",
		"https://example.com", "https://facebook.com/example", "https://instagram.com/example", "", "",
		"https://example.com/1.jpg,https://example.com/2.jpg",
		"Bring a towel", "18+", "Easy", "Morning", "Comfortable clothing",
		"true",
	})
	w.Flush()
	return &CSVResponse{CSV: sb.String()}, nil
}

//encore:api auth method=GET path=/service/export
func ExportServices(ctx context.Context) (*CSVResponse, error) {
	items, err := repo.List(ctx, "", "")
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
			// Extended fields
			s.GuestType, s.AccessLevel,
			s.OfficialRepCode, s.OfficialRepName, s.OfficialHoldingCompany, s.OfficialContactName,
			s.OfficialContactNumber, s.OfficialEmail, s.CompanyRegNumber, s.CompanyVatNumber,
			s.LocalDiscountOffered, s.LocalDiscountCode,
			strconv.FormatBool(s.PaymentGaap), strconv.FormatBool(s.PaymentSnapScan), strconv.FormatBool(s.PaymentYoco), strconv.FormatBool(s.PaymentZapper),
			s.SocialsWebsite, s.SocialsFacebook, s.SocialsInstagram, s.SocialsTiktok, s.SocialsTwitter,
			strings.Join(s.ImageUrls, ","),
			s.SafetyInfo, s.AgeRestrictions, s.FitnessLevel, s.BestTimeOfDay, s.WhatToBring,
			strconv.FormatBool(s.OffersBookings),
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
			LittleExplorerApproved: parseBool(row.LittleExplorerApproved),
			OffersBookings:         parseBool(row.OffersBookings),
			IsActive:               parseBool(row.IsActive),
			ImageUrls:              splitCSVList(row.ImageUrls),
			LocalDiscountOffered:   row.LocalDiscountOffered,
			LocalDiscountCode:      row.LocalDiscountCode,
			DiscountEnabled:        row.DiscountOffered != "",
			LocalDiscountEnabled:   row.LocalDiscountOffered != "",
			WorksFromClientAddress: false,
			ExperienceInfo: appdb.ExperienceInfo{
				SafetyInfo:      row.SafetyInfo,
				AgeRestrictions: row.AgeRestrictions,
				FitnessLevel:    row.FitnessLevel,
				BestTimeOfDay:   row.BestTimeOfDay,
				WhatToBring:     row.WhatToBring,
			},
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
				GuestType:              appdb.NormalizeGuestType(row.GuestType),
				AccessLevel:            appdb.NormalizeAccessLevel(row.AccessLevel),
			},
			PartnerCode: appdb.PartnerCode{Code: appdb.RandomCode(12), Active: true},
		}
		created, err := repo.Create(ctx, in)
		if err != nil {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Name, err.Error()))
			continue
		}
		if subErr := billing.OnPartnerOnboarded(ctx, "retail", created.ID, created.AccessLevel, created.GuestType, created.OfficialRepCode); subErr != nil {
			log.Printf("service import %d: subscription setup failed: %v", created.ID, subErr)
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
