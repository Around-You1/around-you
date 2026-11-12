package appdb

import (
	"context"
	"strconv"
	"strings"
)

// SuspendedIDs returns the subset of the given partner ids (in `table`) whose
// profile is currently suspended. A suspended partner stays visible to guests
// and locals, but its contact number, address and map directions are hidden.
// `table` is an internal constant chosen by the caller (never user input), and
// ids are numeric, so the IN list is built directly.
func SuspendedIDs(ctx context.Context, table string, ids []int64) map[int64]bool {
	out := map[int64]bool{}
	if len(ids) == 0 {
		return out
	}
	parts := make([]string, len(ids))
	for i, id := range ids {
		parts[i] = strconv.FormatInt(id, 10)
	}
	rows, err := SQLDB.QueryContext(ctx,
		"SELECT id FROM "+table+" WHERE suspended = true AND id IN ("+strings.Join(parts, ",")+")")
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		if rows.Scan(&id) == nil {
			out[id] = true
		}
	}
	return out
}
