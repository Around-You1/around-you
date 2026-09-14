package appdb

import "strings"

// The Test Guesthouse is a DEMO accommodation. A guest who signs in with its
// access code sees ONLY the demo partners below — never real nearby/area
// listings — so demos and screenshots show a clean, predictable set.
//
// Matching is by profile_reference_code, upper-cased. Codes are operator
// controlled (constants here), never user input.
const TestGuesthouseRefCode = "TESTGUEST01"

// demoGuestPartnerCodes is the fixed set of partner reference codes the Test
// Guesthouse guest is limited to.
var demoGuestPartnerCodes = map[string]bool{
	"BPU4DFYTQCRF": true, // Test Restaurant
	"KJDUBPQ3HKWE": true, // Test Service
	"JLBJXZK6ZCCS": true, // Test Attraction
}

// IsDemoAccommodationCode reports whether an accommodation reference code is the
// demo Test Guesthouse.
func IsDemoAccommodationCode(code string) bool {
	return strings.EqualFold(strings.TrimSpace(code), TestGuesthouseRefCode)
}

// DemoGuestAllowsPartner reports whether a partner reference code is one of the
// demo partners the Test Guesthouse guest may see.
func DemoGuestAllowsPartner(refCode string) bool {
	return demoGuestPartnerCodes[strings.ToUpper(strings.TrimSpace(refCode))]
}
