// Package billing holds the pricing rules and subscription/commission logic
// for the rep commissions & billing feature (see REP_BILLING_COMMISSIONS_SPEC.md).
//
// All money is integer ZAR cents to avoid floating-point rounding.
package billing

import "fmt"

// Monthly prices in ZAR cents. Two-tier model (Aug 2026): Tier 1 R200,
// Tier 2 R300, audience "Both" R400.
const (
	Tier1Cents   = 20000 // R200 — Tier 1
	Tier2Cents   = 30000 // R300 — Tier 2 (the former top tier)
	BothCents    = 40000 // R400 — audience "Both" (forces Tier 2) at this flat price
	BookingBase  = 20000 // R200/month base for Booking partners (+ per-cover/per-booking charge added per billing period: restaurants R10/cover, services/attractions 10%)
	RealEstateCents = 30000 // R300 — flat per real-estate page (agency or agent), no tiers

	// Accommodation Option-A unit bands (6+ units); 1–5 units use tier pricing.
	AccUnits6to10Cents  = 50000  // R500
	AccUnits11to20Cents = 80000  // R800
	AccUnits21to40Cents = 120000 // R1,200
	// 40+ units = Custom Quote (0 here; billed manually).
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
//   accessLevel: "Tier 1" | "Tier 2" or "Booking" (empty for accommodation)
//   guestType:   "Guest Only" | "Local" | "Both" (empty for accommodation)
//
// Rules: two tiers (Tier 1 R200, Tier 2 R300); audience "Both" forces
// Tier 2 at R400; accommodations sit on Tier 2 (unit pricing for 6+ units);
// the Booking plan is R200/month + a per-booking charge
// (restaurants R10/cover, services/attractions 10%), applied per period during
// billing, not here. Unknown/blank tier defaults to Tier 1
// (Free) — deliberately the safe direction (never over-charge on bad data).
func PriceFor(partnerType, accessLevel, guestType string) Plan {
	return PriceForUnits(partnerType, accessLevel, guestType, 1)
}

// PriceForUnits is PriceFor plus the accommodation unit count (Option A). units
// only affects accommodations; pass 1 for everything else.
func PriceForUnits(partnerType, accessLevel, guestType string, units int) Plan {
	// Real estate pages (agency + each agent) are a flat R300/month, no tiers.
	if partnerType == "estate_agency" || partnerType == "estate_agent" {
		return Plan{Plan: "realestate", MonthlyCents: RealEstateCents}
	}
	if partnerType == "accommodation" {
		if units >= 6 {
			return accommodationUnitBand(units)
		}
		// 1–5 units: accommodations sit on Tier 2, audience-priced.
		if guestType == "Both" {
			return Plan{Plan: "tier", Tier: 2, Audience: "Both", MonthlyCents: BothCents}
		}
		return Plan{Plan: "tier", Tier: 2, Audience: guestType, MonthlyCents: Tier2Cents}
	}
	if accessLevel == "Booking" {
		return Plan{Plan: "booking", Tier: 0, Audience: guestType, MonthlyCents: BookingBase}
	}
	if guestType == "Both" {
		return Plan{Plan: "tier", Tier: 2, Audience: "Both", MonthlyCents: BothCents}
	}
	tier := tierNumber(accessLevel)
	return Plan{Plan: "tier", Tier: tier, Audience: guestType, MonthlyCents: tierCents(tier)}
}

func accommodationUnitBand(units int) Plan {
	switch {
	case units <= 10:
		return Plan{Plan: "units", MonthlyCents: AccUnits6to10Cents}
	case units <= 20:
		return Plan{Plan: "units", MonthlyCents: AccUnits11to20Cents}
	case units <= 40:
		return Plan{Plan: "units", MonthlyCents: AccUnits21to40Cents}
	default:
		return Plan{Plan: "units", MonthlyCents: 0} // 40+ = custom quote, billed manually
	}
}

// InvoiceItem returns the invoice line's item code and description from the
// partner's type, tier, audience and (for accommodation) unit count — e.g.
// ("AccT2G", "Accommodation Tier 2 Guest"), ("Acc6-10", "Accommodation 6–10
// Units"), ("Agency", "Estate Agency").
func InvoiceItem(partnerType string, tier int, audience string, units int) (code, description string) {
	switch partnerType {
	case "estate_agency":
		return "Agency", "Estate Agency"
	case "estate_agent":
		return "Agent", "Estate Agent"
	}
	if partnerType == "accommodation" && units >= 6 {
		switch {
		case units <= 10:
			return "Acc6-10", "Accommodation 6–10 Units"
		case units <= 20:
			return "Acc11-20", "Accommodation 11–20 Units"
		case units <= 40:
			return "Acc21-40", "Accommodation 21–40 Units"
		default:
			return "Acc40+", "Accommodation 40+ Units (Custom Quote)"
		}
	}
	prefix, typeName := "Res", "Restaurant"
	switch partnerType {
	case "accommodation":
		prefix, typeName = "Acc", "Accommodation"
	case "service":
		prefix, typeName = "Ser", "Service"
	case "attraction":
		prefix, typeName = "Att", "Attraction"
	}
	if tier < 1 {
		tier = 1
	}
	audLetter, audWord := "G", "Guest"
	switch audience {
	case "Both":
		audLetter, audWord = "B", "Both"
	case "Local":
		audLetter, audWord = "L", "Local"
	}
	return fmt.Sprintf("%sT%d%s", prefix, tier, audLetter),
		fmt.Sprintf("%s Tier %d %s", typeName, tier, audWord)
}

// BookingItemCodes returns the two invoice line codes/descriptions for a
// Booking-plan partner: the fixed monthly base (…BookM, R200) and the variable
// usage line (…BookC / …Book — restaurant covers at R10 each, service/attraction
// bookings at 10% of the chosen items). Accommodation/estate never use the
// Booking plan, so they fall back to the restaurant labels defensively.
func BookingItemCodes(partnerType string) (monthlyCode, monthlyDesc, usageCode, usageDesc string) {
	switch partnerType {
	case "service":
		return "SerBookM", "Service Booking Monthly", "SerBook", "Service Bookings"
	case "attraction":
		return "AttBookM", "Attraction Booking Monthly", "AttBook", "Attraction Bookings"
	default: // restaurant
		return "ResBookM", "Restaurant Booking Monthly", "ResBookC", "Restaurant Booking Covers"
	}
}

// tierNumber maps a stored accessLevel to the 2-tier model. Legacy values map
// by price: old "Tier 4" (R300) → 2, old "Tier 3" (R200) → 1, so pre-migration
// billing stays correct.
func tierNumber(accessLevel string) int {
	switch accessLevel {
	case "Tier 2", "Tier 4":
		return 2
	default: // "Tier 1", "Tier 3", "", or anything unexpected → Tier 1
		return 1
	}
}

func tierCents(tier int) int {
	if tier >= 2 {
		return Tier2Cents
	}
	return Tier1Cents
}
