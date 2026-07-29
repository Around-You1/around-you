// Package store holds SQL-backed data-access types, kept separate from the
// Encore API handlers in app/*/*.go. Store is accommodation's — as each of
// restaurant/service/attraction migrates off the in-memory appdb.DB map the
// same way, its own store (e.g. RestaurantStore) belongs here too.
package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/lib/pq"

	"backend_encore/internal/appdb"
)

// ErrNotFound is returned by Get/Update/Delete when no row matches the given
// id. Handlers translate this into an Encore errs.NotFound.
var ErrNotFound = errors.New("accommodation not found")

// Store provides SQL-backed CRUD for accommodations. It replaces the
// previous in-memory map implementation one-for-one — same shape of
// operations (List/Get/Create/Update/Delete), just backed by appdb.SQLDB
// instead of a mutex-guarded map now.
type Store struct{}

// NewStore constructs an accommodation Store. Takes no arguments today (the
// SQL implementation reads appdb.SQLDB directly) but a constructor is kept
// so call sites don't need to change if a database handle ever needs to be
// injected instead — e.g. for tests against a separate database.
func NewStore() *Store {
	return &Store{}
}

// accommodationColumns lists every column in one fixed order, shared by every
// SELECT below, so scanAccommodation always matches whatever query ran.
const accommodationColumns = `
	id, name, address, latitude, longitude, country, province,
	COALESCE(area, '') as area, postal_code,
	COALESCE(contact, '') as contact,
	COALESCE(description, '') as description,
	COALESCE(profile_reference_code, '') as profile_reference_code,
	is_duplicate,
	COALESCE(duplicate_reason, '') as duplicate_reason,
	wheelchair_access, parking_availability, facilities,
	COALESCE(wifi_name, '') as wifi_name,
	COALESCE(wifi_password, '') as wifi_password,
	COALESCE(wifi_credentials, '') as wifi_credentials,
	COALESCE(check_in_instructions, '') as check_in_instructions,
	COALESCE(check_out_instructions, '') as check_out_instructions,
	COALESCE(amenities, '') as amenities,
	COALESCE(guidelines, '') as guidelines,
	COALESCE(primary_contact, '') as primary_contact,
	COALESCE(police_contact, '') as police_contact,
	COALESCE(doctor_contact, '') as doctor_contact,
	COALESCE(ambulance_contact, '') as ambulance_contact,
	COALESCE(hospital_contact, '') as hospital_contact,
	COALESCE(fire_department_contact, '') as fire_department_contact,
	emergency_contacts,
	COALESCE(image_url, '') as image_url,
	image_urls, is_active,
	COALESCE(official_holding_company, '') as official_holding_company,
	COALESCE(official_contact_name, '') as official_contact_name,
	COALESCE(official_contact_number, '') as official_contact_number,
	COALESCE(official_email, '') as official_email,
	COALESCE(official_rep_code, '') as official_rep_code,
	created_at, updated_at
`

// scanner is satisfied by both *sql.Row (QueryRow) and *sql.Rows (Query),
// so Get/List can share one scan function.
type scanner interface {
	Scan(dest ...interface{}) error
}

func scanAccommodation(row scanner) (*appdb.Accommodation, error) {
	var a appdb.Accommodation
	var emergencyContactsJSON []byte

	err := row.Scan(
		&a.ID, &a.Name, &a.Address, &a.Latitude, &a.Longitude, &a.Country, &a.Province, &a.Area, &a.PostalCode,
		&a.Contact, &a.Description,
		&a.ProfileReferenceCode, &a.IsDuplicate, &a.DuplicateReason, &a.WheelchairAccess,
		&a.ParkingAvailability, pq.Array(&a.Facilities), &a.WifiName, &a.WifiPassword, &a.WifiCredentials,
		&a.CheckInInstructions, &a.CheckOutInstructions, &a.Amenities, &a.Guidelines,
		&a.PrimaryContact, &a.PoliceContact, &a.DoctorContact, &a.AmbulanceContact,
		&a.HospitalContact, &a.FireDepartmentContact, &emergencyContactsJSON, &a.ImageUrl,
		pq.Array(&a.ImageUrls), &a.IsActive, &a.OfficialHoldingCompany, &a.OfficialContactName,
		&a.OfficialContactNumber, &a.OfficialEmail, &a.OfficialRepCode, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if len(emergencyContactsJSON) > 0 {
		if err := json.Unmarshal(emergencyContactsJSON, &a.EmergencyContacts); err != nil {
			return nil, err
		}
	}

	return &a, nil
}

// nonNilSlice avoids passing a nil []string to pq.Array, which some driver
// paths render as NULL instead of '{}' for a NOT NULL text[] column.
func nonNilSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

// sortColumn whitelists the caller's sort request before it's
// string-concatenated into an ORDER BY clause — never interpolate a raw
// caller-supplied string directly, even after type validation upstream.
func sortColumn(sortBy, sortOrder string) string {
	col := "created_at"
	if sortBy == "name" {
		col = "name"
	}
	dir := "DESC"
	if sortOrder == "asc" {
		dir = "ASC"
	}
	return col + " " + dir
}

// List returns every accommodation, ordered per sortBy/sortOrder ("name" or
// default created_at; "asc" or default desc).
func (s *Store) List(ctx context.Context, sortBy, sortOrder string) ([]appdb.Accommodation, error) {
	query := "SELECT" + accommodationColumns + "FROM accommodations ORDER BY " + sortColumn(sortBy, sortOrder)

	rows, err := appdb.SQLDB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]appdb.Accommodation, 0)
	for rows.Next() {
		a, err := scanAccommodation(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// Get returns the accommodation with the given id, or ErrNotFound.
func (s *Store) Get(ctx context.Context, id int64) (*appdb.Accommodation, error) {
	row := appdb.SQLDB.QueryRowContext(ctx, "SELECT"+accommodationColumns+"FROM accommodations WHERE id = $1", id)
	a, err := scanAccommodation(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return a, nil
}

// Create inserts a new accommodation. Callers should leave ID,
// ProfileReferenceCode, CreatedAt, and UpdatedAt zero-valued on in — the
// store assigns all four (ID and the timestamps via the DB itself,
// ProfileReferenceCode via appdb.RandomCode) and returns the persisted row.
func (s *Store) Create(ctx context.Context, in *appdb.Accommodation) (*appdb.Accommodation, error) {
	profileReferenceCode := appdb.RandomCode(8)

	row := appdb.SQLDB.QueryRowContext(ctx, `
		INSERT INTO accommodations (
			name, address, latitude, longitude, country, province, area, postal_code,
			contact, description,
			profile_reference_code, wheelchair_access, parking_availability, facilities,
			wifi_name, wifi_password, check_in_instructions, check_out_instructions,
			amenities, guidelines, primary_contact, police_contact, doctor_contact,
			ambulance_contact, hospital_contact, fire_department_contact, image_url,
			image_urls, is_active, official_holding_company, official_contact_name,
			official_contact_number, official_email, official_rep_code
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
			$19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34
		)
		RETURNING`+accommodationColumns,
		in.Name, in.Address, in.Latitude, in.Longitude, in.Country, in.Province, in.Area, in.PostalCode,
		in.Contact, in.Description,
		profileReferenceCode, in.WheelchairAccess, in.ParkingAvailability, pq.Array(nonNilSlice(in.Facilities)),
		in.WifiName, in.WifiPassword, in.CheckInInstructions, in.CheckOutInstructions,
		in.Amenities, in.Guidelines, in.PrimaryContact, in.PoliceContact, in.DoctorContact,
		in.AmbulanceContact, in.HospitalContact, in.FireDepartmentContact, in.ImageUrl,
		pq.Array(nonNilSlice(in.ImageUrls)), in.IsActive, in.OfficialHoldingCompany, in.OfficialContactName,
		in.OfficialContactNumber, in.OfficialEmail, in.OfficialRepCode,
	)

	return scanAccommodation(row)
}

// Patch carries only the fields an Update call wants to change — a nil field
// means "leave as-is". Mirrors the same optional-pointer pattern the
// accommodation package's UpdateRequest already uses at the API layer;
// living here instead of importing that type avoids a store <-> accommodation
// import cycle.
type Patch struct {
	Name    *string
	Address *string

	Latitude  *float64
	Longitude *float64

	Country    *string
	Province   *string
	Area       *string
	PostalCode *string

	Contact     *string
	Description *string

	WifiName     *string
	WifiPassword *string
	ImageUrl     *string
	ImageUrls    []string // non-nil (even empty) means "replace"

	CheckInInstructions  *string
	Amenities            *string
	Guidelines           *string
	CheckOutInstructions *string

	WheelchairAccess    *bool
	ParkingAvailability *bool

	PrimaryContact        *string
	PoliceContact         *string
	DoctorContact         *string
	AmbulanceContact      *string
	HospitalContact       *string
	FireDepartmentContact *string

	Facilities []string // non-nil (even empty) means "replace"
	IsActive   *bool

	OfficialHoldingCompany *string
	OfficialContactName    *string
	OfficialContactNumber  *string
	OfficialEmail          *string
	OfficialRepCode        *string
}

// Update applies patch to the accommodation with the given id and returns
// the row as it stands after the update, or ErrNotFound.
func (s *Store) Update(ctx context.Context, id int64, patch Patch) (*appdb.Accommodation, error) {
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
	if patch.Contact != nil {
		sets = append(sets, "contact = "+arg(*patch.Contact))
	}
	if patch.Description != nil {
		sets = append(sets, "description = "+arg(*patch.Description))
	}
	if patch.WifiName != nil {
		sets = append(sets, "wifi_name = "+arg(*patch.WifiName))
	}
	if patch.WifiPassword != nil {
		sets = append(sets, "wifi_password = "+arg(*patch.WifiPassword))
	}
	if patch.ImageUrl != nil {
		sets = append(sets, "image_url = "+arg(*patch.ImageUrl))
	}
	if patch.ImageUrls != nil {
		sets = append(sets, "image_urls = "+arg(pq.Array(patch.ImageUrls)))
	}
	if patch.CheckInInstructions != nil {
		sets = append(sets, "check_in_instructions = "+arg(*patch.CheckInInstructions))
	}
	if patch.Amenities != nil {
		sets = append(sets, "amenities = "+arg(*patch.Amenities))
	}
	if patch.Guidelines != nil {
		sets = append(sets, "guidelines = "+arg(*patch.Guidelines))
	}
	if patch.CheckOutInstructions != nil {
		sets = append(sets, "check_out_instructions = "+arg(*patch.CheckOutInstructions))
	}
	if patch.WheelchairAccess != nil {
		sets = append(sets, "wheelchair_access = "+arg(*patch.WheelchairAccess))
	}
	if patch.ParkingAvailability != nil {
		sets = append(sets, "parking_availability = "+arg(*patch.ParkingAvailability))
	}
	if patch.PrimaryContact != nil {
		sets = append(sets, "primary_contact = "+arg(*patch.PrimaryContact))
	}
	if patch.PoliceContact != nil {
		sets = append(sets, "police_contact = "+arg(*patch.PoliceContact))
	}
	if patch.DoctorContact != nil {
		sets = append(sets, "doctor_contact = "+arg(*patch.DoctorContact))
	}
	if patch.AmbulanceContact != nil {
		sets = append(sets, "ambulance_contact = "+arg(*patch.AmbulanceContact))
	}
	if patch.HospitalContact != nil {
		sets = append(sets, "hospital_contact = "+arg(*patch.HospitalContact))
	}
	if patch.FireDepartmentContact != nil {
		sets = append(sets, "fire_department_contact = "+arg(*patch.FireDepartmentContact))
	}
	if patch.Facilities != nil {
		sets = append(sets, "facilities = "+arg(pq.Array(patch.Facilities)))
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

	sets = append(sets, "updated_at = now()")

	query := "UPDATE accommodations SET " + strings.Join(sets, ", ") + " WHERE id = " + arg(id) + " RETURNING" + accommodationColumns

	row := appdb.SQLDB.QueryRowContext(ctx, query, args...)
	a, err := scanAccommodation(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return a, nil
}

// Delete removes the accommodation with the given id, or returns ErrNotFound
// if no row matched.
func (s *Store) Delete(ctx context.Context, id int64) error {
	res, err := appdb.SQLDB.ExecContext(ctx, "DELETE FROM accommodations WHERE id = $1", id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

