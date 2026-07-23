package appdb

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
)

// Migrate applies every *.sql file in dir, in filename order, exactly once.
// It replaces Encore's built-in migration runner: applied versions are tracked
// in a schema_migrations table so restarts are idempotent, and each file runs
// inside its own transaction so a failure leaves the schema untouched.
//
// Files are plain Postgres and may contain multiple statements (lib/pq sends a
// parameterless Exec over the simple query protocol, which supports that).
func Migrate(ctx context.Context, dir string) error {
	if SQLDB == nil {
		return fmt.Errorf("Migrate: database not initialised (call Init first)")
	}

	if _, err := SQLDB.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    text PRIMARY KEY,
			applied_at timestamptz NOT NULL DEFAULT now()
		)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	files, err := filepath.Glob(filepath.Join(dir, "*.sql"))
	if err != nil {
		return fmt.Errorf("scan migrations dir %q: %w", dir, err)
	}
	sort.Strings(files)

	for _, file := range files {
		version := filepath.Base(file)

		var applied bool
		if err := SQLDB.QueryRowContext(ctx,
			`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, version,
		).Scan(&applied); err != nil {
			return fmt.Errorf("check migration %s: %w", version, err)
		}
		if applied {
			continue
		}

		stmts, err := os.ReadFile(file)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", version, err)
		}

		tx, err := SQLDB.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("begin tx for %s: %w", version, err)
		}
		if _, err := tx.ExecContext(ctx, string(stmts)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("apply migration %s: %w", version, err)
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO schema_migrations (version) VALUES ($1)`, version,
		); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("record migration %s: %w", version, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %s: %w", version, err)
		}
	}

	return nil
}
