package estate

// CSV import/export for the three estate entities (agencies, agents,
// properties). Mirrors the pattern used by the restaurant/service/attraction/
// accommodation packages: a downloadable template with a sample row, a full
// export, and a bulk import. Imports set up billing the same way onboarding
// does (agencies/agents bill R300/mo, paused until a SuperAdmin activates the
// profile; properties are not billed).

import (
	"context"
	"encoding/csv"
	"log"
	"math"
	"strconv"
	"strings"

	"backend_encore/internal/appdb"
	"backend_encore/internal/billing"
)

// ---- shared response shapes + helpers ---------------------------------------

type CSVResponse struct {
	CSV string `json:"csv"`
}

type ImportResponse struct {
	Success  bool     `json:"success"`
	Imported int      `json:"imported"`
	Failed   int      `json:"failed"`
	Errors   []string `json:"errors"`
}

func floatStr(f *float64) string {
	if f == nil {
		return ""
	}
	return strconv.FormatFloat(*f, 'f', -1, 64)
}

func parseBool(s string) bool {
	v, _ := strconv.ParseBool(strings.TrimSpace(s))
	return v
}

func parseIntCSV(s string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(s))
	return n
}

func parseInt64CSV(s string) int64 {
	n, _ := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
	return n
}

func parseFloatCSV(s string) float64 {
	f, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return f
}

// latLngPtr converts a CSV cell into a *float64 (nil when blank).
func latLngPtr(s string) *float64 {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	f := parseFloatCSV(s)
	return &f
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

func rowError(index int, name, msg string) string {
	if name == "" {
		name = "unnamed"
	}
	return "Row " + strconv.Itoa(index+2) + " (" + name + "): " + msg
}

// ================= Agencies =================

var agencyHeaders = []string{
	"name", "description", "address", "province", "country", "postalCode",
	"contactNumber", "email", "latitude", "longitude", "imageUrl", "imageUrls",
	"createAgentPages", "isActive",
	"officialRepCode", "officialRepName", "officialHoldingCompany", "officialContactName",
	"officialContactNumber", "officialEmail", "companyRegNumber", "companyVatNumber",
}

//encore:api auth method=GET path=/estate/agency/template
func AgencyTemplate(ctx context.Context) (*CSVResponse, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(agencyHeaders)
	_ = w.Write([]string{
		"Sample Estates", "A friendly local agency", "1 Main Rd", "Western Cape", "South Africa", "8001",
		"+27 21 000 0000", "info@example.com", "-33.9", "18.4", "https://example.com/1.jpg", "https://example.com/1.jpg,https://example.com/2.jpg",
		"false", "true",
		"Rep00000002", "Jane Rep", "Holding Co (Pty) Ltd", "Contact Person",
		"+27 21 000 0003", "owner@example.com", "2020/123456/07", "4001234567",
	})
	w.Flush()
	return &CSVResponse{CSV: sb.String()}, nil
}

//encore:api auth method=GET path=/estate/agency/export
func ExportAgencies(ctx context.Context) (*CSVResponse, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	items, err := agencies.List(ctx, false)
	if err != nil {
		return nil, err
	}
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(agencyHeaders)
	for _, a := range items {
		_ = w.Write([]string{
			a.Name, a.Description, a.Address, a.Province, a.Country, a.PostalCode,
			a.ContactNumber, a.Email, floatStr(a.Latitude), floatStr(a.Longitude), a.ImageURL, strings.Join(a.ImageURLs, ","),
			strconv.FormatBool(a.CreateAgentPages), strconv.FormatBool(a.IsActive),
			a.OfficialRepCode, a.OfficialRepName, a.OfficialHoldingCompany, a.OfficialContactName,
			a.OfficialContactNumber, a.OfficialEmail, a.CompanyRegNumber, a.CompanyVatNumber,
		})
	}
	w.Flush()
	return &CSVResponse{CSV: sb.String()}, nil
}

type AgencyImportRow struct {
	Name                   string `json:"name"`
	Description            string `json:"description,omitempty"`
	Address                string `json:"address,omitempty"`
	Province               string `json:"province,omitempty"`
	Country                string `json:"country,omitempty"`
	PostalCode             string `json:"postalCode,omitempty"`
	ContactNumber          string `json:"contactNumber,omitempty"`
	Email                  string `json:"email,omitempty"`
	Latitude               string `json:"latitude,omitempty"`
	Longitude              string `json:"longitude,omitempty"`
	ImageURL               string `json:"imageUrl,omitempty"`
	ImageURLs              string `json:"imageUrls,omitempty"`
	CreateAgentPages       string `json:"createAgentPages,omitempty"`
	IsActive               string `json:"isActive,omitempty"`
	OfficialRepCode        string `json:"officialRepCode,omitempty"`
	OfficialRepName        string `json:"officialRepName,omitempty"`
	OfficialHoldingCompany string `json:"officialHoldingCompany,omitempty"`
	OfficialContactName    string `json:"officialContactName,omitempty"`
	OfficialContactNumber  string `json:"officialContactNumber,omitempty"`
	OfficialEmail          string `json:"officialEmail,omitempty"`
	CompanyRegNumber       string `json:"companyRegNumber,omitempty"`
	CompanyVatNumber       string `json:"companyVatNumber,omitempty"`
}

type AgencyImportRequest struct {
	Rows []AgencyImportRow `json:"rows"`
}

//encore:api auth method=POST path=/estate/agency/import
func ImportAgencies(ctx context.Context, req *AgencyImportRequest) (*ImportResponse, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	resp := &ImportResponse{Errors: []string{}}
	for i, row := range req.Rows {
		if strings.TrimSpace(row.Name) == "" {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Name, "name is required"))
			continue
		}
		in := &appdb.EstateAgency{
			Name:                   row.Name,
			Description:            row.Description,
			Address:                row.Address,
			Province:               row.Province,
			Country:                row.Country,
			PostalCode:             row.PostalCode,
			ContactNumber:          row.ContactNumber,
			Email:                  row.Email,
			Latitude:               latLngPtr(row.Latitude),
			Longitude:              latLngPtr(row.Longitude),
			ImageURL:               row.ImageURL,
			ImageURLs:              splitCSVList(row.ImageURLs),
			CreateAgentPages:       parseBool(row.CreateAgentPages),
			IsActive:               parseBool(row.IsActive),
			ProfileReferenceCode:   appdb.RandomCode(12),
			OfficialHoldingCompany: row.OfficialHoldingCompany,
			OfficialContactName:    row.OfficialContactName,
			OfficialContactNumber:  row.OfficialContactNumber,
			OfficialEmail:          row.OfficialEmail,
			OfficialRepCode:        row.OfficialRepCode,
			OfficialRepName:        row.OfficialRepName,
			CompanyRegNumber:       row.CompanyRegNumber,
			CompanyVatNumber:       row.CompanyVatNumber,
		}
		created, err := agencies.Create(ctx, in)
		if err != nil {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Name, err.Error()))
			continue
		}
		if subErr := billing.OnPartnerOnboarded(ctx, "estate_agency", created.ID, "", "", created.OfficialRepCode); subErr != nil {
			log.Printf("estate agency import %d: subscription setup failed: %v", created.ID, subErr)
		}
		resp.Imported++
	}
	resp.Success = resp.Failed == 0
	return resp, nil
}

// ================= Agents =================

var agentHeaders = []string{
	"name", "agencyId", "agencyName", "address", "province", "postalCode",
	"latitude", "longitude", "photoUrl", "contactNumber", "email", "bio", "isActive",
	"officialRepCode", "officialRepName", "officialHoldingCompany", "officialContactName",
	"officialContactNumber", "officialEmail", "companyRegNumber", "companyVatNumber",
}

//encore:api auth method=GET path=/estate/agent/template
func AgentTemplate(ctx context.Context) (*CSVResponse, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(agentHeaders)
	_ = w.Write([]string{
		"Jane Agent", "0", "Sample Estates", "1 Main Rd", "Western Cape", "8001",
		"-33.9", "18.4", "https://example.com/agent.jpg", "+27 21 000 0000", "jane@example.com", "Experienced local agent.", "true",
		"Rep00000002", "Jane Rep", "Holding Co (Pty) Ltd", "Contact Person",
		"+27 21 000 0003", "owner@example.com", "2020/123456/07", "4001234567",
	})
	w.Flush()
	return &CSVResponse{CSV: sb.String()}, nil
}

//encore:api auth method=GET path=/estate/agent/export
func ExportAgents(ctx context.Context) (*CSVResponse, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	items, err := agents.ListAll(ctx, false)
	if err != nil {
		return nil, err
	}
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(agentHeaders)
	for _, a := range items {
		_ = w.Write([]string{
			a.Name, strconv.FormatInt(a.AgencyID, 10), a.AgencyName, a.Address, a.Province, a.PostalCode,
			floatStr(a.Latitude), floatStr(a.Longitude), a.PhotoURL, a.ContactNumber, a.Email, a.Bio, strconv.FormatBool(a.IsActive),
			a.OfficialRepCode, a.OfficialRepName, a.OfficialHoldingCompany, a.OfficialContactName,
			a.OfficialContactNumber, a.OfficialEmail, a.CompanyRegNumber, a.CompanyVatNumber,
		})
	}
	w.Flush()
	return &CSVResponse{CSV: sb.String()}, nil
}

type AgentImportRow struct {
	Name                   string `json:"name"`
	AgencyID               string `json:"agencyId,omitempty"`
	AgencyName             string `json:"agencyName,omitempty"`
	Address                string `json:"address,omitempty"`
	Province               string `json:"province,omitempty"`
	PostalCode             string `json:"postalCode,omitempty"`
	Latitude               string `json:"latitude,omitempty"`
	Longitude              string `json:"longitude,omitempty"`
	PhotoURL               string `json:"photoUrl,omitempty"`
	ContactNumber          string `json:"contactNumber,omitempty"`
	Email                  string `json:"email,omitempty"`
	Bio                    string `json:"bio,omitempty"`
	IsActive               string `json:"isActive,omitempty"`
	OfficialRepCode        string `json:"officialRepCode,omitempty"`
	OfficialRepName        string `json:"officialRepName,omitempty"`
	OfficialHoldingCompany string `json:"officialHoldingCompany,omitempty"`
	OfficialContactName    string `json:"officialContactName,omitempty"`
	OfficialContactNumber  string `json:"officialContactNumber,omitempty"`
	OfficialEmail          string `json:"officialEmail,omitempty"`
	CompanyRegNumber       string `json:"companyRegNumber,omitempty"`
	CompanyVatNumber       string `json:"companyVatNumber,omitempty"`
}

type AgentImportRequest struct {
	Rows []AgentImportRow `json:"rows"`
}

//encore:api auth method=POST path=/estate/agent/import
func ImportAgents(ctx context.Context, req *AgentImportRequest) (*ImportResponse, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	resp := &ImportResponse{Errors: []string{}}
	for i, row := range req.Rows {
		if strings.TrimSpace(row.Name) == "" {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Name, "name is required"))
			continue
		}
		in := &appdb.EstateAgent{
			Name:                   row.Name,
			AgencyID:               parseInt64CSV(row.AgencyID),
			AgencyName:             row.AgencyName,
			Address:                row.Address,
			Province:               row.Province,
			PostalCode:             row.PostalCode,
			Latitude:               latLngPtr(row.Latitude),
			Longitude:              latLngPtr(row.Longitude),
			PhotoURL:               row.PhotoURL,
			ContactNumber:          row.ContactNumber,
			Email:                  row.Email,
			Bio:                    row.Bio,
			IsActive:               parseBool(row.IsActive),
			ProfileReferenceCode:   appdb.RandomCode(12),
			OfficialHoldingCompany: row.OfficialHoldingCompany,
			OfficialContactName:    row.OfficialContactName,
			OfficialContactNumber:  row.OfficialContactNumber,
			OfficialEmail:          row.OfficialEmail,
			OfficialRepCode:        row.OfficialRepCode,
			OfficialRepName:        row.OfficialRepName,
			CompanyRegNumber:       row.CompanyRegNumber,
			CompanyVatNumber:       row.CompanyVatNumber,
		}
		created, err := agents.Create(ctx, in)
		if err != nil {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Name, err.Error()))
			continue
		}
		if subErr := billing.OnPartnerOnboarded(ctx, "estate_agent", created.ID, "", "", created.OfficialRepCode); subErr != nil {
			log.Printf("estate agent import %d: subscription setup failed: %v", created.ID, subErr)
		}
		resp.Imported++
	}
	resp.Success = resp.Failed == 0
	return resp, nil
}

// ================= Properties =================

var propertyHeaders = []string{
	"agencyId", "agentId", "title", "propertyType", "plotSizeM2", "houseSizeM2",
	"bedrooms", "bathrooms", "garages", "features", "price", "listingType",
	"address", "province", "country", "postalCode", "latitude", "longitude",
	"description", "imageUrl", "imageUrls", "isActive",
}

//encore:api auth method=GET path=/estate/property/template
func PropertyTemplate(ctx context.Context) (*CSVResponse, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(propertyHeaders)
	_ = w.Write([]string{
		"1", "", "3 Bed House in Cape Town", "House", "500", "180",
		"3", "2", "1", "Pool,Garden,Security", "2500000", "sale",
		"1 Main Rd", "Western Cape", "South Africa", "8001", "-33.9", "18.4",
		"A lovely family home.", "https://example.com/1.jpg", "https://example.com/1.jpg,https://example.com/2.jpg", "true",
	})
	w.Flush()
	return &CSVResponse{CSV: sb.String()}, nil
}

//encore:api auth method=GET path=/estate/property/export
func ExportProperties(ctx context.Context) (*CSVResponse, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	items, err := properties.ListAllActive(ctx)
	if err != nil {
		return nil, err
	}
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(propertyHeaders)
	for _, p := range items {
		agentID := ""
		if p.AgentID != nil {
			agentID = strconv.FormatInt(*p.AgentID, 10)
		}
		_ = w.Write([]string{
			strconv.FormatInt(p.AgencyID, 10), agentID, p.Title, p.PropertyType,
			strconv.FormatFloat(p.PlotSizeM2, 'f', -1, 64), strconv.FormatFloat(p.HouseSizeM2, 'f', -1, 64),
			strconv.Itoa(p.Bedrooms), strconv.Itoa(p.Bathrooms), strconv.Itoa(p.Garages), strings.Join(p.Features, ","),
			strconv.FormatFloat(float64(p.PriceCents)/100, 'f', 2, 64), p.ListingType,
			p.Address, p.Province, p.Country, p.PostalCode, floatStr(p.Latitude), floatStr(p.Longitude),
			p.Description, p.ImageURL, strings.Join(p.ImageURLs, ","), strconv.FormatBool(p.IsActive),
		})
	}
	w.Flush()
	return &CSVResponse{CSV: sb.String()}, nil
}

type PropertyImportRow struct {
	AgencyID     string `json:"agencyId,omitempty"`
	AgentID      string `json:"agentId,omitempty"`
	Title        string `json:"title"`
	PropertyType string `json:"propertyType,omitempty"`
	PlotSizeM2   string `json:"plotSizeM2,omitempty"`
	HouseSizeM2  string `json:"houseSizeM2,omitempty"`
	Bedrooms     string `json:"bedrooms,omitempty"`
	Bathrooms    string `json:"bathrooms,omitempty"`
	Garages      string `json:"garages,omitempty"`
	Features     string `json:"features,omitempty"`
	Price        string `json:"price,omitempty"`
	ListingType  string `json:"listingType,omitempty"`
	Address      string `json:"address,omitempty"`
	Province     string `json:"province,omitempty"`
	Country      string `json:"country,omitempty"`
	PostalCode   string `json:"postalCode,omitempty"`
	Latitude     string `json:"latitude,omitempty"`
	Longitude    string `json:"longitude,omitempty"`
	Description  string `json:"description,omitempty"`
	ImageURL     string `json:"imageUrl,omitempty"`
	ImageURLs    string `json:"imageUrls,omitempty"`
	IsActive     string `json:"isActive,omitempty"`
}

type PropertyImportRequest struct {
	Rows []PropertyImportRow `json:"rows"`
}

//encore:api auth method=POST path=/estate/property/import
func ImportProperties(ctx context.Context, req *PropertyImportRequest) (*ImportResponse, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	resp := &ImportResponse{Errors: []string{}}
	for i, row := range req.Rows {
		if strings.TrimSpace(row.Title) == "" {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Title, "title is required"))
			continue
		}
		listing := strings.TrimSpace(row.ListingType)
		if listing == "" {
			listing = "sale"
		}
		in := &appdb.EstateProperty{
			AgencyID:     parseInt64CSV(row.AgencyID),
			Title:        row.Title,
			PropertyType: row.PropertyType,
			PlotSizeM2:   parseFloatCSV(row.PlotSizeM2),
			HouseSizeM2:  parseFloatCSV(row.HouseSizeM2),
			Bedrooms:     parseIntCSV(row.Bedrooms),
			Bathrooms:    parseIntCSV(row.Bathrooms),
			Garages:      parseIntCSV(row.Garages),
			Features:     splitCSVList(row.Features),
			PriceCents:   int64(math.Round(parseFloatCSV(row.Price) * 100)),
			ListingType:  listing,
			Address:      row.Address,
			Province:     row.Province,
			Country:      row.Country,
			PostalCode:   row.PostalCode,
			Latitude:     latLngPtr(row.Latitude),
			Longitude:    latLngPtr(row.Longitude),
			Description:  row.Description,
			ImageURL:     row.ImageURL,
			ImageURLs:    splitCSVList(row.ImageURLs),
			IsActive:     parseBool(row.IsActive),
		}
		if aid := parseInt64CSV(row.AgentID); aid > 0 {
			in.AgentID = &aid
		}
		if _, err := properties.Create(ctx, in); err != nil {
			resp.Failed++
			resp.Errors = append(resp.Errors, rowError(i, row.Title, err.Error()))
			continue
		}
		resp.Imported++
	}
	resp.Success = resp.Failed == 0
	return resp, nil
}
