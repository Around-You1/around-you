package billing

import (
	"context"
	"log"
	"math"
	"time"

	"backend_encore/internal/appdb"
)

// RunMonthlyBilling issues the next invoice for every Active subscription whose
// next_bill_date has arrived, then advances that date by one month. Idempotent:
// GenerateInvoice skips a period already billed, and each run advances a
// subscription by at most one period (a monthly schedule keeps it in step).
// Returns the number of invoices issued this run.
func RunMonthlyBilling(ctx context.Context) (int, error) {
	type due struct {
		subID, partnerID   int64
		partnerType, plan  string
		tier, monthlyCents int
		nextBill           time.Time
	}

	rows, err := appdb.SQLDB.QueryContext(ctx, `
		SELECT id, partner_type, partner_id, plan, COALESCE(tier, 0), monthly_cents, next_bill_date
		FROM partner_subscription
		WHERE status = 'Active' AND next_bill_date <= (now() at time zone 'utc')::date`)
	if err != nil {
		return 0, err
	}
	var list []due
	for rows.Next() {
		var d due
		if err := rows.Scan(&d.subID, &d.partnerType, &d.partnerID, &d.plan, &d.tier, &d.monthlyCents, &d.nextBill); err != nil {
			rows.Close()
			return 0, err
		}
		list = append(list, d)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	issued := 0
	for _, d := range list {
		start := d.nextBill
		end := start.AddDate(0, 1, 0)
		dueDate := start.AddDate(0, 0, 7)

		subtotal := d.monthlyCents
		if d.plan == "booking" {
			// Add 10% of the bookings taken in the month just ended.
			bc, err := bookingCommissionCents(ctx, d.partnerType, d.partnerID, start.AddDate(0, -1, 0), start)
			if err != nil {
				log.Printf("billing run: booking total for sub %d failed: %v", d.subID, err)
			}
			subtotal += bc
		}

		if err := GenerateInvoice(ctx, d.subID, d.partnerType, d.partnerID, d.plan, d.tier, subtotal, start, end, dueDate, false); err != nil {
			log.Printf("billing run: invoice for sub %d failed: %v", d.subID, err)
			continue
		}
		if _, err := appdb.SQLDB.ExecContext(ctx,
			`UPDATE partner_subscription SET next_bill_date = next_bill_date + interval '1 month', updated_at = now() WHERE id = $1`,
			d.subID,
		); err != nil {
			log.Printf("billing run: advancing next_bill_date for sub %d failed: %v", d.subID, err)
			continue
		}
		issued++
	}
	return issued, nil
}

// bookingCommissionCents sums the 10% platform commission on a partner's
// bookings in [from, to), returned in ZAR cents. Booking amounts are stored as
// float Rands, so we round to the nearest cent.
func bookingCommissionCents(ctx context.Context, entityType string, entityID int64, from, to time.Time) (int, error) {
	var sum float64
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(commission), 0) FROM bookings
		WHERE entity_type = $1 AND entity_id = $2 AND status <> 'cancelled'
		  AND created_at >= $3 AND created_at < $4`,
		entityType, entityID, from, to,
	).Scan(&sum)
	if err != nil {
		return 0, err
	}
	return int(math.Round(sum * 100)), nil
}
