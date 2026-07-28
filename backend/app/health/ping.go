// Package health provides a simple public liveness check. Replaces the
// previous ping.go, which called api.Get(...) inside an init() func — a
// function that doesn't exist on the real encore.dev/api package.
package health

import "context"

type PingResponse struct {
	Pong string `json:"pong"`
}

//encore:api public method=GET path=/ping
func Ping(ctx context.Context) (*PingResponse, error) {
	return &PingResponse{Pong: "ok"}, nil
}
