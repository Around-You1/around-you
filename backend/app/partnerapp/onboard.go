package partnerapp

import (
	"context"
	"encoding/json"
	"regexp"
	"strconv"
	"strings"

	"backend_encore/app/accommodation"
	"backend_encore/app/attraction"
	"backend_encore/app/estate"
	"backend_encore/app/restaurant"
	"backend_encore/app/service"
	"backend_encore/internal/appdb"
)

// appRow is the full stored application, loaded when onboarding so we can build
// the partner record from the applicant's answers.
type appRow struct {
	Category      string
	RepCode       string
	BusinessName  string
	ContactName   string
	ContactEmail  string
	ContactNumber string
	Province      string
	Status        string
	Fields        map[string]string
}

func loadApplication(ctx context.Context, id int64) (*appRow, error) {
	var a appRow
	var payload string
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT category, COALESCE(rep_code,''), COALESCE(business_name,''),
		       COALESCE(contact_name,''), COALESCE(contact_email,''), COALESCE(contact_number,''),
		       COALESCE(province,''), COALESCE(payload::text,'{}'), status
		FROM partner_applications WHERE id = $1`, id,
	).Scan(&a.Category, &a.RepCode, &a.BusinessName, &a.ContactName, &a.ContactEmail,
		&a.ContactNumber, &a.Province, &payload, &a.Status)
	if err != nil {
		return nil, err
	}
	a.Fields = map[string]string{}
	_ = json.Unmarshal([]byte(payload), &a.Fields)
	return &a, nil
}

// ---- small mapping helpers --------------------------------------------------

var digitsRe = regexp.MustCompile(`\d+`)

func (a *appRow) f(key string) string { return strings.TrimSpace(a.Fields[key]) }

// splitList turns a comma-joined multi-select back into a slice of options.
func splitList(s string) []string {
	out := []string{}
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func has(hay, needle string) bool {
	return strings.Contains(strings.ToLower(hay), strings.ToLower(needle))
}

func firstDigits(s string) int {
	if m := digitsRe.FindString(s); m != "" {
		if n, err := strconv.Atoi(m); err == nil {
			return n
		}
	}
	return 0
}

// createPartnerFromApplication builds an Inactive partner record from a stored
// application so it appears in the relevant admin list for review + activation.
// Address geocoding and tier are left to the admin edit that follows.
func createPartnerFromApplication(ctx context.Context, a *appRow) error {
	pay := a.f("Payment methods")
	acc := a.f("Accessibility options")
	wheelchair := has(acc, "Wheelchair")
	parking := has(acc, "Parking")
	childFriendly := has(a.f("Child friendly"), "Child")

	switch a.Category {
	case "restaurant":
		_, err := restaurant.Create(ctx, &restaurant.CreateRequest{
			Name:                   a.BusinessName,
			Address:                a.f("Physical address"),
			Country:                "South Africa",
			Province:               a.Province,
			PostalCode:             a.f("Postal code"),
			ContactNumber:          a.ContactNumber,
			Description:            a.f("Description"),
			CuisineTypes:           splitList(a.f("Cuisine type(s)")),
			RestaurantType:         splitList(a.f("Restaurant type")),
			Atmosphere:             splitList(a.f("Atmosphere")),
			Features:               splitList(a.f("Features")),
			MenuLink:               a.f("Menu link"),
			ServiceDineIn:          has(a.f("Service options"), "Dine"),
			ServiceTakeaway:        has(a.f("Service options"), "Takeaway"),
			ServiceDelivery:        has(a.f("Service options"), "Delivery"),
			LittleExplorerApproved: childFriendly,
			WifiNetwork:            a.f("Wi-Fi network name"),
			WifiPassword:           a.f("Wi-Fi password"),
			PaymentCard:            has(pay, "Card"),
			PaymentCash:            has(pay, "Cash"),
			PaymentMobile:          has(pay, "Mobile"),
			PaymentGaap:            has(pay, "Gaap"),
			PaymentSnapScan:        has(pay, "Snap"),
			PaymentYoco:            has(pay, "Yoco"),
			PaymentZapper:          has(pay, "Zapper"),
			WheelchairAccess:       wheelchair,
			ParkingAvailability:    parking,
			DiscountOffered:        a.f("Guest discount — offer"),
			DiscountCode:           a.f("Guest discount code"),
			LocalDiscountOffered:   a.f("Local discount — offer"),
			LocalDiscountCode:      a.f("Local discount code"),
			SocialsWebsite:         a.f("Website"),
			SocialsFacebook:        a.f("Facebook"),
			SocialsInstagram:       a.f("Instagram"),
			SocialsTiktok:          a.f("TikTok"),
			SocialsTwitter:         a.f("X (Twitter)"),
			IsActive:               false,
			OfficialHoldingCompany: a.f("Holding company (if any)"),
			OfficialContactName:    a.ContactName,
			OfficialContactNumber:  a.ContactNumber,
			OfficialEmail:          a.ContactEmail,
			OfficialRepCode:        a.RepCode,
			CompanyRegNumber:       a.f("Company registration number"),
			CompanyVatNumber:       a.f("VAT number (if registered)"),
		})
		return err

	case "service":
		_, err := service.Create(ctx, &service.CreateRequest{
			Name:                   a.BusinessName,
			Address:                a.f("Physical address"),
			Country:                "South Africa",
			Province:               a.Province,
			PostalCode:             a.f("Postal code"),
			ContactNumber:          a.ContactNumber,
			Description:            a.f("Description"),
			ServiceCategories:      splitList(a.f("Service category(ies)")),
			LittleExplorerApproved: childFriendly,
			PaymentCard:            has(pay, "Card"),
			PaymentCash:            has(pay, "Cash"),
			PaymentMobile:          has(pay, "Mobile"),
			PaymentGaap:            has(pay, "Gaap"),
			PaymentSnapScan:        has(pay, "Snap"),
			PaymentYoco:            has(pay, "Yoco"),
			PaymentZapper:          has(pay, "Zapper"),
			WheelchairAccess:       wheelchair,
			ParkingAvailability:    parking,
			DiscountOffered:        a.f("Guest discount — offer"),
			DiscountCode:           a.f("Guest discount code"),
			LocalDiscountOffered:   a.f("Local discount — offer"),
			LocalDiscountCode:      a.f("Local discount code"),
			SafetyInfo:             a.f("Safety information"),
			AgeRestrictions:        a.f("Age restrictions"),
			FitnessLevel:           a.f("Fitness level"),
			BestTimeOfDay:          a.f("Best time of day"),
			WhatToBring:            a.f("What to bring"),
			SocialsWebsite:         a.f("Website"),
			SocialsFacebook:        a.f("Facebook"),
			SocialsInstagram:       a.f("Instagram"),
			SocialsTiktok:          a.f("TikTok"),
			SocialsTwitter:         a.f("X (Twitter)"),
			IsActive:               false,
			OfficialHoldingCompany: a.f("Holding company (if any)"),
			OfficialContactName:    a.ContactName,
			OfficialContactNumber:  a.ContactNumber,
			OfficialEmail:          a.ContactEmail,
			OfficialRepCode:        a.RepCode,
			CompanyRegNumber:       a.f("Company registration number"),
			CompanyVatNumber:       a.f("VAT number (if registered)"),
		})
		return err

	case "attraction":
		_, err := attraction.Create(ctx, &attraction.CreateRequest{
			Name:                   a.BusinessName,
			Address:                a.f("Physical address"),
			Country:                "South Africa",
			Province:               a.Province,
			PostalCode:             a.f("Postal code"),
			ContactNumber:          a.ContactNumber,
			Description:            a.f("Description"),
			AttractionType:         splitList(a.f("Attraction category(ies)")),
			LittleExplorerApproved: childFriendly,
			PaymentCard:            has(pay, "Card"),
			PaymentCash:            has(pay, "Cash"),
			PaymentMobile:          has(pay, "Mobile"),
			PaymentGaap:            has(pay, "Gaap"),
			PaymentSnapScan:        has(pay, "Snap"),
			PaymentYoco:            has(pay, "Yoco"),
			PaymentZapper:          has(pay, "Zapper"),
			WheelchairAccess:       wheelchair,
			ParkingAvailability:    parking,
			DiscountOffered:        a.f("Guest discount — offer"),
			DiscountCode:           a.f("Guest discount code"),
			LocalDiscountOffered:   a.f("Local discount — offer"),
			LocalDiscountCode:      a.f("Local discount code"),
			SafetyInfo:             a.f("Safety information"),
			AgeRestrictions:        a.f("Age restrictions"),
			FitnessLevel:           a.f("Fitness level"),
			BestTimeOfDay:          a.f("Best time of day"),
			WhatToBring:            a.f("What to bring"),
			TrailDifficulty:        a.f("Trail difficulty"),
			WildlifeCautions:       a.f("Wildlife cautions"),
			TideWarnings:           a.f("Tide warnings"),
			ParkingNotes:           a.f("Parking notes"),
			PhotographySpots:       a.f("Photography spots"),
			SocialsWebsite:         a.f("Website"),
			SocialsFacebook:        a.f("Facebook"),
			SocialsInstagram:       a.f("Instagram"),
			SocialsTiktok:          a.f("TikTok"),
			SocialsTwitter:         a.f("X (Twitter)"),
			IsActive:               false,
			OfficialHoldingCompany: a.f("Holding company (if any)"),
			OfficialContactName:    a.ContactName,
			OfficialContactNumber:  a.ContactNumber,
			OfficialEmail:          a.ContactEmail,
			OfficialRepCode:        a.RepCode,
			CompanyRegNumber:       a.f("Company registration number"),
			CompanyVatNumber:       a.f("VAT number (if registered)"),
		})
		return err

	case "accommodation":
		contact := a.f("Contact")
		if contact == "" {
			contact = a.ContactNumber
		}
		_, err := accommodation.Create(ctx, &accommodation.CreateRequest{
			Name:                   a.BusinessName,
			Address:                a.f("Physical address"),
			Country:                "South Africa",
			Province:               a.Province,
			PostalCode:             a.f("Postal code"),
			Contact:                contact,
			Description:            a.f("Description"),
			WifiName:               a.f("Wi-Fi network name"),
			WifiPassword:           a.f("Wi-Fi password"),
			CheckInInstructions:    a.f("Check-in instructions"),
			CheckOutInstructions:   a.f("Check-out instructions"),
			Amenities:              a.f("Amenities"),
			Guidelines:             a.f("House guidelines"),
			WheelchairAccess:       wheelchair,
			ParkingAvailability:    parking,
			PrimaryContact:         a.ContactNumber,
			PoliceContact:          a.f("Police"),
			AmbulanceContact:       a.f("Ambulance"),
			FireDepartmentContact:  a.f("Fire department"),
			HospitalContact:        a.f("Nearest hospital — number"),
			HospitalAddress:        a.f("Nearest hospital — address"),
			DoctorContact:          a.f("Doctor — name / number / address"),
			VetContact:             a.f("Vet — name / number / address"),
			NsriContact:            a.f("Sea Rescue / NSRI"),
			SnakeCatchersContact:   a.f("Snake catcher"),
			CommunityWatchContact:  a.f("Community watch"),
			LocalSecurityContact:   a.f("Local security"),
			Facilities:             splitList(a.f("Facilities")),
			Units:                  firstDigits(a.f("Number of units / rooms")),
			IsActive:               false,
			OfficialHoldingCompany: a.f("Holding company (if any)"),
			OfficialContactName:    a.ContactName,
			OfficialContactNumber:  a.ContactNumber,
			OfficialEmail:          a.ContactEmail,
			OfficialRepCode:        a.RepCode,
			CompanyRegNumber:       a.f("Company registration number"),
			CompanyVatNumber:       a.f("VAT number (if registered)"),
		})
		return err

	case "estate":
		_, err := estate.CreateAgency(ctx, &appdb.EstateAgency{
			Name:                   a.BusinessName,
			Description:            a.f("Agency description"),
			Address:                a.f("Physical address"),
			Province:               a.Province,
			Country:                "South Africa",
			PostalCode:             a.f("Postal code"),
			ContactNumber:          a.ContactNumber,
			Email:                  a.ContactEmail,
			IsActive:               false,
			OfficialHoldingCompany: a.f("Holding company (if any)"),
			OfficialContactName:    a.ContactName,
			OfficialContactNumber:  a.ContactNumber,
			OfficialEmail:          a.ContactEmail,
			OfficialRepCode:        a.RepCode,
			CompanyRegNumber:       a.f("Company registration number"),
			CompanyVatNumber:       a.f("VAT number (if registered)"),
		})
		return err
	}
	return nil
}
