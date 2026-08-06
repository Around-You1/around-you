// Package storage implements image upload, the app logo, and platform-wide
// booking/social profile settings (BookingsSocialsDropdowns.tsx,
// LogoPlaceholder.tsx, ImageUpload.tsx, RestaurantTab.tsx).
//
// Upload now actually stores the image in Supabase Storage (a bucket named
// by SUPABASE_STORAGE_BUCKET, default "listing-photos") and returns its real
// public URL — it used to just echo back the data URL it was given, which
// meant nothing was ever actually saved anywhere.
//
// Requires two environment variables (see fly secrets set):
//
//	SUPABASE_URL                e.g. https://fiixxkfttisflgloynjw.supabase.co
//	SUPABASE_SERVICE_ROLE_KEY   from Supabase Dashboard -> Project Settings -> API
//	                            (the "service_role" secret key, NOT the anon key —
//	                             this bypasses Storage's row-level security, which
//	                             is correct here since this endpoint already
//	                             requires a valid app session of its own)
//
// The bucket itself must exist and be set to Public before this works —
// create it once via Supabase Dashboard -> Storage -> New bucket. This
// endpoint doesn't create the bucket itself; Supabase's Storage API returns
// a 404/"Bucket not found" error if it's missing, which is returned as-is
// below so the real cause is visible rather than a generic failure.
package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"encoding/base64"

	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

type UploadRequest struct {
	// Data is a data URL, e.g. "data:image/jpeg;base64,/9j/4AAQ...". This is
	// exactly what a browser's FileReader.readAsDataURL() produces, so the
	// frontend doesn't need any extra parsing before calling this.
	Data        string `json:"data"`
	ContentType string `json:"contentType,omitempty"` // optional override
}

type UploadResponse struct {
	Url string `json:"url"`
}

//encore:api auth method=POST path=/storage/upload
func Upload(ctx context.Context, req *UploadRequest) (*UploadResponse, error) {
	if strings.TrimSpace(req.Data) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "data is required"}
	}

	supabaseURL := strings.TrimRight(os.Getenv("SUPABASE_URL"), "/")
	serviceRoleKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	if supabaseURL == "" || serviceRoleKey == "" {
		return nil, &errs.Error{
			Code:    errs.Internal,
			Message: "photo storage isn't configured yet — SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY are not set",
		}
	}

	bucket := os.Getenv("SUPABASE_STORAGE_BUCKET")
	if bucket == "" {
		bucket = "listing-photos"
	}

	contentType, rawBase64, err := parseDataURL(req.Data)
	if err != nil {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: err.Error()}
	}
	if req.ContentType != "" {
		contentType = req.ContentType
	}

	fileBytes, err := base64.StdEncoding.DecodeString(rawBase64)
	if err != nil {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid base64 image data"}
	}

	filename := appdb.RandomCode(16) + extensionForContentType(contentType)

	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, bucket, filename)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, bytes.NewReader(fileBytes))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+serviceRoleKey)
	httpReq.Header.Set("apikey", serviceRoleKey)
	httpReq.Header.Set("Content-Type", contentType)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: "upload request failed: " + err.Error()}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("Supabase Storage upload failed (%d): %s", resp.StatusCode, string(body))}
	}

	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", supabaseURL, bucket, filename)
	return &UploadResponse{Url: publicURL}, nil
}

// parseDataURL splits "data:image/jpeg;base64,AAAA..." into its content type
// and base64 payload.
func parseDataURL(dataURL string) (contentType, base64Data string, err error) {
	if !strings.HasPrefix(dataURL, "data:") {
		return "", "", fmt.Errorf("expected a data: URL")
	}
	rest := strings.TrimPrefix(dataURL, "data:")
	parts := strings.SplitN(rest, ",", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("malformed data URL")
	}
	contentType = strings.TrimSuffix(parts[0], ";base64")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	return contentType, parts[1], nil
}

func extensionForContentType(ct string) string {
	switch ct {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "application/pdf":
		return ".pdf"
	default:
		return ""
	}
}

type LogoResponse struct {
	Url string `json:"url"`
}

//encore:api public method=GET path=/storage/logo
func GetLogo(ctx context.Context) (*LogoResponse, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	return &LogoResponse{Url: appdb.DB.LogoURL}, nil
}

type SetLogoRequest struct {
	Data        string `json:"data"`
	ContentType string `json:"contentType"`
}

//encore:api auth method=POST path=/storage/logo
func SetLogo(ctx context.Context, req *SetLogoRequest) (*LogoResponse, error) {
	if strings.TrimSpace(req.Data) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "data is required"}
	}
	appdb.DB.Lock()
	appdb.DB.LogoURL = req.Data
	appdb.DB.Unlock()
	return &LogoResponse{Url: req.Data}, nil
}

//encore:api public method=GET path=/storage/profile-settings
func GetProfileSettings(ctx context.Context) (*appdb.ProfileSettings, error) {
	appdb.DB.Lock()
	defer appdb.DB.Unlock()
	settings := appdb.DB.ProfileSettings
	return &settings, nil
}

//encore:api auth method=PUT path=/storage/profile-settings
func SetProfileSettings(ctx context.Context, req *appdb.ProfileSettings) (*appdb.ProfileSettings, error) {
	appdb.DB.Lock()
	appdb.DB.ProfileSettings = *req
	settings := appdb.DB.ProfileSettings
	appdb.DB.Unlock()
	return &settings, nil
}
