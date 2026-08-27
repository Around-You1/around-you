// RestaurantStore replaces the in-memory appdb.DB.Restaurants map — the fix
// for the exact data-loss bug Accommodation already had fixed: in-memory
// storage means every server restart (which Fly does automatically to save
// cost when idle) silently wipes every restaurant a rep has onboarded.
package store

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"

	"github.com/lib/pq"

	"backend_encore/internal/appdb"
)

var ErrRestaurantNotFound = errors.New("restaurant not found")

type RestaurantStore struct{}

func NewRestaurantStore() *RestaurantStore {
	return &RestaurantStore{}
}

// restaurantColumns lists every column in one fixed order, shared by every
// SELECT below — every nullable text column is COALESCE'd to '' from the
// very first version of this file, learning from the mistake Accommodation's
// store made (which needed a whole separate follow-up migration after a
// production crash to add the same protection retroactively).
const restaurantColumns = `
	id, name, address, latitude, longitude, country, province,
	COALESCE(area, '') as area, postal_code,
	COALESCE(contact_number, '') as contact_number,
	COALESCE(description, '') as description,
	COALESCE(profile_reference_code, '') as profile_reference_code,
	is_duplicate,
	COALESCE(duplicate_reason, '') as duplicate_reason,
	cuisine_types,
	restaurant_type,
	COALESCE(atmosphere, '{}') as atmosphere,
	COALESCE(features, '{}') as features,
	COALESCE(menu_link, '') as menu_link,
	service_dine_in, service_takeaway, service_delivery, little_explorer_approved,
	payment_card, payment_cash, payment_mobile,
	payment_gaap, payment_snapscan, payment_yoco, payment_zapper,
	wheelchair_access, parking_availability,
	COALESCE(wifi_network, '') as wifi_network,
	COALESCE(wifi_password, '') as wifi_password,
	COALESCE(wifi_credentials, '') as wifi_credentials,
	COALESCE(discount_offered, '') as discount_offered,
	COALESCE(discount_code, '') as discount_code,
	COALESCE(local_discount_offered, '') as local_discount_offered,
	COALESCE(local_discount_code, '') as local_discount_code,
	COALESCE(bookings_email, '') as bookings_email,
	COALESCE(bookings_contact_number, '') as bookings_contact_number,
	COALESCE(socials_website, '') as socials_website,
	COALESCE(socials_facebook, '') as socials_facebook,
	COALESCE(socials_instagram, '') as socials_instagram,
	COALESCE(socials_tiktok, '') as socials_tiktok,
	COALESCE(socials_twitter, '') as socials_twitter,
	COALESCE(image_url, '') as image_url,
	image_urls,
	COALESCE(menu_pdf_urls, '{}') as menu_pdf_urls,
	is_active,
	COALESCE(official_holding_company, '') as official_holding_company,
	COALESCE(official_contact_name, '') as official_contact_name,
	COALESCE(official_contact_number, '') as official_contact_number,
	COALESCE(official_email, '') as official_email,
	COALESCE(official_rep_code, '') as official_rep_code,
	COALESCE(official_rep_name, '') as official_rep_name,
	COALESCE(company_reg_number, '') as company_reg_number,
	COALESCE(company_vat_number, '') as company_vat_number,
	COALESCE(guest_type, '') as guest_type,
	COALESCE(access_level, '') as access_level,
	COALESCE(partner_code, '') as partner_code,
	partner_code_active,
		COALESCE(booking_items, '[]'::jsonb) as booking_items,
	created_at, updated_at
`

type restaurantScanner interface {
	Scan(dest ...interface{}) error
}

func scanRestaurant(row restaurantScanner) (*appdb.Restaurant, error) {
	var r appdb.Restaurant
	err := row.Scan(
		&r.ID, &r.Name, &r.Address, &r.Latitude, &r.Longitude, &r.Country, &r.Province, &r.Area, &r.PostalCode,
		&r.ContactNumber, &r.Description,
		&r.ProfileReferenceCode, &r.IsDuplicate, &r.DuplicateReason,
		pq.Array(&r.CuisineTypes),
		pq.Array(&r.RestaurantType),
		pq.Array(&r.Atmosphere),
		pq.Array(&r.Features),
		&r.MenuLink, &r.ServiceDineIn, &r.ServiceTakeaway, &r.ServiceDelivery, &r.LittleExplorerApproved,
		&r.PaymentCard, &r.PaymentCash, &r.PaymentMobile,
		&r.PaymentGaap, &r.PaymentSnapScan, &r.PaymentYoco, &r.PaymentZapper,
		&r.WheelchairAccess, &r.ParkingAvailability,
		&r.WifiNetwork, &r.WifiPassword, &r.WifiCredentials,
		&r.DiscountOffered, &r.DiscountCode,
		&r.LocalDiscountOffered, &r.LocalDiscountCode,
		&r.BookingsEmail, &r.BookingsContactNumber,
		&r.SocialsWebsite, &r.SocialsFacebook, &r.SocialsInstagram, &r.SocialsTiktok, &r.SocialsTwitter,
		&r.ImageUrl, pq.Array(&r.ImageUrls), pq.Array(&r.MenuPdfUrls), &r.IsActive,
		&r.OfficialHoldingCompany, &r.OfficialContactName, &r.OfficialContactNumber, &r.OfficialEmail, &r.OfficialRepCode,
		&r.OfficialRepName, &r.CompanyRegNumber, &r.CompanyVatNumber,
		&r.GuestType, &r.AccessLevel,
		&r.PartnerCode.Code, &r.PartnerCode.Active,
		&r.BookingItems,
		&r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *RestaurantStore) List(ctx context.Context, sortBy, sortOrder string) ([]appdb.Restaurant, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx, "SELECT "+restaurantColumns+" FROM restaurants ORDER BY "+sortColumn(sortBy, sortOrder))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []appdb.Restaurant{}
	for rows.Next() {
		r, err := scanRestaurant(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *r)
	}
	return out, rows.Err()
}

func (s *RestaurantStore) ListByMunicipality(ctx context.Context, area string) ([]appdb.Restaurant, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx,
		"SELECT "+restaurantColumns+" FROM restaurants WHERE is_active = true AND lower(area) = lower($1)", area)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []appdb.Restaurant{}
	for rows.Next() {
		r, err := scanRestaurant(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *r)
	}
	return out, rows.Err()
}

// ListNearby returns every active restaurant with coordinates set — distance
// filtering by radius still happens in Go (appdb.HaversineKm), matching how
// this always worked; only the storage moved from a map to SQL.
func (s *RestaurantStore) ListNearby(ctx context.Context) ([]appdb.Restaurant, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx,
		"SELECT "+restaurantColumns+" FROM restaurants WHERE is_active = true AND latitude IS NOT NULL AND longitude IS NOT NULL")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []appdb.Restaurant{}
	for rows.Next() {
		r, err := scanRestaurant(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *r)
	}
	return out, rows.Err()
}

func (s *RestaurantStore) Get(ctx context.Context, id int64) (*appdb.Restaurant, error) {
	row := appdb.SQLDB.QueryRowContext(ctx, "SELECT "+restaurantColumns+" FROM restaurants WHERE id = $1", id)
	r, err := scanRestaurant(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRestaurantNotFound
		}
		return nil, err
	}
	return r, nil
}

func (s *RestaurantStore) Create(ctx context.Context, in *appdb.Restaurant) (*appdb.Restaurant, error) {
	row := appdb.SQLDB.QueryRowContext(ctx, `
		INSERT INTO restaurants (
			name, address, latitude, longitude, country, province, area, postal_code,
			contact_number, description, profile_reference_code,
			cuisine_types, menu_link, service_dine_in, service_takeaway, service_delivery, little_explorer_approved,
			payment_card, payment_cash, payment_mobile, payment_gaap, payment_snapscan, payment_yoco, payment_zapper,
			wheelchair_access, parking_availability,
			wifi_network, wifi_password, wifi_credentials,
			discount_offered, discount_code,
			bookings_email, bookings_contact_number,
			socials_website, socials_facebook, socials_instagram, socials_tiktok, socials_twitter,
			image_url, image_urls, is_active,
			official_holding_company, official_contact_name, official_contact_number, official_email, official_rep_code,
			official_rep_name, company_reg_number, company_vat_number,
			guest_type, access_level, partner_code, partner_code_active, booking_items, restaurant_type,
			atmosphere, features,
			local_discount_offered, local_discount_code
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,
			$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56,$57,
			$58,$59
		)
		RETURNING `+restaurantColumns,
		in.Name, in.Address, in.Latitude, in.Longitude, in.Country, in.Province, in.Area, in.PostalCode,
		in.ContactNumber, in.Description, in.ProfileReferenceCode,
		pq.Array(nonNilSlice(in.CuisineTypes)), in.MenuLink, in.ServiceDineIn, in.ServiceTakeaway, in.ServiceDelivery, in.LittleExplorerApproved,
		in.PaymentCard, in.PaymentCash, in.PaymentMobile, in.PaymentGaap, in.PaymentSnapScan, in.PaymentYoco, in.PaymentZapper,
		in.WheelchairAccess, in.ParkingAvailability,
		in.WifiNetwork, in.WifiPassword, in.WifiCredentials,
		in.DiscountOffered, in.DiscountCode,
		in.BookingsEmail, in.BookingsContactNumber,
		in.SocialsWebsite, in.SocialsFacebook, in.SocialsInstagram, in.SocialsTiktok, in.SocialsTwitter,
		in.ImageUrl, pq.Array(nonNilSlice(in.ImageUrls)), in.IsActive,
		in.OfficialHoldingCompany, in.OfficialContactName, in.OfficialContactNumber, in.OfficialEmail, in.OfficialRepCode,
		in.OfficialRepName, in.CompanyRegNumber, in.CompanyVatNumber,
		in.GuestType, in.AccessLevel, in.PartnerCode.Code, in.PartnerCode.Active,
		in.BookingItems, pq.Array(nonNilSlice(in.RestaurantType)),
		pq.Array(nonNilSlice(in.Atmosphere)), pq.Array(nonNilSlice(in.Features)),
		in.LocalDiscountOffered, in.LocalDiscountCode,
	)
	return scanRestaurant(row)
}

// RestaurantPatch mirrors UpdateRequest's optional fields exactly — nil
// means "don't touch this column", matching how the old in-memory Update
// only overwrote fields the caller actually sent.
type RestaurantPatch struct {
	Name       *string
	Address    *string
	Latitude   *float64
	Longitude  *float64
	Country    *string
	Province   *string
	Area       *string
	PostalCode *string

	ContactNumber *string
	Description   *string

	CuisineTypes           []string
	RestaurantType         []string
	Atmosphere             []string
	Features               []string
	MenuLink               *string
	ServiceDineIn          *bool
	ServiceTakeaway        *bool
	ServiceDelivery        *bool
	LittleExplorerApproved *bool

	PaymentCard   *bool
	PaymentCash   *bool
	PaymentMobile *bool
	PaymentGaap     *bool
	PaymentSnapScan *bool
	PaymentYoco     *bool
	PaymentZapper   *bool

	WheelchairAccess    *bool
	ParkingAvailability *bool

	WifiNetwork  *string
	WifiPassword *string

	DiscountOffered      *string
	DiscountCode         *string
	LocalDiscountOffered *string
	LocalDiscountCode    *string

	BookingsEmail         *string
	BookingsContactNumber *string

	SocialsWebsite   *string
	SocialsFacebook  *string
	SocialsInstagram *string
	SocialsTiktok    *string
	SocialsTwitter   *string

	ImageUrl    *string
	ImageUrls   []string
	MenuPdfUrls []string
	IsActive    *bool

	OfficialHoldingCompany *string
	OfficialContactName    *string
	OfficialContactNumber  *string
	OfficialEmail          *string
	OfficialRepCode        *string
	OfficialRepName        *string
	CompanyRegNumber       *string
	CompanyVatNumber       *string
	GuestType              *string
	AccessLevel            *string
	BookingItems           appdb.BookingItems
}

func (s *RestaurantStore) Update(ctx context.Context, id int64, patch RestaurantPatch) (*appdb.Restaurant, error) {
	sets := []string{}
	args := []interface{}{}
	arg := func(v interface{}) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}

	if patch.Name != nil {
		sets = append(sets, "name = "+arg(*patch.Name))
	}
	if patch.Address != nil {
		sets = append(sets, "address = "+arg(*patch.Address))
	}
	if patch.Latitude != nil {
		sets = append(sets, "latitude = "+arg(*patch.Latitude))
	}
	if patch.Longitude != nil {
		sets = append(sets, "longitude = "+arg(*patch.Longitude))
	}
	if patch.Country != nil {
		sets = append(sets, "country = "+arg(*patch.Country))
	}
	if patch.Province != nil {
		sets = append(sets, "province = "+arg(*patch.Province))
	}
	if patch.Area != nil {
		sets = append(sets, "area = "+arg(*patch.Area))
	}
	if patch.PostalCode != nil {
		sets = append(sets, "postal_code = "+arg(*patch.PostalCode))
	}
	if patch.ContactNumber != nil {
		sets = append(sets, "contact_number = "+arg(*patch.ContactNumber))
	}
	if patch.Description != nil {
		sets = append(sets, "description = "+arg(*patch.Description))
	}
	if patch.CuisineTypes != nil {
		sets = append(sets, "cuisine_types = "+arg(pq.Array(patch.CuisineTypes)))
	}
	if patch.RestaurantType != nil {
		sets = append(sets, "restaurant_type = "+arg(pq.Array(patch.RestaurantType)))
	}
	if patch.Atmosphere != nil {
		sets = append(sets, "atmosphere = "+arg(pq.Array(patch.Atmosphere)))
	}
	if patch.Features != nil {
		sets = append(sets, "features = "+arg(pq.Array(patch.Features)))
	}
	if patch.MenuLink != nil {
		sets = append(sets, "menu_link = "+arg(*patch.MenuLink))
	}
	if patch.ServiceDineIn != nil {
		sets = append(sets, "service_dine_in = "+arg(*patch.ServiceDineIn))
	}
	if patch.ServiceTakeaway != nil {
		sets = append(sets, "service_takeaway = "+arg(*patch.ServiceTakeaway))
	}
	if patch.ServiceDelivery != nil {
		sets = append(sets, "service_delivery = "+arg(*patch.ServiceDelivery))
	}
	if patch.LittleExplorerApproved != nil {
		sets = append(sets, "little_explorer_approved = "+arg(*patch.LittleExplorerApproved))
	}
	if patch.PaymentCard != nil {
		sets = append(sets, "payment_card = "+arg(*patch.PaymentCard))
	}
	if patch.PaymentCash != nil {
		sets = append(sets, "payment_cash = "+arg(*patch.PaymentCash))
	}
	if patch.PaymentMobile != nil {
		sets = append(sets, "payment_mobile = "+arg(*patch.PaymentMobile))
	}
	if patch.PaymentGaap != nil {
		sets = append(sets, "payment_gaap = "+arg(*patch.PaymentGaap))
	}
	if patch.PaymentSnapScan != nil {
		sets = append(sets, "payment_snapscan = "+arg(*patch.PaymentSnapScan))
	}
	if patch.PaymentYoco != nil {
		sets = append(sets, "payment_yoco = "+arg(*patch.PaymentYoco))
	}
	if patch.PaymentZapper != nil {
		sets = append(sets, "payment_zapper = "+arg(*patch.PaymentZapper))
	}
	if patch.WheelchairAccess != nil {
		sets = append(sets, "wheelchair_access = "+arg(*patch.WheelchairAccess))
	}
	if patch.ParkingAvailability != nil {
		sets = append(sets, "parking_availability = "+arg(*patch.ParkingAvailability))
	}
	if patch.WifiNetwork != nil {
		sets = append(sets, "wifi_network = "+arg(*patch.WifiNetwork))
	}
	if patch.WifiPassword != nil {
		sets = append(sets, "wifi_password = "+arg(*patch.WifiPassword))
	}
	if patch.DiscountOffered != nil {
		sets = append(sets, "discount_offered = "+arg(*patch.DiscountOffered))
	}
	if patch.DiscountCode != nil {
		sets = append(sets, "discount_code = "+arg(*patch.DiscountCode))
	}
	if patch.LocalDiscountOffered != nil {
		sets = append(sets, "local_discount_offered = "+arg(*patch.LocalDiscountOffered))
	}
	if patch.LocalDiscountCode != nil {
		sets = append(sets, "local_discount_code = "+arg(*patch.LocalDiscountCode))
	}
	if patch.BookingsEmail != nil {
		sets = append(sets, "bookings_email = "+arg(*patch.BookingsEmail))
	}
	if patch.BookingsContactNumber != nil {
		sets = append(sets, "bookings_contact_number = "+arg(*patch.BookingsContactNumber))
	}
	if patch.SocialsWebsite != nil {
		sets = append(sets, "socials_website = "+arg(*patch.SocialsWebsite))
	}
	if patch.SocialsFacebook != nil {
		sets = append(sets, "socials_facebook = "+arg(*patch.SocialsFacebook))
	}
	if patch.SocialsInstagram != nil {
		sets = append(sets, "socials_instagram = "+arg(*patch.SocialsInstagram))
	}
	if patch.SocialsTiktok != nil {
		sets = append(sets, "socials_tiktok = "+arg(*patch.SocialsTiktok))
	}
	if patch.SocialsTwitter != nil {
		sets = append(sets, "socials_twitter = "+arg(*patch.SocialsTwitter))
	}
	if patch.ImageUrl != nil {
		sets = append(sets, "image_url = "+arg(*patch.ImageUrl))
	}
	if patch.ImageUrls != nil {
		sets = append(sets, "image_urls = "+arg(pq.Array(patch.ImageUrls)))
	}
	if patch.MenuPdfUrls != nil {
		sets = append(sets, "menu_pdf_urls = "+arg(pq.Array(patch.MenuPdfUrls)))
	}
	if patch.IsActive != nil {
		sets = append(sets, "is_active = "+arg(*patch.IsActive))
	}
	if patch.OfficialHoldingCompany != nil {
		sets = append(sets, "official_holding_company = "+arg(*patch.OfficialHoldingCompany))
	}
	if patch.OfficialContactName != nil {
		sets = append(sets, "official_contact_name = "+arg(*patch.OfficialContactName))
	}
	if patch.OfficialContactNumber != nil {
		sets = append(sets, "official_contact_number = "+arg(*patch.OfficialContactNumber))
	}
	if patch.OfficialEmail != nil {
		sets = append(sets, "official_email = "+arg(*patch.OfficialEmail))
	}
	if patch.OfficialRepCode != nil {
		sets = append(sets, "official_rep_code = "+arg(*patch.OfficialRepCode))
	}
	if patch.OfficialRepName != nil {
		sets = append(sets, "official_rep_name = "+arg(*patch.OfficialRepName))
	}
	if patch.CompanyRegNumber != nil {
		sets = append(sets, "company_reg_number = "+arg(*patch.CompanyRegNumber))
	}
	if patch.CompanyVatNumber != nil {
		sets = append(sets, "company_vat_number = "+arg(*patch.CompanyVatNumber))
	}
	if patch.GuestType != nil {
		sets = append(sets, "guest_type = "+arg(*patch.GuestType))
	}
	if patch.AccessLevel != nil {
		sets = append(sets, "access_level = "+arg(*patch.AccessLevel))
	}
	if patch.BookingItems != nil {
		sets = append(sets, "booking_items = "+arg(patch.BookingItems))
	}

	if len(sets) == 0 {
		return s.Get(ctx, id)
	}

	sets = append(sets, "updated_at = now()")
	query := "UPDATE restaurants SET " + strings.Join(sets, ", ") + " WHERE id = " + arg(id) + " RETURNING " + restaurantColumns
	row := appdb.SQLDB.QueryRowContext(ctx, query, args...)
	r, err := scanRestaurant(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRestaurantNotFound
		}
		return nil, err
	}
	return r, nil
}

func (s *RestaurantStore) Delete(ctx context.Context, id int64) error {
	res, err := appdb.SQLDB.ExecContext(ctx, "DELETE FROM restaurants WHERE id = $1", id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrRestaurantNotFound
	}
	return nil
}

// GetPartnerCode/RegeneratePartnerCode/TogglePartnerCode are simple enough
// to not need the full scanRestaurant machinery — a couple of columns each.

// GetEditCode/RegenerateEditCode manage the partner "edit code" (see the
// editcode package). Deliberately separate small queries — the edit_code
// column is intentionally NOT part of scanRestaurant, so it never leaks into
// the entity JSON that guests receive.

func (s *RestaurantStore) GetEditCode(ctx context.Context, id int64) (string, error) {
	var code string
	err := appdb.SQLDB.QueryRowContext(ctx,
		"SELECT COALESCE(edit_code, '') FROM restaurants WHERE id = $1", id,
	).Scan(&code)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrRestaurantNotFound
	}
	return code, err
}

func (s *RestaurantStore) RegenerateEditCode(ctx context.Context, id int64, newCode string) (string, error) {
	var code string
	err := appdb.SQLDB.QueryRowContext(ctx,
		"UPDATE restaurants SET edit_code = $1, updated_at = now() WHERE id = $2 RETURNING edit_code",
		newCode, id,
	).Scan(&code)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrRestaurantNotFound
	}
	return code, err
}

func (s *RestaurantStore) GetPartnerCode(ctx context.Context, id int64) (code string, active bool, err error) {
	err = appdb.SQLDB.QueryRowContext(ctx,
		"SELECT COALESCE(partner_code, ''), partner_code_active FROM restaurants WHERE id = $1", id,
	).Scan(&code, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, ErrRestaurantNotFound
	}
	return code, active, err
}

func (s *RestaurantStore) RegeneratePartnerCode(ctx context.Context, id int64, newCode string) (code string, active bool, err error) {
	err = appdb.SQLDB.QueryRowContext(ctx, `
		UPDATE restaurants SET partner_code = $1, partner_code_active = true, updated_at = now()
		WHERE id = $2
		RETURNING partner_code, partner_code_active`,
		newCode, id,
	).Scan(&code, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, ErrRestaurantNotFound
	}
	return code, active, err
}

func (s *RestaurantStore) TogglePartnerCode(ctx context.Context, id int64, active bool) error {
	res, err := appdb.SQLDB.ExecContext(ctx,
		"UPDATE restaurants SET partner_code_active = $1, updated_at = now() WHERE id = $2", active, id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrRestaurantNotFound
	}
	return nil
}
