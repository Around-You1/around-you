package appdb

// Real Estate & Rentals models — a fully isolated category (see
// migrations/000040_create_real_estate.sql and REAL_ESTATE_RENTALS_SPEC.md).
// Nothing here shares the services model.

// EstateAgency is an estate-agency page (a "partner-like" billable entity).
type EstateAgency struct {
	ID               int64    `json:"id"`
	Name             string   `json:"name"`
	Description      string   `json:"description,omitempty"`
	Address          string   `json:"address,omitempty"`
	Province         string   `json:"province,omitempty"`
	Country          string   `json:"country,omitempty"`
	PostalCode       string   `json:"postalCode,omitempty"`
	ContactNumber    string   `json:"contactNumber,omitempty"`
	Email            string   `json:"email,omitempty"`
	Latitude         *float64 `json:"latitude,omitempty"`
	Longitude        *float64 `json:"longitude,omitempty"`
	ImageURL         string   `json:"imageUrl,omitempty"`
	ImageURLs        []string `json:"imageUrls,omitempty"`
	CreateAgentPages bool     `json:"createAgentPages"`

	ProfileReferenceCode string `json:"profileReferenceCode,omitempty"`
	IsActive             bool   `json:"isActive"`
	IsDuplicate          bool   `json:"isDuplicate,omitempty"`
	DuplicateReason      string `json:"duplicateReason,omitempty"`

	// Official Use — billing attribution + rep commission.
	OfficialHoldingCompany string `json:"officialHoldingCompany,omitempty"`
	OfficialContactName    string `json:"officialContactName,omitempty"`
	OfficialContactNumber  string `json:"officialContactNumber,omitempty"`
	OfficialEmail          string `json:"officialEmail,omitempty"`
	OfficialRepCode        string `json:"officialRepCode,omitempty"`
	OfficialRepName        string `json:"officialRepName,omitempty"`
	CompanyRegNumber       string `json:"companyRegNumber,omitempty"`
	CompanyVatNumber       string `json:"companyVatNumber,omitempty"`
}

// StripSensitive removes internal/Official-Use fields from a guest-reachable copy.
func (a *EstateAgency) StripSensitive() {
	a.OfficialHoldingCompany = ""
	a.OfficialContactName = ""
	a.OfficialContactNumber = ""
	a.OfficialEmail = ""
	a.OfficialRepCode = ""
	a.OfficialRepName = ""
	a.CompanyRegNumber = ""
	a.CompanyVatNumber = ""
	a.IsDuplicate = false
	a.DuplicateReason = ""
}

// EstateAgent is an individual agent page under an agency (billed R300 each).
type EstateAgent struct {
	ID       int64  `json:"id"`
	AgencyID int64  `json:"agencyId,omitempty"` // 0 = standalone (no linked agency record)
	Name     string `json:"name"`

	// Standalone agents capture their own agency identity + location.
	AgencyName string   `json:"agencyName,omitempty"`
	Address    string   `json:"address,omitempty"`
	Province   string   `json:"province,omitempty"`
	PostalCode string   `json:"postalCode,omitempty"`
	Latitude   *float64 `json:"latitude,omitempty"`
	Longitude  *float64 `json:"longitude,omitempty"`

	PhotoURL      string `json:"photoUrl,omitempty"`
	ContactNumber string `json:"contactNumber,omitempty"`
	Email         string `json:"email,omitempty"`
	Bio           string `json:"bio,omitempty"`

	ProfileReferenceCode string `json:"profileReferenceCode,omitempty"`
	IsActive             bool   `json:"isActive"`

	// Official Use — per-agent billing attribution.
	OfficialHoldingCompany string `json:"officialHoldingCompany,omitempty"`
	OfficialContactName    string `json:"officialContactName,omitempty"`
	OfficialContactNumber  string `json:"officialContactNumber,omitempty"`
	OfficialEmail          string `json:"officialEmail,omitempty"`
	OfficialRepCode        string `json:"officialRepCode,omitempty"`
	OfficialRepName        string `json:"officialRepName,omitempty"`
	CompanyRegNumber       string `json:"companyRegNumber,omitempty"`
	CompanyVatNumber       string `json:"companyVatNumber,omitempty"`
}

func (a *EstateAgent) StripSensitive() {
	a.OfficialHoldingCompany = ""
	a.OfficialContactName = ""
	a.OfficialContactNumber = ""
	a.OfficialRepCode = ""
	a.OfficialRepName = ""
	a.CompanyRegNumber = ""
	a.CompanyVatNumber = ""
	// Agent email/contact are public on the agent page, so they stay.
}

// EstateProperty is a property listing under an agency, optionally assigned to
// an agent.
type EstateProperty struct {
	ID           int64    `json:"id"`
	AgencyID     int64    `json:"agencyId"`
	AgentID      *int64   `json:"agentId,omitempty"`
	Title        string   `json:"title"`
	PropertyType string   `json:"propertyType,omitempty"`
	PlotSizeM2   float64  `json:"plotSizeM2,omitempty"`
	HouseSizeM2  float64  `json:"houseSizeM2,omitempty"`
	Bedrooms     int      `json:"bedrooms,omitempty"`
	Bathrooms    int      `json:"bathrooms,omitempty"`
	Garages      int      `json:"garages,omitempty"`
	Features     []string `json:"features,omitempty"`
	PriceCents   int64    `json:"priceCents"`
	ListingType  string   `json:"listingType"` // "sale" | "rent"
	Address      string   `json:"address,omitempty"`
	Province     string   `json:"province,omitempty"`
	Country      string   `json:"country,omitempty"`
	PostalCode   string   `json:"postalCode,omitempty"`
	Latitude     *float64 `json:"latitude,omitempty"`
	Longitude    *float64 `json:"longitude,omitempty"`
	Description  string   `json:"description,omitempty"`
	ImageURL     string   `json:"imageUrl,omitempty"`
	ImageURLs    []string `json:"imageUrls,omitempty"`
	IsActive     bool     `json:"isActive"`
}
