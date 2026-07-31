// AttractionStore replaces the in-memory appdb.DB.Attractions map — same
// fix Restaurant and Service already got.
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

var ErrAttractionNotFound = errors.New("attraction not found")

type AttractionStore struct{}

func NewAttractionStore() *AttractionStore {
	return &AttractionStore{}
}

const attractionColumns = `
	id, attraction_id, name, address, latitude, longitude, country, province,
	COALESCE(area, '') as area, postal_code,
	COALESCE(contact_number, '') as contact_number,
	COALESCE(description, '') as description,
	COALESCE(profile_reference_code, '') as profile_reference_code,
	is_duplicate,
	COALESCE(duplicate_reason, '') as duplicate_reason,
	attraction_type,
	little_explorer_approved,
	payment_card, payment_cash, payment_mobile, payment_gaap, payment_snapscan, payment_yoco, payment_zapper,
	wheelchair_access, parking_availability,
	COALESCE(discount_offered, '') as discount_offered,
	COALESCE(discount_code, '') as discount_code,
	COALESCE(safety_info, '') as safety_info,
	COALESCE(age_restrictions, '') as age_restrictions,
	COALESCE(fitness_level, '') as fitness_level,
	COALESCE(best_time_of_day, '') as best_time_of_day,
	COALESCE(what_to_bring, '') as what_to_bring,
	COALESCE(socials_website, '') as socials_website,
	COALESCE(socials_facebook, '') as socials_facebook,
	COALESCE(socials_instagram, '') as socials_instagram,
	COALESCE(socials_tiktok, '') as socials_tiktok,
	COALESCE(socials_twitter, '') as socials_twitter,
	COALESCE(image_url, '') as image_url,
	image_urls,
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
	created_at, updated_at
`

type attractionScanner interface {
	Scan(dest ...interface{}) error
}

func scanAttraction(row attractionScanner) (*appdb.AttractionData, error) {
	var a appdb.AttractionData
	err := row.Scan(
		&a.ID, &a.AttractionID, &a.Name, &a.Address, &a.Latitude, &a.Longitude, &a.Country, &a.Province, &a.Area, &a.PostalCode,
		&a.ContactNumber, &a.Description,
		&a.ProfileReferenceCode, &a.IsDuplicate, &a.DuplicateReason,
		pq.Array(&a.AttractionType),
		&a.LittleExplorerApproved,
		&a.PaymentCard, &a.PaymentCash, &a.PaymentMobile, &a.PaymentGaap, &a.PaymentSnapScan, &a.PaymentYoco, &a.PaymentZapper,
		&a.WheelchairAccess, &a.ParkingAvailability,
		&a.DiscountOffered, &a.DiscountCode,
		&a.SafetyInfo, &a.AgeRestrictions, &a.FitnessLevel, &a.BestTimeOfDay, &a.WhatToBring,
		&a.SocialsWebsite, &a.SocialsFacebook, &a.SocialsInstagram, &a.SocialsTiktok, &a.SocialsTwitter,
		&a.ImageUrl, pq.Array(&a.ImageUrls),
		&a.IsActive,
		&a.OfficialHoldingCompany, &a.OfficialContactName, &a.OfficialContactNumber, &a.OfficialEmail, &a.OfficialRepCode,
		&a.OfficialRepName, &a.CompanyRegNumber, &a.CompanyVatNumber,
		&a.GuestType, &a.AccessLevel,
		&a.PartnerCode.Code, &a.PartnerCode.Active,
		&a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *AttractionStore) List(ctx context.Context, sortBy, sortOrder string) ([]appdb.AttractionData, error) {
	order := "created_at"
	if sortBy == "name" {
		order = "name"
	}
	dir := "DESC"
	if sortOrder == "asc" {
		dir = "ASC"
	}
	rows, err := appdb.SQLDB.QueryContext(ctx, "SELECT "+attractionColumns+" FROM attractions ORDER BY "+order+" "+dir)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []appdb.AttractionData{}
	for rows.Next() {
		item, err := scanAttraction(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *item)
	}
	return out, rows.Err()
}

func (s *AttractionStore) ListByMunicipality(ctx context.Context, area string) ([]appdb.AttractionData, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx,
		"SELECT "+attractionColumns+" FROM attractions WHERE is_active = true AND lower(area) = lower($1)", area)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []appdb.AttractionData{}
	for rows.Next() {
		item, err := scanAttraction(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *item)
	}
	return out, rows.Err()
}

func (s *AttractionStore) ListNearby(ctx context.Context) ([]appdb.AttractionData, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx,
		"SELECT "+attractionColumns+" FROM attractions WHERE is_active = true AND latitude IS NOT NULL AND longitude IS NOT NULL")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []appdb.AttractionData{}
	for rows.Next() {
		item, err := scanAttraction(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *item)
	}
	return out, rows.Err()
}

func (s *AttractionStore) Get(ctx context.Context, id int64) (*appdb.AttractionData, error) {
	row := appdb.SQLDB.QueryRowContext(ctx, "SELECT "+attractionColumns+" FROM attractions WHERE id = $1", id)
	item, err := scanAttraction(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrAttractionNotFound
		}
		return nil, err
	}
	return item, nil
}

func (s *AttractionStore) Create(ctx context.Context, in *appdb.AttractionData) (*appdb.AttractionData, error) {
	row := appdb.SQLDB.QueryRowContext(ctx, `
		INSERT INTO attractions (
			name, address, latitude, longitude, country, province, area, postal_code,
			contact_number, description, profile_reference_code,
			attraction_type, little_explorer_approved,
			payment_card, payment_cash, payment_mobile, payment_gaap, payment_snapscan, payment_yoco, payment_zapper,
			wheelchair_access, parking_availability,
			discount_offered, discount_code,
			safety_info, age_restrictions, fitness_level, best_time_of_day, what_to_bring,
			socials_website, socials_facebook, socials_instagram, socials_tiktok, socials_twitter,
			image_url, image_urls, is_active,
			official_holding_company, official_contact_name, official_contact_number, official_email, official_rep_code,
			official_rep_name, company_reg_number, company_vat_number,
			guest_type, access_level, partner_code, partner_code_active
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,
			$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49
		)
		RETURNING `+attractionColumns,
		in.Name, in.Address, in.Latitude, in.Longitude, in.Country, in.Province, in.Area, in.PostalCode,
		in.ContactNumber, in.Description, in.ProfileReferenceCode,
		pq.Array(nonNilSlice(in.AttractionType)), in.LittleExplorerApproved,
		in.PaymentCard, in.PaymentCash, in.PaymentMobile, in.PaymentGaap, in.PaymentSnapScan, in.PaymentYoco, in.PaymentZapper,
		in.WheelchairAccess, in.ParkingAvailability,
		in.DiscountOffered, in.DiscountCode,
		in.SafetyInfo, in.AgeRestrictions, in.FitnessLevel, in.BestTimeOfDay, in.WhatToBring,
		in.SocialsWebsite, in.SocialsFacebook, in.SocialsInstagram, in.SocialsTiktok, in.SocialsTwitter,
		in.ImageUrl, pq.Array(nonNilSlice(in.ImageUrls)), in.IsActive,
		in.OfficialHoldingCompany, in.OfficialContactName, in.OfficialContactNumber, in.OfficialEmail, in.OfficialRepCode,
		in.OfficialRepName, in.CompanyRegNumber, in.CompanyVatNumber,
		in.GuestType, in.AccessLevel, in.PartnerCode.Code, in.PartnerCode.Active,
	)
	return scanAttraction(row)
}

type AttractionPatch struct {
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

	AttractionType         []string
	LittleExplorerApproved *bool

	PaymentCard     *bool
	PaymentCash     *bool
	PaymentMobile   *bool
	PaymentGaap     *bool
	PaymentSnapScan *bool
	PaymentYoco     *bool
	PaymentZapper   *bool

	WheelchairAccess    *bool
	ParkingAvailability *bool

	DiscountOffered *string
	DiscountCode    *string

	SafetyInfo      *string
	AgeRestrictions *string
	FitnessLevel    *string
	BestTimeOfDay   *string
	WhatToBring     *string

	SocialsWebsite   *string
	SocialsFacebook  *string
	SocialsInstagram *string
	SocialsTiktok    *string
	SocialsTwitter   *string

	ImageUrl  *string
	ImageUrls []string
	IsActive  *bool

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
}

func (s *AttractionStore) Update(ctx context.Context, id int64, patch AttractionPatch) (*appdb.AttractionData, error) {
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
	if patch.AttractionType != nil {
		sets = append(sets, "attraction_type = "+arg(pq.Array(patch.AttractionType)))
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
	if patch.DiscountOffered != nil {
		sets = append(sets, "discount_offered = "+arg(*patch.DiscountOffered))
	}
	if patch.DiscountCode != nil {
		sets = append(sets, "discount_code = "+arg(*patch.DiscountCode))
	}
	if patch.SafetyInfo != nil {
		sets = append(sets, "safety_info = "+arg(*patch.SafetyInfo))
	}
	if patch.AgeRestrictions != nil {
		sets = append(sets, "age_restrictions = "+arg(*patch.AgeRestrictions))
	}
	if patch.FitnessLevel != nil {
		sets = append(sets, "fitness_level = "+arg(*patch.FitnessLevel))
	}
	if patch.BestTimeOfDay != nil {
		sets = append(sets, "best_time_of_day = "+arg(*patch.BestTimeOfDay))
	}
	if patch.WhatToBring != nil {
		sets = append(sets, "what_to_bring = "+arg(*patch.WhatToBring))
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

	if len(sets) == 0 {
		return s.Get(ctx, id)
	}

	sets = append(sets, "updated_at = now()")
	query := "UPDATE attractions SET " + strings.Join(sets, ", ") + " WHERE id = " + arg(id) + " RETURNING " + attractionColumns
	row := appdb.SQLDB.QueryRowContext(ctx, query, args...)
	item, err := scanAttraction(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrAttractionNotFound
		}
		return nil, err
	}
	return item, nil
}

func (s *AttractionStore) Delete(ctx context.Context, id int64) error {
	res, err := appdb.SQLDB.ExecContext(ctx, "DELETE FROM attractions WHERE id = $1", id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrAttractionNotFound
	}
	return nil
}

func (s *AttractionStore) GetPartnerCode(ctx context.Context, id int64) (code string, active bool, err error) {
	err = appdb.SQLDB.QueryRowContext(ctx,
		"SELECT COALESCE(partner_code, ''), partner_code_active FROM attractions WHERE id = $1", id,
	).Scan(&code, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, ErrAttractionNotFound
	}
	return code, active, err
}

func (s *AttractionStore) RegeneratePartnerCode(ctx context.Context, id int64, newCode string) (code string, active bool, err error) {
	err = appdb.SQLDB.QueryRowContext(ctx, `
		UPDATE attractions SET partner_code = $1, partner_code_active = true, updated_at = now()
		WHERE id = $2
		RETURNING partner_code, partner_code_active`,
		newCode, id,
	).Scan(&code, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, ErrAttractionNotFound
	}
	return code, active, err
}

func (s *AttractionStore) TogglePartnerCode(ctx context.Context, id int64, active bool) error {
	res, err := appdb.SQLDB.ExecContext(ctx,
		"UPDATE attractions SET partner_code_active = $1, updated_at = now() WHERE id = $2", active, id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrAttractionNotFound
	}
	return nil
}
