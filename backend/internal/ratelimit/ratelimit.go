// Package ratelimit is a small, dependency-free, in-memory token-bucket rate
// limiter keyed by an arbitrary string (e.g. a bearer token).
//
// Purpose: blunt bulk scraping. A normal guest/admin session makes a handful of
// requests and never approaches the limit; an automated client trying to
// iterate many areas/coordinates to drain the directory hits the ceiling and
// gets HTTP 429. Legitimate use is unaffected.
//
// Scope: per-process. On Fly with a single running machine this covers all
// traffic. If the app is ever scaled to multiple machines, each enforces the
// limit independently (still a hard ceiling per machine). For a strict global
// limit, front the service with Cloudflare.
package ratelimit

import (
	"sync"
	"time"
)

// Limiter allows, on average, a fixed number of requests per key per minute,
// with a burst up to that same number. Safe for concurrent use.
type Limiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	capacity float64 // max burst (tokens)
	refill   float64 // tokens added per second
}

type bucket struct {
	tokens float64
	last   time.Time
}

// New returns a limiter permitting perMinute requests per key (burst == perMinute).
// A non-positive perMinute falls back to a generous default.
func New(perMinute int) *Limiter {
	if perMinute <= 0 {
		perMinute = 180
	}
	l := &Limiter{
		buckets:  make(map[string]*bucket),
		capacity: float64(perMinute),
		refill:   float64(perMinute) / 60.0,
	}
	go l.gc()
	return l
}

// Allow consumes one token for key and reports whether the request may proceed.
func (l *Limiter) Allow(key string) bool {
	now := time.Now()

	l.mu.Lock()
	defer l.mu.Unlock()

	b, ok := l.buckets[key]
	if !ok {
		// First request for this key: start with a full bucket, spend one token.
		l.buckets[key] = &bucket{tokens: l.capacity - 1, last: now}
		return true
	}

	// Refill proportionally to elapsed time, capped at capacity.
	b.tokens += now.Sub(b.last).Seconds() * l.refill
	if b.tokens > l.capacity {
		b.tokens = l.capacity
	}
	b.last = now

	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// gc periodically evicts idle buckets so memory does not grow unbounded.
func (l *Limiter) gc() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-30 * time.Minute)
		l.mu.Lock()
		for k, b := range l.buckets {
			if b.last.Before(cutoff) {
				delete(l.buckets, k)
			}
		}
		l.mu.Unlock()
	}
}
