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
	// Bill only what the billing engine itself counts as billable — the same set
	// behind MRR and the Admin Billing "Expected revenue" forecast: active, paid,
	// a real (non-test) rep, not a free NPO/charity listing, and activated for
	// billing. This stops rep-less public listings (e.g. landmark attractions with
	// no rep) from ever being invoiced, which previously overstated the run.
	subs, err := List(ctx)
	if err != nil {
		return 0, err
	}
	// Recurring invoices are SENT on the 28th of every month, each carrying the
	// NEXT calendar month as its period. next_bill_date is the invoice date and is
	// always the 1st of the covered month; the send window opens on the 28th of the
	// month before, so a 1 Dec invoice goes out on 28 Nov and a 1 Jan invoice on
	// 28 Dec.
	today := time.Now().UTC().Format("2006-01-02")

	issued := 0
	for _, s := range subs {
		if !s.Billable || s.NextBillDate == "" {
			continue
		}
		start, perr := time.Parse("2006-01-02", s.NextBillDate)
		if perr != nil {
			log.Printf("billing run: bad next_bill_date %q for sub %d: %v", s.NextBillDate, s.ID, perr)
			continue
		}
		// Open the send window on the 28th of the month BEFORE the invoice date.
		sendDate := time.Date(start.Year(), start.Month(), 28, 0, 0, 0, 0, time.UTC).AddDate(0, -1, 0)
		if today < sendDate.Format("2006-01-02") {
			continue // not yet the 28th of the preceding month
		}
		end := start.AddDate(0, 1, 0)
		// Due date is 2 days after the invoice date (invoice 1st -> due 3rd).
		dueDate := start.AddDate(0, 0, 2)

		base := s.MonthlyCents
		covers := 0
		if s.Plan == "booking" {
			// The per-booking charge for the month just ended, billed in arrears
			// as its own invoice line on top of the R300 base: restaurants = R10
			// per cover (party_size × R10), services/attractions = 10% of item
			// value. Both are stored on each booking's `commission` field.
			bc, berr := bookingCommissionCents(ctx, s.PartnerType, s.PartnerID, start.AddDate(0, -1, 0), start)
			if berr != nil {
				log.Printf("billing run: booking total for sub %d failed: %v", s.ID, berr)
			}
			covers = bc
		}

		if err := GenerateInvoice(ctx, s.ID, s.PartnerType, s.PartnerID, s.Plan, s.Tier, base, covers, start, end, dueDate, false, false); err != nil {
			log.Printf("billing run: invoice for sub %d failed: %v", s.ID, err)
			continue
		}
		if _, err := appdb.SQLDB.ExecContext(ctx,
			`UPDATE partner_subscription SET next_bill_date = next_bill_date + interval '1 month', updated_at = now() WHERE id = $1`,
			s.ID,
		); err != nil {
			log.Printf("billing run: advancing next_bill_date for sub %d failed: %v", s.ID, err)
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
