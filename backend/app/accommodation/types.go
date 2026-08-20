package accommodation

import "backend_encore/internal/appdb"

// ---- List --------------------------------------------------------------

type ListRequest struct {
	SortBy    string `query:"sortBy"`
	SortOrder string `query:"sortOrder"`
}

type ListResponse struct {
	Accommodations []appdb.Accommodation `json:"accommodations"`
}

// ---- Get -----------------------------------------------------------------

type GetRequest struct {
	ID int64 `query:"id"`
}

// ---- Create / Update -------------------------------------------------------

// CreateRequest mirrors the exact payload AccommodationForm.tsx submits
// (formData spread + parsed lat/lng + officialUse fields).
type CreateRequest struct {
	Name    string `json:"name"`
	Address string `json:"address"`

	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`

	Country    string `json:"country"`
	Province   string `json:"province"`
	Area       string `json:"area,omitempty"`
	PostalCode string `json:"postalCode"`

	Contact     string `json:"contact,omitempty"`
	Description string `json:"description,omitempty"`

	WifiName     string   `json:"wifiName,omitempty"`
	WifiPassword string   `json:"wifiPassword,omitempty"`
	ImageUrl     string   `json:"imageUrl,omitempty"`
	ImageUrls    []string `json:"imageUrls,omitempty"`

	CheckInInstructions  string `json:"checkInInstructions,omitempty"`
	Amenities            string `json:"amenities,omitempty"`
	Guidelines           string `json:"guidelines,omitempty"`
	CheckOutInstructions string `json:"checkOutInstructions,omitempty"`

	WheelchairAccess    bool `json:"wheelchairAccess"`
	ParkingAvailability bool `json:"parkingAvailability"`

	PrimaryContact        string `json:"primaryContact,omitempty"`
	PoliceContact         string `json:"policeContact,omitempty"`
	DoctorContact         string `json:"doctorContact,omitempty"`
	AmbulanceContact      string `json:"ambulanceContact,omitempty"`
	HospitalContact       string `json:"hospitalContact,omitempty"`
	FireDepartmentContact string `json:"fireDepartmentContact,omitempty"`
	SnakeCatchersContact  string `json:"snakeCatchersContact,omitempty"`
	NsriContact           string `json:"nsriContact,omitempty"`
	VetContact            string `json:"vetContact,omitempty"`
	CommunityWatchContact string `json:"communityWatchContact,omitempty"`
	LocalSecurityContact  string `json:"localSecurityContact,omitempty"`

	Facilities []string `json:"facilities,omitempty"`
	IsActive   bool     `json:"isActive"`
	Units      int      `json:"units,omitempty"`

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
}

// UpdateRequest is the same as CreateRequest but keyed by ID and with every
// field optional (AccommodationList.tsx's toggleActive only sends {id,
// isActive}, for example) — pointers let us distinguish "not sent" from
// "sent as zero value".
type UpdateRequest struct {
	ID int64 `json:"id"`

	Name    *string `json:"name,omitempty"`
	Address *string `json:"address,omitempty"`

	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`

	Country    *string `json:"country,omitempty"`
	Province   *string `json:"province,omitempty"`
	Area       *string `json:"area,omitempty"`
	PostalCode *string `json:"postalCode,omitempty"`

	Contact     *string `json:"contact,omitempty"`
	Description *string `json:"description,omitempty"`

	WifiName     *string  `json:"wifiName,omitempty"`
	WifiPassword *string  `json:"wifiPassword,omitempty"`
	ImageUrl     *string  `json:"imageUrl,omitempty"`
	ImageUrls    []string `json:"imageUrls,omitempty"`

	CheckInInstructions  *string `json:"checkInInstructions,omitempty"`
	Amenities            *string `json:"amenities,omitempty"`
	Guidelines           *string `json:"guidelines,omitempty"`
	CheckOutInstructions *string `json:"checkOutInstructions,omitempty"`

	WheelchairAccess    *bool `json:"wheelchairAccess,omitempty"`
	ParkingAvailability *bool `json:"parkingAvailability,omitempty"`

	PrimaryContact        *string `json:"primaryContact,omitempty"`
	PoliceContact         *string `json:"policeContact,omitempty"`
	DoctorContact         *string `json:"doctorContact,omitempty"`
	AmbulanceContact      *string `json:"ambulanceContact,omitempty"`
	HospitalContact       *string `json:"hospitalContact,omitempty"`
	FireDepartmentContact *string `json:"fireDepartmentContact,omitempty"`
	SnakeCatchersContact  *string `json:"snakeCatchersContact,omitempty"`
	NsriContact           *string `json:"nsriContact,omitempty"`
	VetContact            *string `json:"vetContact,omitempty"`
	CommunityWatchContact *string `json:"communityWatchContact,omitempty"`
	LocalSecurityContact  *string `json:"localSecurityContact,omitempty"`

	Facilities []string `json:"facilities,omitempty"`
	IsActive   *bool    `json:"isActive,omitempty"`
	Units      *int     `json:"units,omitempty"`

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
}

// ---- Delete ----------------------------------------------------------------

type DeleteRequest struct {
	ID int64 `json:"id"`
}

// DeleteAccommodationResponse replaces the previous anonymous *struct{}
// response, which Encore's build rejects — every API response must be a
// named, exported type.
type DeleteAccommodationResponse struct {
	Success bool `json:"success"`
}

// ---- CSV template / export / import ----------------------------------------

type CSVResponse struct {
	CSV string `json:"csv"`
}

// ImportRow mirrors the row shape BulkImportDialog.tsx sends for
// entityType === "accommodation" (numbers already parsed client-side; the
// rest are permissive strings since the CSV parser only trims quotes).
type ImportRow struct {
	Name                  string  `json:"name"`
	Address               string  `json:"address"`
	Latitude              float64 `json:"latitude"`
	Longitude             float64 `json:"longitude"`
	Country               string  `json:"country"`
	Province              string  `json:"province"`
	Area                  string  `json:"area,omitempty"`
	PostalCode            string  `json:"postalCode"`
	WifiName              string  `json:"wifiName,omitempty"`
	WifiPassword          string  `json:"wifiPassword,omitempty"`
	ImageUrl              string  `json:"imageUrl,omitempty"`
	CheckInInstructions   string  `json:"checkInInstructions,omitempty"`
	Amenities             string  `json:"amenities,omitempty"`
	Guidelines            string  `json:"guidelines,omitempty"`
	CheckOutInstructions  string  `json:"checkOutInstructions,omitempty"`
	PrimaryContact        string  `json:"primaryContact,omitempty"`
	PoliceContact         string  `json:"policeContact,omitempty"`
	DoctorContact         string  `json:"doctorContact,omitempty"`
	AmbulanceContact      string  `json:"ambulanceContact,omitempty"`
	HospitalContact       string  `json:"hospitalContact,omitempty"`
	FireDepartmentContact string  `json:"fireDepartmentContact,omitempty"`
	WheelchairAccess      string  `json:"wheelchairAccess,omitempty"`
	ParkingAvailability   string  `json:"parkingAvailability,omitempty"`
	IsActive              string  `json:"isActive,omitempty"`
}

type ImportRequest struct {
	Rows []ImportRow `json:"rows"`
}

type ImportResponse struct {
	Success bool     `json:"success"`
	Imported int     `json:"imported"`
	Failed   int      `json:"failed"`
	Errors   []string `json:"errors"`
}
