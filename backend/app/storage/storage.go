// Package storage implements image upload, the app logo, and platform-wide
// booking/social profile settings (BookingsSocialsDropdowns.tsx,
// LogoPlaceholder.tsx, ImageUpload.tsx, RestaurantTab.tsx).
//
// Upload is a placeholder: it returns the data URL it was given rather than
// writing to real object storage/a CDN, since none is wired up yet. Swapping
// in encore.dev/storage/objects (or S3/GCS) later just means changing Upload
// and SetLogo's bodies — callers already only depend on getting a URL back.
package storage

import (
	"context"
	"strings"

	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
)

type UploadRequest struct {
	Data        string `json:"data"`
	ContentType string `json:"contentType"`
}

type UploadResponse struct {
	Url string `json:"url"`
}

//encore:api auth method=POST path=/storage/upload
func Upload(ctx context.Context, req *UploadRequest) (*UploadResponse, error) {
	if strings.TrimSpace(req.Data) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "data is required"}
	}
	// Placeholder: echo the data URL back directly. See package doc.
	return &UploadResponse{Url: req.Data}, nil
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
