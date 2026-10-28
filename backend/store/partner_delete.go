package store

import (
	"context"
	"database/sql"

	"backend_encore/internal/appdb"
)

// deletePartnerRelated removes every row tied to a partner (by its polymorphic
// type + id) from the shared tables, so a hard delete never leaves orphaned
// loyalty cards, ratings, bookings, billing, etc. — and never trips a foreign
// key that would otherwise block the delete. Must run inside a transaction.
// Ordered so rows referencing others (commission -> invoice -> subscription) go
// first.
func deletePartnerRelated(ctx context.Context, tx *sql.Tx, typ string, id int64) error {
	type t struct{ table, tcol, icol string }
	for _, c := range []t{
		{"commission", "source_partner_type", "source_partner_id"},
		{"invoice", "partner_type", "partner_id"},
		{"partner_subscription", "partner_type", "partner_id"},
		{"loyalty_redemptions", "partner_type", "partner_id"},
		{"loyalty_cards", "partner_type", "partner_id"},
		{"loyalty_programs", "partner_type", "partner_id"},
		{"ratings", "entity_type", "entity_id"},
		{"discount_redemptions", "entity_type", "entity_id"},
		{"bookings", "entity_type", "entity_id"},
		{"events", "entity_type", "entity_id"},
		{"partner_charity", "partner_type", "partner_id"},
		{"charity_nominations", "partner_type", "partner_id"},
	} {
		if _, err := tx.ExecContext(ctx, "DELETE FROM "+c.table+" WHERE "+c.tcol+" = $1 AND "+c.icol+" = $2", typ, id); err != nil {
			return err
		}
	}
	// profile_suggestions references a partner both as owner and as target.
	if _, err := tx.ExecContext(ctx,
		"DELETE FROM profile_suggestions WHERE (owner_type = $1 AND owner_id = $2) OR (target_type = $1 AND target_id = $2)",
		typ, id); err != nil {
		return err
	}
	return nil
}

// deletePartnerWithRelated clears a partner's related rows and the partner row
// itself in one transaction. notFound is returned when no partner row matched.
func deletePartnerWithRelated(ctx context.Context, partnerType, table string, id int64, notFound error) error {
	tx, err := appdb.SQLDB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := deletePartnerRelated(ctx, tx, partnerType, id); err != nil {
		_ = tx.Rollback()
		return err
	}
	res, err := tx.ExecContext(ctx, "DELETE FROM "+table+" WHERE id = $1", id)
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	if n == 0 {
		_ = tx.Rollback()
		return notFound
	}
	return tx.Commit()
}
