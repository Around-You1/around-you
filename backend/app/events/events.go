// Package events records behavioural events (QR scans, and later logins,
// searches, listing views) into the append-only events table. The record
// endpoint is PUBLIC and best-effort: anonymous guests trigger most events, and
// an analytics write must never break the user-facing request.
package events

import (
	"context"
	"log"
	"strings"

	"backend_encore/internal/appdb"
)

type RecordRequest struct {
	EventType  string `json:"eventType"`
	ActorType  string `json:"actorType"`
	Code       string `json:"code"`
	EntityType string `json:"entityType"`
	EntityID   int64  `json:"entityId"`
	Area       string `json:"area"`
	Province   string `json:"province"`
}

type RecordResponse struct {
	OK bool `json:"ok"`
}

// Record inserts one behavioural event. Public + best-effort: unknown/blank
// event types are ignored, and a DB error is logged but still returns ok so the
// caller (the app) is never blocked by analytics.
//
//encore:api public method=POST path=/events
func Record(ctx context.Context, req *RecordRequest) (*RecordResponse, error) {
	et := strings.TrimSpace(req.EventType)
	if et == "" {
		return &RecordResponse{OK: true}, nil
	}
	if len(et) > 40 {
		et = et[:40]
	}
	if _, err := appdb.SQLDB.ExecContext(ctx, `
		INSERT INTO events (event_type, actor_type, code, entity_type, entity_id, area, province)
		VALUES ($1, NULLIF($2,''), NULLIF($3,''), NULLIF($4,''), NULLIF($5,0), NULLIF($6,''), NULLIF($7,''))`,
		et, strings.TrimSpace(req.ActorType), strings.TrimSpace(req.Code),
		strings.TrimSpace(req.EntityType), req.EntityID,
		strings.TrimSpace(req.Area), strings.TrimSpace(req.Province),
	); err != nil {
		log.Printf("events: record %q failed: %v", et, err)
	}
	return &RecordResponse{OK: true}, nil
}
