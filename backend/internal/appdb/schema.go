// Package appdb holds the shared data models and storage for the Around You
// backend. Persistence here is an in-memory map guarded by a mutex — there is
// no real database wiring yet (the original migrations.go was an empty
// placeholder and no schema/DB instance existed). This keeps every service
// compiling and testable end-to-end; swapping in real Postgres via
// encore.dev/storage/sqldb is the natural next step and shouldn't require
// changing any handler signatures, since all DB access is behind the Store
// methods below.
package appdb

import (
	"sync"
	"time"
)

// EmergencyContact is a repeatable (role, name, number) triple used by
// Accommodation. Confirmed shape from AccommodationList.tsx's
// accommodation.emergencyContacts.map((ec) => ec.role / ec.name / ec.number).
type EmergencyContact struct {
	Role   string `json:"role"`
	Name   string `json:"name"`
	Number string `json:"number"`
}

// OfficialUse fields are shared across all four partner entity types
// (mirrors OfficialUseSection.tsx's OfficialUseData).
type OfficialUse struct {
	OfficialHoldingCompany string `json:"officialHoldingCompany,omitempty"`
	OfficialContactName    string `json:"officialContactName,omitempty"`
	OfficialContactNumber  string `json:"officialContactNumber,omitempty"`
	OfficialEmail          string `json:"officialEmail,omitempty"`
	OfficialRepCode        string `json:"officialRepCode,omitempty"`
	GuestType              string `json:"guestType,omitempty"`
	AccessLevel            string `json:"accessLevel,omitempty"`
}

// PaymentMethods are shared across Restaurant, ServiceData, and AttractionData.
type PaymentMethods struct {
	PaymentCard     bool `json:"paymentCard"`
	PaymentCash     bool `json:"paymentCash"`
	PaymentMobile   bool `json:"paymentMobile"` // labeled "Mobile Tap" in the UI
	PaymentGaap     bool `json:"paymentGaap"`
	PaymentSnapScan bool `json:"paymentSnapScan"`
	PaymentYoco     bool `json:"paymentYoco"`
	PaymentZapper   bool `json:"paymentZapper"`
}

// Socials is shared by Restaurant, Service, and Attraction — each entity's
// own social media links, distinct from ProfileSettings' platform-wide
// versions (BookingsSocialsDropdowns.tsx).
type Socials struct {
	SocialsWebsite   string `json:"socialsWebsite,omitempty"`
	SocialsFacebook  string `json:"socialsFacebook,omitempty"`
	SocialsInstagram string `json:"socialsInstagram,omitempty"`
	SocialsTiktok    string `json:"socialsTiktok,omitempty"`
	SocialsTwitter   string `json:"socialsTwitter,omitempty"`
}

// ExperienceInfo is shared by Service and Attraction — practical details a
// guest would want before visiting. Restaurant doesn't use this (it has its
// own Bookings fields instead).
type ExperienceInfo struct {
	SafetyInfo      string `json:"safetyInfo,omitempty"`
	AgeRestrictions string `json:"ageRestrictions,omitempty"`
	FitnessLevel    string `json:"fitnessLevel,omitempty"`
	BestTimeOfDay   string `json:"bestTimeOfDay,omitempty"`
	WhatToBring     string `json:"whatToBring,omitempty"`
}

// Accommodation matches the field set read/written across
// AccommodationForm.tsx, AccommodationList.tsx, and AccommodationTab.tsx.
type Accommodation struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Address string `json:"address"`

	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`

	Country    string `json:"country"`
	Province   string `json:"province"`
	Area       string `json:"area,omitempty"`
	PostalCode string `json:"postalCode"`

	Contact     string `json:"contact,omitempty"`
	Description string `json:"description,omitempty"`

	ProfileReferenceCode string `json:"profileReferenceCode,omitempty"`
	IsDuplicate          bool   `json:"isDuplicate,omitempty"`
	DuplicateReason      string `json:"duplicateReason,omitempty"`

	WheelchairAccess    bool     `json:"wheelchairAccess"`
	ParkingAvailability bool     `json:"parkingAvailability"`
	Facilities          []string `json:"facilities"`

	WifiName        string `json:"wifiName,omitempty"`
	WifiPassword    string `json:"wifiPassword,omitempty"`
	WifiCredentials string `json:"wifiCredentials,omitempty"`

	CheckInInstructions  string `json:"checkInInstructions,omitempty"`
	CheckOutInstructions string `json:"checkOutInstructions,omitempty"`
	Amenities            string `json:"amenities,omitempty"`
	Guidelines           string `json:"guidelines,omitempty"`

	PrimaryContact        string `json:"primaryContact,omitempty"`
	PoliceContact         string `json:"policeContact,omitempty"`
	DoctorContact         string `json:"doctorContact,omitempty"`
	AmbulanceContact      string `json:"ambulanceContact,omitempty"`
	HospitalContact       string `json:"hospitalContact,omitempty"`
	FireDepartmentContact string `json:"fireDepartmentContact,omitempty"`

	EmergencyContacts []EmergencyContact `json:"emergencyContacts,omitempty"`

	ImageUrl  string   `json:"imageUrl,omitempty"`
	ImageUrls []string `json:"imageUrls,omitempty"`

	IsActive bool `json:"isActive"`

	OfficialUse

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// PartnerCode holds the regeneratable partner login code + active flag that
// Restaurant, ServiceData, and AttractionData all expose via getPartnerCode /
// regeneratePartnerCode / togglePartnerCode (see PartnerAccessCodeDisplay.tsx).
// Exported so the restaurant/service/attraction and auth packages can read
// and mutate it directly.
type PartnerCode struct {
	Code   string `json:"partnerCode"`
	Active bool   `json:"codeActive"`
}

// Restaurant matches RestaurantForm.tsx / RestaurantList.tsx / RestaurantTab.tsx.
type Restaurant struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Address string `json:"address"`

	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`

	Country       string `json:"country"`
	Province      string `json:"province"`
	Area          string `json:"area,omitempty"`
	PostalCode    string `json:"postalCode"`
	ContactNumber string `json:"contactNumber,omitempty"`
	Description   string `json:"description,omitempty"`

	ProfileReferenceCode string `json:"profileReferenceCode,omitempty"`
	IsDuplicate          bool   `json:"isDuplicate,omitempty"`
	DuplicateReason      string `json:"duplicateReason,omitempty"`

	CuisineTypes           []string `json:"cuisineTypes"`
	MenuLink               string   `json:"menuLink,omitempty"`
	ServiceDineIn          bool     `json:"serviceDineIn"`
	ServiceTakeaway        bool     `json:"serviceTakeaway"`
	ServiceDelivery        bool     `json:"serviceDelivery"`
	LittleExplorerApproved bool     `json:"littleExplorerApproved"`

	PaymentMethods

	WheelchairAccess    bool `json:"wheelchairAccess"`
	ParkingAvailability bool `json:"parkingAvailability"`

	WifiNetwork     string `json:"wifiNetwork,omitempty"`
	WifiPassword    string `json:"wifiPassword,omitempty"`
	WifiCredentials string `json:"wifiCredentials,omitempty"`

	DiscountOffered string `json:"discountOffered,omitempty"`
	DiscountCode    string `json:"discountCode,omitempty"`

	BookingsEmail         string `json:"bookingsEmail,omitempty"`
	BookingsContactNumber string `json:"bookingsContactNumber,omitempty"`

	Socials

	ImageUrl string `json:"imageUrl,omitempty"`
	IsActive bool   `json:"isActive"`

	OfficialUse

	PartnerCode `json:"-"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ServiceData matches ServiceForm.tsx / ServiceList.tsx / ServiceTab.tsx.
// Note the dual identifier: the frontend uses a string ServiceID for all CRUD
// routes (get/update/delete/toggle) but a numeric ID for getPartnerCode/
// regeneratePartnerCode/togglePartnerCode (see PartnerAccessCodeDisplay.tsx
// and PartnerDashboard.tsx's `services.find(s => s.id === user.entityId)`).
// Both are kept in sync — ServiceID is just the string form of ID.
type ServiceData struct {
	ID        int64  `json:"id"`
	ServiceID string `json:"serviceId"`
	Name      string `json:"name"`
	Address   string `json:"address"`

	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`

	Country       string `json:"country"`
	Province      string `json:"province"`
	Area          string `json:"area,omitempty"`
	PostalCode    string `json:"postalCode"`
	ContactNumber string `json:"contactNumber,omitempty"`
	Description   string `json:"description,omitempty"`

	ProfileReferenceCode string `json:"profileReferenceCode,omitempty"`
	IsDuplicate          bool   `json:"isDuplicate,omitempty"`
	DuplicateReason      string `json:"duplicateReason,omitempty"`

	ServiceCategories      []string `json:"serviceCategories"`
	LittleExplorerApproved bool     `json:"littleExplorerApproved"`

	PaymentMethods

	WheelchairAccess    bool `json:"wheelchairAccess"`
	ParkingAvailability bool `json:"parkingAvailability"`

	DiscountOffered string `json:"discountOffered,omitempty"`
	DiscountCode    string `json:"discountCode,omitempty"`

	ExperienceInfo
	Socials

	ImageUrl string `json:"imageUrl,omitempty"`
	IsActive bool   `json:"isActive"`

	OfficialUse

	PartnerCode `json:"-"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// AttractionData matches AttractionForm.tsx / AttractionList.tsx / AttractionTab.tsx.
// Same dual-identifier note as ServiceData applies to AttractionID.
type AttractionData struct {
	ID           int64  `json:"id"`
	AttractionID string `json:"attractionId"`
	Name         string `json:"name"`
	Address      string `json:"address"`

	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`

	Country       string `json:"country"`
	Province      string `json:"province"`
	Area          string `json:"area,omitempty"`
	PostalCode    string `json:"postalCode"`
	ContactNumber string `json:"contactNumber,omitempty"`
	Description   string `json:"description,omitempty"`

	ProfileReferenceCode string `json:"profileReferenceCode,omitempty"`
	IsDuplicate          bool   `json:"isDuplicate,omitempty"`
	DuplicateReason      string `json:"duplicateReason,omitempty"`

	AttractionType         []string `json:"attractionType"`
	LittleExplorerApproved bool     `json:"littleExplorerApproved"`

	PaymentMethods

	WheelchairAccess    bool `json:"wheelchairAccess"`
	ParkingAvailability bool `json:"parkingAvailability"`

	DiscountOffered string `json:"discountOffered,omitempty"`
	DiscountCode    string `json:"discountCode,omitempty"`

	ExperienceInfo
	Socials

	ImageUrl  string   `json:"imageUrl,omitempty"`
	ImageUrls []string `json:"imageUrls,omitempty"`
	IsActive  bool     `json:"isActive"`

	OfficialUse

	PartnerCode `json:"-"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// User matches the `user` object LoginPage.tsx / AccessCodeResolver.tsx store
// in localStorage and that GuestDashboard.tsx / PartnerDashboard.tsx read back
// (role, profileType, email, accommodationId, area/municipality, entityType,
// entityId).
type User struct {
	ID              int64  `json:"id"`
	Email           string `json:"email"`
	Role            string `json:"role"`                  // "Guest" | "LocalGuest" | "Partner" | "SuperAdmin"
	ProfileType     string `json:"profileType,omitempty"`  // "accommodation" | "restaurant" | "service" | "attraction"
	AccommodationID int64  `json:"accommodationId,omitempty"`
	EntityType      string `json:"entityType,omitempty"` // "restaurant" | "service" | "attraction"
	EntityID        int64  `json:"entityId,omitempty"`
	Area            string `json:"area,omitempty"`
	Municipality    string `json:"municipality,omitempty"`
	PostalCode      string `json:"postalCode,omitempty"` // LocalGuest sign-in field
	FullName        string `json:"fullName,omitempty"`   // Rep sign-in field
	RepCode         string `json:"repCode,omitempty"`    // Rep sign-in field, e.g. "Rep00000001"
	// PasswordHash is a bcrypt hash, SuperAdmin accounts only. json:"-" means
	// this can never be serialized into an API response, even by a future
	// mistake elsewhere in the code — it simply isn't an option.
	PasswordHash string `json:"-"`
}

// ProfileSettings matches BookingsSocialsDropdowns.tsx / RestaurantTab.tsx's
// get/setProfileSettings. It's a single settings record per authenticated
// partner (keyed by the user's entity in the in-memory store below).
type ProfileSettings struct {
	BookingsEmail         string `json:"bookingsEmail,omitempty"`
	BookingsContactNumber string `json:"bookingsContactNumber,omitempty"`
	SocialsWebsite        string `json:"socialsWebsite,omitempty"`
	SocialsInstagram      string `json:"socialsInstagram,omitempty"`
	SocialsTwitter        string `json:"socialsTwitter,omitempty"`
	SocialsYoutube        string `json:"socialsYoutube,omitempty"`
	SocialsTiktok         string `json:"socialsTiktok,omitempty"`
}

// CategoryStats matches AdminDashboard.tsx's accommodationStats/restaurantStats/
// serviceStats/attractionStats shape.
type CategoryStats struct {
	TotalCount    int `json:"totalCount"`
	ActiveCount   int `json:"activeCount"`
	InactiveCount int `json:"inactiveCount"`
}

// Store is a single in-memory, mutex-guarded store shared by every service
// still awaiting its Postgres migration (Phase 5 moves these over one at a
// time — Accommodation, then Users/Sessions, have already moved to
// appdb.SQLDB; restaurant/service/attraction are still here).
type Store struct {
	mu sync.Mutex

	nextID int64

	Restaurants map[int64]*Restaurant
	Services    map[int64]*ServiceData
	Attractions map[int64]*AttractionData

	// ProfileSettings and LogoURL are single, platform-wide records —
	// confirmed by both call sites (RestaurantTab.tsx admin editing and
	// BookingsSocialsDropdowns.tsx partner-facing display) calling
	// getProfileSettings()/setProfileSettings() with no entity ID.
	ProfileSettings ProfileSettings
	LogoURL         string
}

// DB is the process-wide store instance. Encore services import this
// directly rather than each other's packages, since Encore doesn't allow
// services to import one another's internal state.
var DB = &Store{
	nextID:      1,
	Restaurants: map[int64]*Restaurant{},
	Services:    map[int64]*ServiceData{},
	Attractions: map[int64]*AttractionData{},
}

// NextID returns a fresh, process-wide unique ID.
func (s *Store) NextID() int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	id := s.nextID
	s.nextID++
	return id
}

// NextIDLocked is identical to NextID but does NOT lock — callers must
// already hold the store's lock (via Store.Lock()) before calling this.
// Needed because sync.Mutex isn't reentrant: any handler that locks once up
// front (e.g. the bulk ImportX handlers) and then wants a fresh ID per row
// must use this instead of NextID, or it deadlocks on the first row.
func (s *Store) NextIDLocked() int64 {
	id := s.nextID
	s.nextID++
	return id
}

func (s *Store) Lock()   { s.mu.Lock() }
func (s *Store) Unlock() { s.mu.Unlock() }
