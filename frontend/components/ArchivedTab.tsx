"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";

interface ArchivedRow {
  id: number;
  entityType: string;
  originalId: number;
  name: string;
  province: string;
  area: string;
  archivedBy: string;
  reason: string;
  archivedAt: string;
}

export default function ArchivedTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ArchivedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const backend = getAuthenticatedBackend();
      const res = await backend.admin.archived();
      setRows(((res as any).archived || []) as ArchivedRow[]);
    } catch (error: any) {
      toast({ title: "Couldn't load archive", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const reinstate = async (row: ArchivedRow) => {
    if (!confirm(`Reinstate "${row.name}"? It will be re-created with brand-new Access and Edit codes.`)) return;
    setBusy(row.id);
    try {
      const backend = getAuthenticatedBackend();
      const res: any = await backend.admin.reinstate({ archiveId: row.id });
      toast({
        title: "Reinstated",
        description: `${res.name || row.name} is back. New Access Code: ${res.accessCode || "—"}${res.editCode ? `, Edit Code: ${res.editCode}` : ""}. Copy these now.`,
      });
      load();
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Reinstate failed", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const purge = async (row: ArchivedRow) => {
    if (!confirm(`Permanently delete "${row.name}"? This CANNOT be undone — the profile's data will be gone for good.`)) return;
    setBusy(row.id);
    try {
      const backend = getAuthenticatedBackend();
      await backend.admin.purge({ archiveId: row.id });
      toast({ title: "Permanently deleted", description: `"${row.name}" removed from the archive.` });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Purge failed", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Archived Profiles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Deleted profiles are kept here and can be reinstated without re-onboarding. Reinstating
          re-creates the profile with brand-new Access and Edit codes (the old codes are never
          reused). <strong>Permanently delete</strong> removes a profile for good — it can&apos;t be undone.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">The archive is empty.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Province</th>
                  <th className="py-2 pr-3">Area</th>
                  <th className="py-2 pr-3">Deleted by</th>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium">{r.name || "—"}</td>
                    <td className="py-2 pr-3 capitalize">{r.entityType}</td>
                    <td className="py-2 pr-3">{r.province || "—"}</td>
                    <td className="py-2 pr-3">{r.area || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.archivedBy || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{r.archivedAt}</td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => reinstate(r)} disabled={busy === r.id}>
                          Reinstate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => purge(r)}
                          disabled={busy === r.id}
                        >
                          Permanently delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
