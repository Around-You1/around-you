package store

// SQL-backed stores for the Real Estate & Rentals subsystem: agencies, agents,
// and property listings. Kept entirely separate from the services store.

import (
	"context"
	"database/sql"
	"errors"

	"github.com/lib/pq"

	"backend_encore/internal/appdb"
)

var (
	ErrEstateAgencyNotFound   = errors.New("estate agency not found")
	ErrEstateAgentNotFound    = errors.New("estate agent not found")
	ErrEstatePropertyNotFound = errors.New("estate property not found")
)

type scannable interface {
	Scan(dest ...interface{}) error
}

// ---------- Estate Agencies ----------

type EstateAgencyStore struct{}

func NewEstateAgencyStore() *EstateAgencyStore { return &EstateAgencyStore{} }

const agencyCols = `
	id, name, description, address, province, country, postal_code, contact_number, email,
	latitude, longitude, image_url, image_urls, create_agent_pages,
	COALESCE(profile_reference_code, ''),
	official_holding_company, official_contact_name, official_contact_number, official_email,
	official_rep_code, official_rep_name, company_reg_number, company_vat_number,
	is_active, is_duplicate, duplicate_reason`

func scanAgency(s scannable) (*appdb.EstateAgency, error) {
	var a appdb.EstateAgency
	var lat, lng sql.NullFloat64
	if err := s.Scan(
		&a.ID, &a.Name, &a.Description, &a.Address, &a.Province, &a.Country, &a.PostalCode, &a.ContactNumber, &a.Email,
		&lat, &lng, &a.ImageURL, pq.Array(&a.ImageURLs), &a.CreateAgentPages,
		&a.ProfileReferenceCode,
		&a.OfficialHoldingCompany, &a.OfficialContactName, &a.OfficialContactNumber, &a.OfficialEmail,
		&a.OfficialRepCode, &a.OfficialRepName, &a.CompanyRegNumber, &a.CompanyVatNumber,
		&a.IsActive, &a.IsDuplicate, &a.DuplicateReason,
	); err != nil {
		return nil, err
	}
	if lat.Valid {
		v := lat.Float64
		a.Latitude = &v
	}
	if lng.Valid {
		v := lng.Float64
		a.Longitude = &v
	}
	return &a, nil
}

func (s *EstateAgencyStore) Create(ctx context.Context, in *appdb.EstateAgency) (*appdb.EstateAgency, error) {
	code := appdb.RandomCode(12)
	var id int64
	err := appdb.SQLDB.QueryRowContext(ctx, `
		INSERT INTO estate_agencies
		  (name, description, address, province, country, postal_code, contact_number, email,
		   latitude, longitude, image_url, image_urls, create_agent_pages, profile_reference_code,
		   official_holding_company, official_contact_name, official_contact_number, official_email,
		   official_rep_code, official_rep_name, company_reg_number, company_vat_number, is_active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
		RETURNING id`,
		in.Name, in.Description, in.Address, in.Province, in.Country, in.PostalCode, in.ContactNumber, in.Email,
		in.Latitude, in.Longitude, in.ImageURL, pq.Array(nonNilSlice(in.ImageURLs)), in.CreateAgentPages, code,
		in.OfficialHoldingCompany, in.OfficialContactName, in.OfficialContactNumber, in.OfficialEmail,
		in.OfficialRepCode, in.OfficialRepName, in.CompanyRegNumber, in.CompanyVatNumber, in.IsActive,
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

func (s *EstateAgencyStore) Get(ctx context.Context, id int64) (*appdb.EstateAgency, error) {
	a, err := scanAgency(appdb.SQLDB.QueryRowContext(ctx, "SELECT "+agencyCols+" FROM estate_agencies WHERE id = $1", id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrEstateAgencyNotFound
	}
	return a, err
}

func (s *EstateAgencyStore) GetByCode(ctx context.Context, code string) (*appdb.EstateAgency, error) {
	a, err := scanAgency(appdb.SQLDB.QueryRowContext(ctx, "SELECT "+agencyCols+" FROM estate_agencies WHERE profile_reference_code = $1 AND is_active = true", code))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrEstateAgencyNotFound
	}
	return a, err
}

func (s *EstateAgencyStore) List(ctx context.Context, activeOnly bool) ([]appdb.EstateAgency, error) {
	q := "SELECT " + agencyCols + " FROM estate_agencies"
	if activeOnly {
		q += " WHERE is_active = true"
	}
	q += " ORDER BY name ASC"
	rows, err := appdb.SQLDB.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []appdb.EstateAgency{}
	for rows.Next() {
		a, err := scanAgency(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

func (s *EstateAgencyStore) Update(ctx context.Context, id int64, in *appdb.EstateAgency) (*appdb.EstateAgency, error) {
	res, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE estate_agencies SET
		  name=$2, description=$3, address=$4, province=$5, country=$6, postal_code=$7, contact_number=$8, email=$9,
		  latitude=$10, longitude=$11, image_url=$12, image_urls=$13, create_agent_pages=$14,
		  official_holding_company=$15, official_contact_name=$16, official_contact_number=$17, official_email=$18,
		  official_rep_code=$19, official_rep_name=$20, company_reg_number=$21, company_vat_number=$22,
		  is_active=$23, updated_at=now()
		WHERE id=$1`,
		id, in.Name, in.Description, in.Address, in.Province, in.Country, in.PostalCode, in.ContactNumber, in.Email,
		in.Latitude, in.Longitude, in.ImageURL, pq.Array(nonNilSlice(in.ImageURLs)), in.CreateAgentPages,
		in.OfficialHoldingCompany, in.OfficialContactName, in.OfficialContactNumber, in.OfficialEmail,
		in.OfficialRepCode, in.OfficialRepName, in.CompanyRegNumber, in.CompanyVatNumber, in.IsActive,
	)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrEstateAgencyNotFound
	}
	return s.Get(ctx, id)
}

func (s *EstateAgencyStore) SetActive(ctx context.Context, id int64, active bool) error {
	_, err := appdb.SQLDB.ExecContext(ctx, "UPDATE estate_agencies SET is_active=$2, updated_at=now() WHERE id=$1", id, active)
	return err
}

func (s *EstateAgencyStore) Delete(ctx context.Context, id int64) error {
	res, err := appdb.SQLDB.ExecContext(ctx, "DELETE FROM estate_agencies WHERE id = $1", id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrEstateAgencyNotFound
	}
	return nil
}

func (s *EstateAgencyStore) GetEditCode(ctx context.Context, id int64) (string, error) {
	var code string
	err := appdb.SQLDB.QueryRowContext(ctx, "SELECT COALESCE(edit_code, '') FROM estate_agencies WHERE id = $1", id).Scan(&code)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrEstateAgencyNotFound
	}
	return code, err
}

func (s *EstateAgencyStore) RegenerateEditCode(ctx context.Context, id int64, newCode string) (string, error) {
	var code string
	err := appdb.SQLDB.QueryRowContext(ctx,
		"UPDATE estate_agencies SET edit_code = $1, updated_at = now() WHERE id = $2 RETURNING edit_code", newCode, id,
	).Scan(&code)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrEstateAgencyNotFound
	}
	return code, err
}

// ---------- Estate Agents ----------

type EstateAgentStore struct{}

func NewEstateAgentStore() *EstateAgentStore { return &EstateAgentStore{} }

const agentCols = `
	id, agency_id, name, photo_url, contact_number, email, bio,
	COALESCE(profile_reference_code, ''), is_active,
	official_holding_company, official_contact_name, official_contact_number, official_email,
	official_rep_code, official_rep_name, company_reg_number, company_vat_number`

func scanAgent(s scannable) (*appdb.EstateAgent, error) {
	var a appdb.EstateAgent
	if err := s.Scan(
		&a.ID, &a.AgencyID, &a.Name, &a.PhotoURL, &a.ContactNumber, &a.Email, &a.Bio,
		&a.ProfileReferenceCode, &a.IsActive,
		&a.OfficialHoldingCompany, &a.OfficialContactName, &a.OfficialContactNumber, &a.OfficialEmail,
		&a.OfficialRepCode, &a.OfficialRepName, &a.CompanyRegNumber, &a.CompanyVatNumber,
	); err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *EstateAgentStore) Create(ctx context.Context, in *appdb.EstateAgent) (*appdb.EstateAgent, error) {
	code := appdb.RandomCode(12)
	var id int64
	err := appdb.SQLDB.QueryRowContext(ctx, `
		INSERT INTO estate_agents
		  (agency_id, name, photo_url, contact_number, email, bio, profile_reference_code,
		   official_holding_company, official_contact_name, official_contact_number, official_email,
		   official_rep_code, official_rep_name, company_reg_number, company_vat_number, is_active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		RETURNING id`,
		in.AgencyID, in.Name, in.PhotoURL, in.ContactNumber, in.Email, in.Bio, code,
		in.OfficialHoldingCompany, in.OfficialContactName, in.OfficialContactNumber, in.OfficialEmail,
		in.OfficialRepCode, in.OfficialRepName, in.CompanyRegNumber, in.CompanyVatNumber, in.IsActive,
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

func (s *EstateAgentStore) Get(ctx context.Context, id int64) (*appdb.EstateAgent, error) {
	a, err := scanAgent(appdb.SQLDB.QueryRowContext(ctx, "SELECT "+agentCols+" FROM estate_agents WHERE id = $1", id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrEstateAgentNotFound
	}
	return a, err
}

func (s *EstateAgentStore) GetByCode(ctx context.Context, code string) (*appdb.EstateAgent, error) {
	a, err := scanAgent(appdb.SQLDB.QueryRowContext(ctx, "SELECT "+agentCols+" FROM estate_agents WHERE profile_reference_code = $1 AND is_active = true", code))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrEstateAgentNotFound
	}
	return a, err
}

func (s *EstateAgentStore) ListByAgency(ctx context.Context, agencyID int64, activeOnly bool) ([]appdb.EstateAgent, error) {
	q := "SELECT " + agentCols + " FROM estate_agents WHERE agency_id = $1"
	if activeOnly {
		q += " AND is_active = true"
	}
	q += " ORDER BY name ASC"
	rows, err := appdb.SQLDB.QueryContext(ctx, q, agencyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []appdb.EstateAgent{}
	for rows.Next() {
		a, err := scanAgent(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

func (s *EstateAgentStore) Update(ctx context.Context, id int64, in *appdb.EstateAgent) (*appdb.EstateAgent, error) {
	res, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE estate_agents SET
		  name=$2, photo_url=$3, contact_number=$4, email=$5, bio=$6,
		  official_holding_company=$7, official_contact_name=$8, official_contact_number=$9, official_email=$10,
		  official_rep_code=$11, official_rep_name=$12, company_reg_number=$13, company_vat_number=$14,
		  is_active=$15, updated_at=now()
		WHERE id=$1`,
		id, in.Name, in.PhotoURL, in.ContactNumber, in.Email, in.Bio,
		in.OfficialHoldingCompany, in.OfficialContactName, in.OfficialContactNumber, in.OfficialEmail,
		in.OfficialRepCode, in.OfficialRepName, in.CompanyRegNumber, in.CompanyVatNumber, in.IsActive,
	)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrEstateAgentNotFound
	}
	return s.Get(ctx, id)
}

func (s *EstateAgentStore) SetActive(ctx context.Context, id int64, active bool) error {
	_, err := appdb.SQLDB.ExecContext(ctx, "UPDATE estate_agents SET is_active=$2, updated_at=now() WHERE id=$1", id, active)
	return err
}

func (s *EstateAgentStore) Delete(ctx context.Context, id int64) error {
	res, err := appdb.SQLDB.ExecContext(ctx, "DELETE FROM estate_agents WHERE id = $1", id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrEstateAgentNotFound
	}
	return nil
}

func (s *EstateAgentStore) GetEditCode(ctx context.Context, id int64) (string, error) {
	var code string
	err := appdb.SQLDB.QueryRowContext(ctx, "SELECT COALESCE(edit_code, '') FROM estate_agents WHERE id = $1", id).Scan(&code)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrEstateAgentNotFound
	}
	return code, err
}

func (s *EstateAgentStore) RegenerateEditCode(ctx context.Context, id int64, newCode string) (string, error) {
	var code string
	err := appdb.SQLDB.QueryRowContext(ctx,
		"UPDATE estate_agents SET edit_code = $1, updated_at = now() WHERE id = $2 RETURNING edit_code", newCode, id,
	).Scan(&code)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrEstateAgentNotFound
	}
	return code, err
}

// ---------- Estate Properties ----------

type EstatePropertyStore struct{}

func NewEstatePropertyStore() *EstatePropertyStore { return &EstatePropertyStore{} }

const propertyCols = `
	id, agency_id, agent_id, title, property_type,
	COALESCE(plot_size_m2, 0), COALESCE(house_size_m2, 0),
	COALESCE(bedrooms, 0), COALESCE(bathrooms, 0), COALESCE(garages, 0),
	features, price_cents, listing_type,
	address, province, country, postal_code, latitude, longitude, description,
	image_url, image_urls, is_active`

func scanProperty(s scannable) (*appdb.EstateProperty, error) {
	var p appdb.EstateProperty
	var agentID sql.NullInt64
	var lat, lng sql.NullFloat64
	if err := s.Scan(
		&p.ID, &p.AgencyID, &agentID, &p.Title, &p.PropertyType,
		&p.PlotSizeM2, &p.HouseSizeM2, &p.Bedrooms, &p.Bathrooms, &p.Garages,
		pq.Array(&p.Features), &p.PriceCents, &p.ListingType,
		&p.Address, &p.Province, &p.Country, &p.PostalCode, &lat, &lng, &p.Description,
		&p.ImageURL, pq.Array(&p.ImageURLs), &p.IsActive,
	); err != nil {
		return nil, err
	}
	if agentID.Valid {
		v := agentID.Int64
		p.AgentID = &v
	}
	if lat.Valid {
		v := lat.Float64
		p.Latitude = &v
	}
	if lng.Valid {
		v := lng.Float64
		p.Longitude = &v
	}
	return &p, nil
}

func (s *EstatePropertyStore) Create(ctx context.Context, in *appdb.EstateProperty) (*appdb.EstateProperty, error) {
	var id int64
	err := appdb.SQLDB.QueryRowContext(ctx, `
		INSERT INTO estate_properties
		  (agency_id, agent_id, title, property_type, plot_size_m2, house_size_m2, bedrooms, bathrooms, garages,
		   features, price_cents, listing_type, address, province, country, postal_code, latitude, longitude,
		   description, image_url, image_urls, is_active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
		RETURNING id`,
		in.AgencyID, in.AgentID, in.Title, in.PropertyType, in.PlotSizeM2, in.HouseSizeM2, in.Bedrooms, in.Bathrooms, in.Garages,
		pq.Array(nonNilSlice(in.Features)), in.PriceCents, normListing(in.ListingType), in.Address, in.Province, in.Country, in.PostalCode,
		in.Latitude, in.Longitude, in.Description, in.ImageURL, pq.Array(nonNilSlice(in.ImageURLs)), in.IsActive,
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

func (s *EstatePropertyStore) Get(ctx context.Context, id int64) (*appdb.EstateProperty, error) {
	p, err := scanProperty(appdb.SQLDB.QueryRowContext(ctx, "SELECT "+propertyCols+" FROM estate_properties WHERE id = $1", id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrEstatePropertyNotFound
	}
	return p, err
}

func (s *EstatePropertyStore) ListByAgency(ctx context.Context, agencyID int64, activeOnly bool) ([]appdb.EstateProperty, error) {
	return s.listWhere(ctx, "agency_id = $1", agencyID, activeOnly)
}

func (s *EstatePropertyStore) ListByAgent(ctx context.Context, agentID int64, activeOnly bool) ([]appdb.EstateProperty, error) {
	return s.listWhere(ctx, "agent_id = $1", agentID, activeOnly)
}

func (s *EstatePropertyStore) listWhere(ctx context.Context, where string, arg interface{}, activeOnly bool) ([]appdb.EstateProperty, error) {
	q := "SELECT " + propertyCols + " FROM estate_properties WHERE " + where
	if activeOnly {
		q += " AND is_active = true"
	}
	q += " ORDER BY created_at DESC"
	rows, err := appdb.SQLDB.QueryContext(ctx, q, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []appdb.EstateProperty{}
	for rows.Next() {
		p, err := scanProperty(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}

func (s *EstatePropertyStore) Update(ctx context.Context, id int64, in *appdb.EstateProperty) (*appdb.EstateProperty, error) {
	res, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE estate_properties SET
		  agent_id=$2, title=$3, property_type=$4, plot_size_m2=$5, house_size_m2=$6, bedrooms=$7, bathrooms=$8, garages=$9,
		  features=$10, price_cents=$11, listing_type=$12, address=$13, province=$14, country=$15, postal_code=$16,
		  latitude=$17, longitude=$18, description=$19, image_url=$20, image_urls=$21, is_active=$22, updated_at=now()
		WHERE id=$1`,
		id, in.AgentID, in.Title, in.PropertyType, in.PlotSizeM2, in.HouseSizeM2, in.Bedrooms, in.Bathrooms, in.Garages,
		pq.Array(nonNilSlice(in.Features)), in.PriceCents, normListing(in.ListingType), in.Address, in.Province, in.Country, in.PostalCode,
		in.Latitude, in.Longitude, in.Description, in.ImageURL, pq.Array(nonNilSlice(in.ImageURLs)), in.IsActive,
	)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrEstatePropertyNotFound
	}
	return s.Get(ctx, id)
}

func (s *EstatePropertyStore) SetActive(ctx context.Context, id int64, active bool) error {
	_, err := appdb.SQLDB.ExecContext(ctx, "UPDATE estate_properties SET is_active=$2, updated_at=now() WHERE id=$1", id, active)
	return err
}

func (s *EstatePropertyStore) Delete(ctx context.Context, id int64) error {
	res, err := appdb.SQLDB.ExecContext(ctx, "DELETE FROM estate_properties WHERE id = $1", id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrEstatePropertyNotFound
	}
	return nil
}

func normListing(v string) string {
	if v == "rent" {
		return "rent"
	}
	return "sale"
}
