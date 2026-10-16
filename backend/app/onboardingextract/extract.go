// Package onboardingextract reads a hand-filled partner onboarding PDF with
// Claude (reusing the same ANTHROPIC_API_KEY as moderation) and returns the
// fields as JSON so the Rep Onboarding form can pre-fill itself for review.
// Dependency-free (plain net/http). Never auto-creates a partner — a human
// always reviews and saves.
package onboardingextract

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"backend_encore/app/auth"
	"backend_encore/internal/errs"
)

type ExtractFile struct {
	// MediaType is the IANA type: "application/pdf" or an image type
	// ("image/png", "image/jpeg", "image/webp", "image/gif").
	MediaType string `json:"mediaType"`
	// Data is the file's base64 (a leading data:...;base64, prefix is stripped).
	Data string `json:"data"`
}

type ExtractRequest struct {
	// Category is the partner type: "restaurant" (others added later).
	Category string `json:"category"`
	// Files are the uploaded sources: a single hand-filled PDF, or one or more
	// WhatsApp / photo screenshots. Read together as one submission.
	Files []ExtractFile `json:"files"`
	// PDFBase64 is a legacy single-PDF field kept for backward compatibility.
	PDFBase64 string `json:"pdfBase64"`
}

type ExtractResponse struct {
	// Fields is the model's structured JSON, shaped for the onboarding form.
	Fields map[string]interface{} `json:"fields"`
}

func model() string {
	if m := strings.TrimSpace(os.Getenv("ANTHROPIC_EXTRACT_MODEL")); m != "" {
		return m
	}
	return "claude-3-5-sonnet-latest"
}

// restaurantInstruction tells Claude exactly which keys to return so the output
// maps straight onto the Rep Onboarding form's data model.
const restaurantInstruction = `You are reading an "Around You" restaurant/takeaway onboarding submission. The source is EITHER a hand-filled form (possibly several pages, with handwriting and ticked checkboxes) OR a set of WhatsApp / phone screenshots of a chat in which the owner sent their details. Read everything provided together as one submission.

Extract the information into a SINGLE JSON object and reply with ONLY that JSON (no prose, no code fences). Use this exact shape; leave a string "" or an array [] when the form does not clearly show a value — never guess:

{
  "data": {
    "name": "", "address": "", "postalCode": "", "contactNumber": "",
    "description": "", "tradingHours": "", "publicHolidays": "",
    "cuisineTypes": [], "restaurantType": [], "atmosphere": [], "features": [],
    "dietary": [], "chefRecommendation": "", "menuLink": "",
    "paymentOptions": [], "accessibility": [], "childFriendly": [],
    "wifiName": "", "wifiPassword": "",
    "discountOffered": "", "discountCode": "",
    "localDiscountOffered": "", "localDiscountCode": "",
    "holdingCompany": "", "businessEmail": "",
    "personResponsible": "", "personResponsibleNumber": "",
    "companyRegNumber": "", "companyVatNumber": "",
    "socialLinks": { "Website": "", "Facebook": "", "Instagram": "", "Tiktok": "", "X": "" }
  },
  "province": "",
  "country": "",
  "serviceOptions": []
}

Constrained values — use ONLY these exact strings where they apply (match spelling exactly; omit anything not clearly marked):
- restaurantType (choose the single best fit): "Food Truck","Home Meals","Take Away","Delivery","Pop Up","Restaurant"
- cuisineTypes: "African","A la carte","American","Asian","BBQ","Bakery","Boerewors Rolls","Breakfast","Bunny Chow","Burgers","Cafe","Cake","Chinese","Coffee Shop","Curry","Deli","Fast Food","Fine Dining","French","Greek","Indian","Italian","Jaffels","Japanese","Mediterranean","Mexican","Middle Eastern","Pasta","Pizza","Ribs","Roast","Sandwiches","Seafood","Spanish","Steaks","Sushi","Thai","Vegan","Vegetarian"
- atmosphere: "Family-friendly","Romantic","Trendy / Modern","Quiet","Lively","Outdoor Seating","Sea View","Mountain View","Rooftop","Garden"
- features: "Walk-ins Welcome","Live Music","Free Wi-Fi"
- dietary: "Gluten Free","Halaal","Kosher","Nut Free","Signature Dish","Chef Recommendation"
- paymentOptions: "Card","Cash","Gaap","Mobile Tap","Snap Scan","Yoco","Zapper"
- accessibility: "Wheelchair Access","Parking Availability"
- childFriendly: "Child Friendly"  (include only if the form marks it child friendly)
- serviceOptions: "Dine-in","Takeaway","Delivery"
Phone numbers: keep digits as written. Keep handwriting verbatim; do not invent data.`

// Extract sends the PDF to Claude and returns the parsed fields.
//
//encore:api auth method=POST path=/onboarding/extract
func Extract(ctx context.Context, req *ExtractRequest) (*ExtractResponse, error) {
	d := auth.FromContext(ctx)
	if d == nil || d.User == nil {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "sign in to use this"}
	}
	switch d.User.Role {
	case "Rep", "SuperAdmin", "Admin":
		// allowed
	default:
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only reps or admins can onboard partners"}
	}

	apiKey := strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY"))
	if apiKey == "" {
		return nil, &errs.Error{Code: errs.Internal, Message: "Auto-fill isn't configured yet — set ANTHROPIC_API_KEY on the backend to enable it."}
	}
	instruction := restaurantInstruction // only restaurant wired for now

	// Build one content block per uploaded file: a PDF becomes a document block,
	// everything else an image block. WhatsApp screenshots arrive as several
	// images and are all read together as one submission.
	var blocks []map[string]interface{}
	addFile := func(mediaType, data string) {
		mediaType = strings.ToLower(strings.TrimSpace(mediaType))
		if mediaType == "image/jpg" {
			mediaType = "image/jpeg"
		}
		data = strings.TrimSpace(data)
		if i := strings.Index(data, ","); strings.HasPrefix(data, "data:") && i >= 0 {
			data = data[i+1:] // strip a data:...;base64, prefix if present
		}
		if data == "" {
			return
		}
		if mediaType == "application/pdf" {
			blocks = append(blocks, map[string]interface{}{
				"type": "document",
				"source": map[string]interface{}{
					"type":       "base64",
					"media_type": "application/pdf",
					"data":       data,
				},
			})
			return
		}
		if mediaType == "" {
			mediaType = "image/png"
		}
		blocks = append(blocks, map[string]interface{}{
			"type": "image",
			"source": map[string]interface{}{
				"type":       "base64",
				"media_type": mediaType,
				"data":       data,
			},
		})
	}
	for _, f := range req.Files {
		addFile(f.MediaType, f.Data)
	}
	if strings.TrimSpace(req.PDFBase64) != "" {
		addFile("application/pdf", req.PDFBase64)
	}
	if len(blocks) == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "no file provided"}
	}
	blocks = append(blocks, map[string]interface{}{"type": "text", "text": instruction})

	payload, err := json.Marshal(map[string]interface{}{
		"model":      model(),
		"max_tokens": 2000,
		"messages": []map[string]interface{}{
			{
				"role":    "user",
				"content": blocks,
			},
		},
	})
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("x-api-key", apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: "couldn't reach the reader service — please try again"}
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return nil, &errs.Error{Code: errs.Internal, Message: "the reader service returned an error (" + resp.Status + ") — check the file(s) and try again"}
	}

	var out struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: "couldn't read the form"}
	}
	var raw string
	for _, c := range out.Content {
		if c.Type == "text" {
			raw += c.Text
		}
	}
	raw = extractJSON(raw)
	if raw == "" {
		return nil, &errs.Error{Code: errs.Internal, Message: "couldn't find any details on the form"}
	}
	var fields map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &fields); err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: "couldn't understand the form layout"}
	}
	return &ExtractResponse{Fields: fields}, nil
}

// extractJSON pulls the first {...} object out of a model reply.
func extractJSON(s string) string {
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start < 0 || end < 0 || end < start {
		return ""
	}
	return s[start : end+1]
}
