package attraction

import "backend_encore/internal/appdb"

type ListRequest struct {
	SortBy    string `query:"sortBy"`
	SortOrder string `query:"sortOrder"`
}

type ListResponse struct {
	Attractions []appdb.AttractionData `json:"attractions"`
}

type ListByMunicipalityRequest struct {
	Area string `query:"area"`
}

type ListNearbyRequest struct {
	Latitude  float64 `query:"latitude"`
	Longitude float64 `query:"longitude"`
	RadiusKm  float64 `query:"radiusKm"`
}

type GetRequest struct {
	AttractionID string `query:"attractionId"`
}

type CreateRequest struct {
	Name    string `json:"name"`
	Address string `json:"address"`

	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`

	Country       string `json:"country"`
	Province      string `json:"province"`
	Area          string `json:"area,omitempty"`
	PostalCode    string `json:"postalCode"`
	ContactNumber string `json:"contactNumber,omitempty"`
	Description   string `json:"description,omitempty"`

	AttractionType         []string `json:"attractionType"`
	LittleExplorerApproved bool     `json:"littleExplorerApproved"`

	PaymentCard   bool `json:"paymentCard"`
	PaymentCash   bool `json:"paymentCash"`
	PaymentMobile bool `json:"paymentMobile"`

	WheelchairAccess    bool `json:"wheelchairAccess"`
	ParkingAvailability bool `json:"parkingAvailability"`

	DiscountOffered string `json:"discountOffered,omitempty"`
	DiscountCode    string `json:"discountCode,omitempty"`

	ImageUrl string `json:"imageUrl,omitempty"`
	IsActive bool   `json:"isActive"`

	OfficialHoldingCompany string `json:"officialHoldingCompany,omitempty"`
	OfficialContactName    string `json:"officialContactName,omitempty"`
	OfficialContactNumber  string `json:"officialContactNumber,omitempty"`
	OfficialEmail          string `json:"officialEmail,omitempty"`
	OfficialRepCode        string `json:"officialRepCode,omitempty"`
	GuestType              string `json:"guestType,omitempty"`
	AccessLevel            string `json:"accessLevel,omitempty"`
}

type UpdateRequest struct {
	AttractionID string `json:"attractionId"`

	Name    *string `json:"name,omitempty"`
	Address *string `json:"address,omitempty"`

	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`

	Country       *string `json:"country,omitempty"`
	Province      *string `json:"province,omitempty"`
	Area          *string `json:"area,omitempty"`
	PostalCode    *string `json:"postalCode,omitempty"`
	ContactNumber *string `json:"contactNumber,omitempty"`
	Description   *string `json:"description,omitempty"`

	AttractionType         []string `json:"attractionType,omitempty"`
	LittleExplorerApproved *bool    `json:"littleExplorerApproved,omitempty"`

	PaymentCard   *bool `json:"paymentCard,omitempty"`
	PaymentCash   *bool `json:"paymentCash,omitempty"`
	PaymentMobile *bool `json:"paymentMobile,omitempty"`

	WheelchairAccess    *bool `json:"wheelchairAccess,omitempty"`
	ParkingAvailability *bool `json:"parkingAvailability,omitempty"`

	DiscountOffered *string `json:"discountOffered,omitempty"`
	DiscountCode    *string `json:"discountCode,omitempty"`

	ImageUrl *string `json:"imageUrl,omitempty"`
	IsActive *bool   `json:"isActive,omitempty"`

	OfficialHoldingCompany *string `json:"officialHoldingCompany,omitempty"`
	OfficialContactName    *string `json:"officialContactName,omitempty"`
	OfficialContactNumber  *string `json:"officialContactNumber,omitempty"`
	OfficialEmail          *string `json:"officialEmail,omitempty"`
	OfficialRepCode        *string `json:"officialRepCode,omitempty"`
	GuestType              *string `json:"guestType,omitempty"`
	AccessLevel            *string `json:"accessLevel,omitempty"`
}

type DeleteRequest struct {
	AttractionID string `json:"attractionId"`
}

type CSVResponse struct {
	CSV string `json:"csv"`
}

type ImportRow struct {
	Name                   string  `json:"name"`
	Address                string  `json:"address"`
	Latitude               float64 `json:"latitude"`
	Longitude              float64 `json:"longitude"`
	Country                string  `json:"country"`
	Province               string  `json:"province"`
	Area                   string  `json:"area,omitempty"`
	PostalCode             string  `json:"postalCode"`
	ContactNumber          string  `json:"contactNumber,omitempty"`
	AttractionType         string  `json:"attractionType"`
	ImageUrl               string  `json:"imageUrl,omitempty"`
	DiscountOffered        string  `json:"discountOffered,omitempty"`
	DiscountCode           string  `json:"discountCode,omitempty"`
	Description            string  `json:"description,omitempty"`
	PaymentCard            string  `json:"paymentCard,omitempty"`
	PaymentCash            string  `json:"paymentCash,omitempty"`
	PaymentMobile          string  `json:"paymentMobile,omitempty"`
	WheelchairAccess       string  `json:"wheelchairAccess,omitempty"`
	ParkingAvailability    string  `json:"parkingAvailability,omitempty"`
	LittleExplorerApproved string  `json:"littleExplorerApproved,omitempty"`
	IsActive               string  `json:"isActive,omitempty"`
}

type ImportRequest struct {
	Rows []ImportRow `json:"rows"`
}

type ImportResponse struct {
	Success  bool     `json:"success"`
	Imported int      `json:"imported"`
	Failed   int      `json:"failed"`
	Errors   []string `json:"errors"`
}

type PartnerCodeRequest struct {
	ID int64 `query:"id"`
}

type RegeneratePartnerCodeRequest struct {
	ID int64 `json:"id"`
}

type PartnerCodeResponse struct {
	PartnerCode string `json:"partnerCode"`
	CodeActive  bool   `json:"codeActive"`
}

type TogglePartnerCodeRequest struct {
	ID     int64 `json:"id"`
	Active bool  `json:"active"`
}

// DeleteAttractionResponse and TogglePartnerCodeResponse replace the
// previous anonymous *struct{} responses, which Encore's build rejects —
// every API response must be a named, exported type.
type DeleteAttractionResponse struct {
	Success bool `json:"success"`
}

type TogglePartnerCodeResponse struct {
	Success bool `json:"success"`
}
