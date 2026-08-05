// BookingStore persists customer bookings (see app/booking).
package store

import (
	"context"
	"errors"

	"backend_encore/internal/appdb"
)

var ErrBookingNotFound = errors.New("booking not found")

type BookingStore struct{}

func NewBookingStore() *BookingStore { return &BookingStore{} }

const bookingColumns = `
	id, entity_type, entity_id,
	COALESCE(entity_name, '') as entity_name,
	COALESCE(customer_name, '') as customer_name,
	COALESCE(customer_email, '') as customer_email,
	COALESCE(customer_phone, '') as customer_phone,
	COALESCE(booking_date, '') as booking_date,
	COALESCE(booking_time, '') as booking_time,
	COALESCE(items, '[]'::jsonb) as items,
	total, commission, status,
	created_at, updated_at
`

type bookingScanner interface {
	Scan(dest ...interface{}) error
}

func scanBooking(row bookingScanner) (*appdb.Booking, error) {
	var b appdb.Booking
	err := row.Scan(
		&b.ID, &b.EntityType, &b.EntityID,
		&b.EntityName, &b.CustomerName, &b.CustomerEmail, &b.CustomerPhone,
		&b.BookingDate, &b.BookingTime,
		&b.Items,
		&b.Total, &b.Commission, &b.Status,
		&b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (s *BookingStore) Create(ctx context.Context, in *appdb.Booking) (*appdb.Booking, error) {
	row := appdb.SQLDB.QueryRowContext(ctx, `
		INSERT INTO bookings (
			entity_type, entity_id, entity_name,
			customer_name, customer_email, customer_phone,
			booking_date, booking_time, items, total, commission, status
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
		)
		RETURNING `+bookingColumns,
		in.EntityType, in.EntityID, in.EntityName,
		in.CustomerName, in.CustomerEmail, in.CustomerPhone,
		in.BookingDate, in.BookingTime, in.Items, in.Total, in.Commission, in.Status,
	)
	return scanBooking(row)
}

func (s *BookingStore) ListByEmail(ctx context.Context, email string) ([]appdb.Booking, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx,
		"SELECT "+bookingColumns+" FROM bookings WHERE lower(customer_email) = lower($1) ORDER BY created_at DESC", email)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []appdb.Booking{}
	for rows.Next() {
		b, err := scanBooking(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *b)
	}
	return out, rows.Err()
}

// ListForPartner returns every booking for one partner (entity), newest first.
// Used by the partner's own read-only bookings view.
func (s *BookingStore) ListForPartner(ctx context.Context, entityType string, entityID int64) ([]appdb.Booking, error) {
	rows, err := appdb.SQLDB.QueryContext(ctx,
		"SELECT "+bookingColumns+" FROM bookings WHERE entity_type = $1 AND entity_id = $2 ORDER BY booking_date DESC, created_at DESC",
		entityType, entityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []appdb.Booking{}
	for rows.Next() {
		b, err := scanBooking(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *b)
	}
	return out, rows.Err()
}

// UpdateDateTime changes only the date/time of a booking, and only if the
// supplied email matches and the booking isn't cancelled — so only the client
// can reschedule their own booking, never the partner. Items/total stay put.
func (s *BookingStore) UpdateDateTime(ctx context.Context, id int64, email, date, time string) error {
	res, err := appdb.SQLDB.ExecContext(ctx,
		"UPDATE bookings SET booking_date = $3, booking_time = $4, updated_at = now() WHERE id = $1 AND lower(customer_email) = lower($2) AND status <> 'cancelled'",
		id, email, date, time)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrBookingNotFound
	}
	return nil
}

// Cancel marks a booking cancelled, but only if the supplied email matches —
// so only the client can cancel their own bookings, never the partner.
func (s *BookingStore) Cancel(ctx context.Context, id int64, email string) error {
	res, err := appdb.SQLDB.ExecContext(ctx,
		"UPDATE bookings SET status = 'cancelled', updated_at = now() WHERE id = $1 AND lower(customer_email) = lower($2) AND status <> 'cancelled'",
		id, email)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrBookingNotFound
	}
	return nil
}
