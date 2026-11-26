// Package cache is a tiny in-memory, process-local TTL cache with single-flight
// loading. It keeps the hottest read paths (session validation + the public
// "nearby" partner lists) from hitting Postgres on every request.
//
// Single-flight matters under a launch-day burst: when hundreds of requests ask
// for the same key at the same moment (e.g. every call in one app-open validates
// the same token), only ONE runs the database query; the rest wait for it and
// share the result. A short TTL then serves follow-up requests from memory.
//
// Cached values are shared between callers and must be treated as read-only (the
// nearby handlers already copy rows before mutating them).
package cache

import (
	"sync"
	"time"
)

type entry[V any] struct {
	val V
	exp time.Time
}

type call[V any] struct {
	wg  sync.WaitGroup
	val V
	err error
}

// TTL is a concurrency-safe, single-flight key/value cache whose entries expire
// after a fixed duration. A background janitor drops expired entries so the map
// can't grow without bound.
type TTL[K comparable, V any] struct {
	mu       sync.Mutex
	ttl      time.Duration
	m        map[K]entry[V]
	inflight map[K]*call[V]
}

func NewTTL[K comparable, V any](ttl time.Duration) *TTL[K, V] {
	c := &TTL[K, V]{
		ttl:      ttl,
		m:        make(map[K]entry[V]),
		inflight: make(map[K]*call[V]),
	}
	go c.janitor()
	return c
}

// Get returns the cached value for key. On a miss (or expiry) it runs load()
// once; any other caller that asks for the same key while that load is in flight
// waits for it and shares the result, instead of each hitting the database.
func (c *TTL[K, V]) Get(key K, load func() (V, error)) (V, error) {
	c.mu.Lock()
	if e, ok := c.m[key]; ok && time.Now().Before(e.exp) {
		c.mu.Unlock()
		return e.val, nil
	}
	if cl, ok := c.inflight[key]; ok {
		c.mu.Unlock()
		cl.wg.Wait()
		return cl.val, cl.err
	}
	cl := &call[V]{}
	cl.wg.Add(1)
	c.inflight[key] = cl
	c.mu.Unlock()

	cl.val, cl.err = load()

	c.mu.Lock()
	if cl.err == nil {
		c.m[key] = entry[V]{val: cl.val, exp: time.Now().Add(c.ttl)}
	}
	delete(c.inflight, key)
	c.mu.Unlock()

	cl.wg.Done()
	return cl.val, cl.err
}

// Invalidate drops a single key immediately (e.g. after an admin edit).
func (c *TTL[K, V]) Invalidate(key K) {
	c.mu.Lock()
	delete(c.m, key)
	c.mu.Unlock()
}

func (c *TTL[K, V]) janitor() {
	t := time.NewTicker(c.ttl)
	defer t.Stop()
	for range t.C {
		now := time.Now()
		c.mu.Lock()
		for k, e := range c.m {
			if now.After(e.exp) {
				delete(c.m, k)
			}
		}
		c.mu.Unlock()
	}
}
