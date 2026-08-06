package restaurant

import "backend_encore/internal/appdb"

type ListRequest struct {
	SortBy    string `query:"sortBy"`
	SortOrder string `query:"sortOrder"`
}

type ListResponse struct {
	Restaurants []appdb.Restaurant `json:"restaurants"`
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
	ID int64 `query:"id"`
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

	CuisineTypes           []string `json:"cuisineTypes"`
	MenuLink               string   `json:"menuLink,omitempty"`
	ServiceDineIn          bool     `json:"serviceDineIn"`
	ServiceTakeaway        bool     `json:"serviceTakeaway"`
	ServiceDelivery        bool     `json:"serviceDelivery"`
	LittleExplorerApproved bool     `json:"littleExplorerApproved"`

	PaymentCard   bool `json:"paymentCard"`
	PaymentCash   bool `json:"paymentCash"`
	PaymentMobile bool `json:"paymentMobile"`
	PaymentGaap     bool `json:"paymentGaap"`
	PaymentSnapScan bool `json:"paymentSnapScan"`
	PaymentYoco     bool `json:"paymentYoco"`
	PaymentZapper   bool `json:"paymentZapper"`

	WheelchairAccess    bool `json:"wheelchairAccess"`
	ParkingAvailability bool `json:"parkingAvailability"`

	WifiNetwork  string `json:"wifiNetwork,omitempty"`
	WifiPassword string `json:"wifiPassword,omitempty"`

	DiscountOffered string `json:"discountOffered,omitempty"`
	DiscountCode    string `json:"discountCode,omitempty"`

	BookingsEmail         string `json:"bookingsEmail,omitempty"`
	BookingsContactNumber string `json:"bookingsContactNumber,omitempty"`

	SocialsWebsite   string `json:"socialsWebsite,omitempty"`
	SocialsFacebook  string `json:"socialsFacebook,omitempty"`
	SocialsInstagram string `json:"socialsInstagram,omitempty"`
	SocialsTiktok    string `json:"socialsTiktok,omitempty"`
	SocialsTwitter   string `json:"socialsTwitter,omitempty"`

	ImageUrl  string   `json:"imageUrl,omitempty"`
	ImageUrls []string `json:"imageUrls,omitempty"`
	IsActive  bool     `json:"isActive"`

	OfficialHoldingCompany string `json:"officialHoldingCompany,omitempty"`
	OfficialContactName    string `json:"officialContactName,omitempty"`
	OfficialContactNumber  string `json:"officialContactNumber,omitempty"`
	OfficialEmail          string `json:"officialEmail,omitempty"`
	OfficialRepCode        string `json:"officialRepCode,omitempty"`
	OfficialRepName        string `json:"officialRepName,omitempty"`
	CompanyRegNumber       string `json:"companyRegNumber,omitempty"`
	CompanyVatNumber       string `json:"companyVatNumber,omitempty"`
	GuestType              string `json:"guestType,omitempty"`
	AccessLevel            string `json:"accessLevel,omitempty"`
	BookingItems           []appdb.BookingItem `json:"bookingItems,omitempty"`
}

type UpdateRequest struct {
	ID int64 `json:"id"`

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

	CuisineTypes           []string `json:"cuisineTypes,omitempty"`
	MenuLink               *string  `json:"menuLink,omitempty"`
	ServiceDineIn          *bool    `json:"serviceDineIn,omitempty"`
	ServiceTakeaway        *bool    `json:"serviceTakeaway,omitempty"`
	ServiceDelivery        *bool    `json:"serviceDelivery,omitempty"`
	LittleExplorerApproved *bool    `json:"littleExplorerApproved,omitempty"`

	PaymentCard   *bool `json:"paymentCard,omitempty"`
	PaymentCash   *bool `json:"paymentCash,omitempty"`
	PaymentMobile *bool `json:"paymentMobile,omitempty"`
	PaymentGaap     *bool `json:"paymentGaap,omitempty"`
	PaymentSnapScan *bool `json:"paymentSnapScan,omitempty"`
	PaymentYoco     *bool `json:"paymentYoco,omitempty"`
	PaymentZapper   *bool `json:"paymentZapper,omitempty"`

	WheelchairAccess    *bool `json:"wheelchairAccess,omitempty"`
	ParkingAvailability *bool `json:"parkingAvailability,omitempty"`

	WifiNetwork  *string `json:"wifiNetwork,omitempty"`
	WifiPassword *string `json:"wifiPassword,omitempty"`

	DiscountOffered *string `json:"discountOffered,omitempty"`
	DiscountCode    *string `json:"discountCode,omitempty"`

	BookingsEmail         *string `json:"bookingsEmail,omitempty"`
	BookingsContactNumber *string `json:"bookingsContactNumber,omitempty"`

	SocialsWebsite   *string `json:"socialsWebsite,omitempty"`
	SocialsFacebook  *string `json:"socialsFacebook,omitempty"`
	SocialsInstagram *string `json:"socialsInstagram,omitempty"`
	SocialsTiktok    *string `json:"socialsTiktok,omitempty"`
	SocialsTwitter   *string `json:"socialsTwitter,omitempty"`

	ImageUrl    *string  `json:"imageUrl,omitempty"`
	ImageUrls   []string `json:"imageUrls,omitempty"`
	MenuPdfUrls []string `json:"menuPdfUrls,omitempty"`
	IsActive    *bool    `json:"isActive,omitempty"`

	OfficialHoldingCompany *string `json:"officialHoldingCompany,omitempty"`
	OfficialContactName    *string `json:"officialContactName,omitempty"`
	OfficialContactNumber  *string `json:"officialContactNumber,omitempty"`
	OfficialEmail          *string `json:"officialEmail,omitempty"`
	OfficialRepCode        *string `json:"officialRepCode,omitempty"`
	OfficialRepName        *string `json:"officialRepName,omitempty"`
	CompanyRegNumber       *string `json:"companyRegNumber,omitempty"`
	CompanyVatNumber       *string `json:"companyVatNumber,omitempty"`
	GuestType              *string `json:"guestType,omitempty"`
	AccessLevel            *string `json:"accessLevel,omitempty"`
	BookingItems           []appdb.BookingItem `json:"bookingItems,omitempty"`
}

type DeleteRequest struct {
	ID int64 `json:"id"`
}

type CSVResponse struct {
	CSV string `json:"csv"`
}

type ImportRow struct {
	Name                string  `json:"name"`
	Address             string  `json:"address"`
	Latitude            float64 `json:"latitude"`
	Longitude           float64 `json:"longitude"`
	Country             string  `json:"country"`
	Province            string  `json:"province"`
	Area                string  `json:"area,omitempty"`
	PostalCode          string  `json:"postalCode"`
	ContactNumber       string  `json:"contactNumber,omitempty"`
	CuisineTypes        string  `json:"cuisineTypes"`
	MenuLink            string  `json:"menuLink,omitempty"`
	ImageUrl            string  `json:"imageUrl,omitempty"`
	DiscountOffered     string  `json:"discountOffered,omitempty"`
	DiscountCode        string  `json:"discountCode,omitempty"`
	Description         string  `json:"description,omitempty"`
	PaymentCard         string  `json:"paymentCard,omitempty"`
	PaymentCash         string  `json:"paymentCash,omitempty"`
	PaymentMobile       string  `json:"paymentMobile,omitempty"`
	WheelchairAccess    string  `json:"wheelchairAccess,omitempty"`
	ParkingAvailability string  `json:"parkingAvailability,omitempty"`
	ServiceDineIn       string  `json:"serviceDineIn,omitempty"`
	ServiceTakeaway     string  `json:"serviceTakeaway,omitempty"`
	ServiceDelivery     string  `json:"serviceDelivery,omitempty"`
	WifiNetwork         string  `json:"wifiNetwork,omitempty"`
	WifiPassword        string  `json:"wifiPassword,omitempty"`
	LittleExplorerApproved string `json:"littleExplorerApproved,omitempty"`
	IsActive            string  `json:"isActive,omitempty"`
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

// DeleteRestaurantResponse and TogglePartnerCodeResponse replace the
// previous anonymous *struct{} responses, which Encore's build rejects —
// every API response must be a named, exported type.
type DeleteRestaurantResponse struct {
	Success bool `json:"success"`
}

type TogglePartnerCodeResponse struct {
	Success bool `json:"success"`
}
