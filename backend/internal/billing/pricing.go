// Package billing holds the pricing rules and subscription/commission logic
// for the rep commissions & billing feature (see REP_BILLING_COMMISSIONS_SPEC.md).
//
// All money is integer ZAR cents to avoid floating-point rounding.
package billing

// Monthly prices in ZAR cents.
const (
	Tier1Cents   = 0     // Tier 1 — Free
	Tier2Cents   = 10000 // R100
	Tier3Cents   = 20000 // R200
	Tier4Cents   = 30000 // R300
	BothCents    = 45000 // R450 — audience "Both" forces Tier 4 at this price
	BookingBase  = 20000 // R200/month base for Booking partners (+10% of bookings added per billing period)
	RealEstateCents = 30000 // R300 — flat per real-estate page (agency or agent), no tiers
)

// Plan is the computed billing arrangement for a partner.
type Plan struct {
	Plan         string // "tier" | "booking"
	Tier         int    // 1..4; 0 for booking
	Audience     string // "Guest Only" | "Local" | "Both" | "" (accommodation)
	MonthlyCents int    // fixed monthly amount; booking's variable 10% is added per period at billing time
}

// PriceFor derives a partner's billing plan from its stored tier/audience.
//   partnerType: "accommodation" | "restaurant" | "service" | "attraction"
//   accessLevel: "Tier 1".."Tier 4" or "Booking" (empty for accommodation)
//   guestType:   "Guest Only" | "Local" | "Both" (empty for accommodation)
//
// Rules (confirmed): accommodations are Tier 4 only; audience "Both" forces
// Tier 4 at R450; the Booking plan is R200 + 10%/booking (the 10% is applied
// per period during billing, not here). Unknown/blank tier defaults to Tier 1
// (Free) — deliberately the safe direction (never over-charge on bad data).
func PriceFor(partnerType, accessLevel, guestType string) Plan {
	// Real estate pages (agency + each agent) are a flat R300/month, no tiers.
	if partnerType == "estate_agency" || partnerType == "estate_agent" {
		return Plan{Plan: "realestate", MonthlyCents: RealEstateCents}
	}
	if partnerType == "accommodation" {
		return Plan{Plan: "tier", Tier: 4, MonthlyCents: Tier4Cents}
	}
	if accessLevel == "Booking" {
		return Plan{Plan: "booking", Tier: 0, Audience: guestType, MonthlyCents: BookingBase}
	}
	if guestType == "Both" {
		return Plan{Plan: "tier", Tier: 4, Audience: "Both", MonthlyCents: BothCents}
	}
	tier := tierNumber(accessLevel)
	return Plan{Plan: "tier", Tier: tier, Audience: guestType, MonthlyCents: tierCents(tier)}
}

func tierNumber(accessLevel string) int {
	switch accessLevel {
	case "Tier 2":
		return 2
	case "Tier 3":
		return 3
	case "Tier 4":
		return 4
	default: // "Tier 1", "", or anything unexpected
		return 1
	}
}

func tierCents(tier int) int {
	switch tier {
	case 2:
		return Tier2Cents
	case 3:
		return Tier3Cents
	case 4:
		return Tier4Cents
	default:
		return Tier1Cents
	}
}
