package appdb

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"

	// Registers the "postgres" driver with database/sql. Imported for its
	// side effect only; all access goes through database/sql.
	_ "github.com/lib/pq"
)

// SQLDB is the process-wide Postgres handle backing the SQL-migrated entities
// (accommodation today; restaurant/service/attraction as they move over).
// It is nil until Init has run, so Init must be called once during startup —
// before the HTTP server begins serving traffic (see cmd/server/main.go).
var SQLDB *sql.DB

// Init opens the Postgres connection pool from DATABASE_URL and verifies it is
// reachable with a ping. It replaces Encore's implicit, auto-provisioned
// database: with pure database/sql the app owns its own connection lifecycle.
//
// DATABASE_URL uses the standard libpq/Postgres URL form, e.g.
//
//	postgres://user:password@localhost:5432/aroundyou?sslmode=disable
func Init(ctx context.Context) error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return fmt.Errorf("DATABASE_URL is not set")
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := db.PingContext(pingCtx); err != nil {
		return fmt.Errorf("ping database: %w", err)
	}

	SQLDB = db
	return nil
}

// Close releases the connection pool. Safe to call on a nil/uninitialised
// SQLDB.
func Close() error {
	if SQLDB == nil {
		return nil
	}
	return SQLDB.Close()
}
