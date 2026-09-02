// Package accommodation implements CRUD, CSV template/export/import for
// accommodations. Handler signatures and Encore annotations are unchanged
// from the original in-memory version — only the storage internals changed,
// first to inline SQL, and now to the dedicated store.Store (Phase 5).
package accommodation

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

var accommodations = store.NewStore()

// publicize strips internal Official-Use / duplicate fields from accommodation
// reads unless the caller is an internal (privileged) role — same treatment as
// restaurant/service/attraction. Guest-facing fields are kept.
func publicize(ctx context.Context, items []appdb.Accommodation) []appdb.Accommodation {
	if auth.IsPrivileged(ctx) {
		return items
	}
	for i := range items {
		items[i].StripSensitive()
	}
	return items
}

//encore:api auth method=GET path=/accommodation
func List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	items, err := accommodations.List(ctx, req.SortBy, req.SortOrder)
	if err != nil {
		return nil, err
	}
	return &ListResponse{Accommodations: publicize(ctx, items)}, nil
}

//encore:api auth method=GET path=/accommodation/get
func Get(ctx context.Context, req *GetRequest) (*appdb.Accommodation, error) {
	a, err := accommodations.Get(ctx, req.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "accommodation not found"}
		}
		return nil, err
	}
	if !auth.IsPrivileged(ctx) {
		a.StripSensitive()
	}
	return a, nil
}

//encore:api auth method=POST path=/accommodation
func Create(ctx context.Context, req *CreateRequest) (*appdb.Accommodation, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "name is required"}
	}
	if req.Province == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "province is required"}
	}
	if err := moderation.BlockError(
		moderation.NamedField{Name: "name", Value: req.Name},
		moderation.NamedField{Name: "description", Value: req.Description},
	); err != nil {
		return nil, err
	}

	in := &appdb.Accommodation{
		Name:                  req.Name,
		Address:               req.Address,
		Latitude:              req.Latitude,
		Longitude:             req.Longitude,
		Country:               req.Country,
		Province:              req.Province,
		Area:                  req.Area,
		PostalCode:            req.PostalCode,
		Contact:               req.Contact,
		Description:           req.Description,
		WheelchairAccess:      req.WheelchairAccess,
		ParkingAvailability:   req.ParkingAvailability,
		Facilities:            req.Facilities,
		WifiName:              req.WifiName,
		WifiPassword:          req.WifiPassword,
		CheckInInstructions:   req.CheckInInstructions,
		CheckOutInstructions:  req.CheckOutInstructions,
		Amenities:             req.Amenities,
		Guidelines:            req.Guidelines,
		PrimaryContact:        req.PrimaryContact,
		PoliceContact:         req.PoliceContact,
		DoctorContact:         req.DoctorContact,
		AmbulanceContact:      req.AmbulanceContact,
		HospitalContact:       req.HospitalContact,
		FireDepartmentContact: req.FireDepartmentContact,
		SnakeCatchersContact:  req.SnakeCatchersContact,
		NsriContact:           req.NsriContact,
		VetContact:            req.VetContact,
		CommunityWatchContact: req.CommunityWatchContact,
		LocalSecurityContact:  req.LocalSecurityContact,
		Doctors:               req.Doctors,
		Vets:                  req.Vets,
		HospitalAddress:       req.HospitalAddress,
		Units:                 req.Units,
		ImageUrl:              req.ImageUrl,
		ImageUrls:             req.ImageUrls,
		IsActive:              req.IsActive,
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
	}

	created, err := accommodations.Create(ctx, in)
	if err != nil {
		return nil, err
	}
	// Accommodations are Tier 4 by rule; PriceFor sets that regardless of the
	// (empty) tier/audience fields. Idempotent — failure logs but doesn't block.
	if subErr := billing.OnPartnerOnboarded(ctx, "accommodation", created.ID, created.AccessLevel, created.GuestType, created.OfficialRepCode); subErr != nil {
		log.Printf("accommodation %d created but subscription upsert failed: %v", created.ID, subErr)
	}
	moderation.ScanAndFlag(ctx, "partner_profile", "accommodation", created.ID, created.Name, auth.ActorLabel(ctx),
		moderation.NamedField{Name: "name", Value: created.Name},
		moderation.NamedField{Name: "description", Value: created.Description},
	)
	dedupe.CheckOnCreate(ctx, "accommodations", "contact", "accommodation", created.ID,
		created.Name, created.Contact, created.Address, created.OfficialRepCode, auth.ActorLabel(ctx))
	return created, nil
}

//encore:api auth method=PUT path=/accommodation
func Update(ctx context.Context, req *UpdateRequest) (*appdb.Accommodation, error) {
	if err := moderation.BlockError(
		moderation.PtrField("name", req.Name),
		moderation.PtrField("description", req.Description),
	); err != nil {
		return nil, err
	}
	patch := store.Patch{
		Name:                  req.Name,
		Address:               req.Address,
		Latitude:              req.Latitude,
		Longitude:             req.Longitude,
		Country:               req.Country,
		Province:              req.Province,
		Area:                  req.Area,
		PostalCode:            req.PostalCode,
		Contact:               req.Contact,
		Description:           req.Description,
		WifiName:              req.WifiName,
		WifiPassword:          req.WifiPassword,
		ImageUrl:              req.ImageUrl,
		ImageUrls:             req.ImageUrls,
		CheckInInstructions:   req.CheckInInstructions,
		Amenities:             req.Amenities,
		Guidelines:            req.Guidelines,
		CheckOutInstructions:  req.CheckOutInstructions,
		WheelchairAccess:      req.WheelchairAccess,
		ParkingAvailability:   req.ParkingAvailability,
		PrimaryContact:        req.PrimaryContact,
		PoliceContact:         req.PoliceContact,
		DoctorContact:         req.DoctorContact,
		AmbulanceContact:      req.AmbulanceContact,
		HospitalContact:       req.HospitalContact,
		FireDepartmentContact: req.FireDepartmentContact,
		SnakeCatchersContact:  req.SnakeCatchersContact,
		NsriContact:           req.NsriContact,
		VetContact:            req.VetContact,
		CommunityWatchContact: req.CommunityWatchContact,
		LocalSecurityContact:  req.LocalSecurityContact,
		Doctors:               req.Doctors,
		Vets:                  req.Vets,
		HospitalAddress:       req.HospitalAddress,
		Units:                 req.Units,
		Facilities:            req.Facilities,
		IsActive:              req.IsActive,
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

	a, err := accommodations.Update(ctx, req.ID, patch)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "accommodation not found"}
		}
		return nil, err
	}
	moderation.ScanAndFlag(ctx, "partner_profile", "accommodation", a.ID, a.Name, auth.ActorLabel(ctx),
		moderation.NamedField{Name: "name", Value: a.Name},
		moderation.NamedField{Name: "description", Value: a.Description},
	)
	return a, nil
}

//encore:api auth method=DELETE path=/accommodation
func DeleteAccommodation(ctx context.Context, req *DeleteRequest) (*DeleteAccommodationResponse, error) {
	if err := accommodations.Delete(ctx, req.ID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "accommodation not found"}
		}
		return nil, err
	}
	return &DeleteAccommodationResponse{Success: true}, nil
}

var csvHeaders = []string{
	"name", "address", "latitude", "longitude", "country", "province", "area", "postalCode",
	"wifiName", "wifiPassword", "imageUrl", "checkInInstructions", "amenities", "guidelines",
	"checkOutInstructions", "primaryContact", "policeContact", "doctorContact", "ambulanceContact",
	"hospitalContact", "fireDepartmentContact", "wheelchairAccess", "parkingAvailability", "isActive",
	// Extended fields (append-only). Note: the multi-entry doctors/vets lists are
	// nested and remain UI-only; the single-number contacts below are flat.
	"guestType", "accessLevel",
	"officialRepCode", "officialRepName", "officialHoldingCompany", "officialContactName",
	"officialContactNumber", "officialEmail", "companyRegNumber", "companyVatNumber",
	"units", "contact", "facilities", "imageUrls", "hospitalAddress",
	"snakeCatchersContact", "nsriContact", "vetContact", "communityWatchContact", "localSecurityContact",
}

//encore:api auth method=GET path=/accommodation/template
func Template(ctx context.Context) (*CSVResponse, error) {
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(csvHeaders)
	_ = w.Write([]string{
		"Sample Lodge", "1 Main Rd", "-33.9", "18.4", "South Africa", "Western Cape", "Cape Town", "8001",
		"GuestWifi", "password123", "https://example.com/image.jpg", "Check in after 2pm", "Pool, braai area",
		"No smoking indoors", "Check out by 10am", "+27 21 000 0000", "10111", "+27 21 000 0001", "10177",
		"+27 21 000 0002", "10177", "true", "true", "true",
		// Extended fields
		"Guest Only", "Tier 2",
		"Rep00000002", "Jane Rep", "Holding Co (Pty) Ltd", "Contact Person",
		"+27 21 000 0003", "owner@example.com", "2020/123456/07", "4001234567",
		"8", "+27 21 000 0005", "Pool,Braai,Parking", "https://example.com/1.jpg,https://example.com/2.jpg", "12 Hospital Rd, Cape Town",
		"+27 21 000 0006", "+27 21 000 0007", "+27 21 000 0008", "+27 21 000 0009", "+27 21 000 0010",
	})
	w.Flush()
	return &CSVResponse{CSV: sb.String()}, nil
}

//encore:api auth method=GET path=/accommodation/export
func ExportAccommodations(ctx context.Context) (*CSVResponse, error) {
	items, err := accommodations.List(ctx, "", "")
	if err != nil {
		return nil, err
	}

	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(csvHeaders)
	for _, a := range items {
		_ = w.Write([]string{
			a.Name, a.Address, floatStr(a.Latitude), floatStr(a.Longitude), a.Country, a.Province, a.Area, a.PostalCode,
			a.WifiName, a.WifiPassword, a.ImageUrl, a.CheckInInstructions, a.Amenities, a.Guidelines,
			a.CheckOutInstructions, a.PrimaryContact, a.PoliceContact, a.DoctorContact, a.AmbulanceContact,
			a.HospitalContact, a.FireDepartmentContact, strconv.FormatBool(a.WheelchairAccess),
			strconv.FormatBool(a.ParkingAvailability), strconv.FormatBool(a.IsActive),
			// Extended fields
			a.GuestType, a.AccessLevel,
			a.OfficialRepCode, a.OfficialRepName, a.OfficialHoldingCompany, a.OfficialContactName,
			a.OfficialContactNumber, a.OfficialEmail, a.CompanyRegNumber, a.CompanyVatNumber,
			strconv.Itoa(a.Units), a.Contact, strings.Join(a.Facilities, ","), strings.Join(a.ImageUrls, ","), a.HospitalAddress,
			a.SnakeCatchersContact, a.NsriContact, a.VetContact, a.CommunityWatchContact, a.LocalSecurityContact,
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

//encore:api auth method=POST path=/accommodation/import
func ImportAccommodations(ctx context.Context, req *ImportRequest) (*ImportResponse, error) {
	resp := &ImportResponse{Errors: []string{}}

	for i, row := range req.Rows {
		if strings.TrimSpace(row.Name) == "" {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Name, "name is required"))
			continue
		}

		lat, lng := row.Latitude, row.Longitude
		in := &appdb.Accommodation{
			Name:                  row.Name,
			Address:               row.Address,
			Latitude:              &lat,
			Longitude:             &lng,
			Country:               row.Country,
			Province:              row.Province,
			Area:                  row.Area,
			PostalCode:            row.PostalCode,
			WifiName:              row.WifiName,
			WifiPassword:          row.WifiPassword,
			ImageUrl:              row.ImageUrl,
			CheckInInstructions:   row.CheckInInstructions,
			Amenities:             row.Amenities,
			Guidelines:            row.Guidelines,
			CheckOutInstructions:  row.CheckOutInstructions,
			PrimaryContact:        row.PrimaryContact,
			PoliceContact:         row.PoliceContact,
			DoctorContact:         row.DoctorContact,
			AmbulanceContact:      row.AmbulanceContact,
			HospitalContact:       row.HospitalContact,
			FireDepartmentContact: row.FireDepartmentContact,
			WheelchairAccess:      parseBool(row.WheelchairAccess),
			ParkingAvailability:   parseBool(row.ParkingAvailability),
			IsActive:              parseBool(row.IsActive),
			Units:                 parseIntSafe(row.Units),
			Contact:               row.Contact,
			Facilities:            splitCSVList(row.Facilities),
			ImageUrls:             splitCSVList(row.ImageUrls),
			HospitalAddress:       row.HospitalAddress,
			SnakeCatchersContact:  row.SnakeCatchersContact,
			NsriContact:           row.NsriContact,
			VetContact:            row.VetContact,
			CommunityWatchContact: row.CommunityWatchContact,
			LocalSecurityContact:  row.LocalSecurityContact,
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
		}

		created, err := accommodations.Create(ctx, in)
		if err != nil {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Name, err.Error()))
			continue
		}
		if subErr := billing.OnPartnerOnboarded(ctx, "accommodation", created.ID, created.AccessLevel, created.GuestType, created.OfficialRepCode); subErr != nil {
			log.Printf("accommodation import %d: subscription setup failed: %v", created.ID, subErr)
		}
		resp.Imported++
	}

	resp.Success = resp.Failed == 0
	return resp, nil
}

func parseBool(s string) bool {
	v, _ := strconv.ParseBool(strings.TrimSpace(s))
	return v
}

// parseIntSafe parses an integer, returning 0 for blank/invalid input.
func parseIntSafe(s string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(s))
	return n
}

// splitCSVList splits a comma-separated cell into a trimmed slice (nil if blank).
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

func rowError(index int, name, msg string) string {
	if name == "" {
		name = "unnamed"
	}
	return "Row " + strconv.Itoa(index+2) + " (" + name + "): " + msg
}
