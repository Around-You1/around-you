"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { ShieldCheck, Copy, Clock } from "lucide-react";

interface Councillor {
  id: number;
  fullName: string;
  idNumber: string;
  staffNumber: string;
  ward: string;
  postalCodes: string[];
  status: string; // pending | active | disabled
  createdAt: string;
}

export default function CouncillorsTab({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Councillor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Access codes are returned exactly once (on approval). Keep them on screen so
  // the Super Admin can copy and pass the code to the councillor.
  const [issued, setIssued] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await getAuthenticatedBackend().admin.listCouncillors();
      const list: Councillor[] = res?.councillors || [];
      setRows(list);
      onCountChange?.(list.filter((c) => c.status === "pending").length);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not load councillors.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [onCountChange, toast]);

  useEffect(() => { load(); }, [load]);

  async function approve(c: Councillor) {
    setBusyId(c.id);
    try {
      const res: any = await getAuthenticatedBackend().admin.approveCouncillor({ id: c.id });
      if (res?.accessCode) setIssued((m) => ({ ...m, [c.id]: res.accessCode }));
      toast({ title: "Approved", description: `${c.fullName} is now active. Send them their access code.` });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not approve.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function regenerate(c: Councillor) {
    setBusyId(c.id);
    try {
      const res: any = await getAuthenticatedBackend().admin.approveCouncillor({ id: c.id });
      if (res?.accessCode) setIssued((m) => ({ ...m, [c.id]: res.accessCode }));
      toast({ title: "New access code issued", description: `${c.fullName}'s previous code no longer works. Send them the new one.` });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not regenerate the code.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(c: Councillor, status: string) {
    setBusyId(c.id);
    try {
      await getAuthenticatedBackend().admin.setCouncillorStatus({ id: c.id, status });
      toast({ title: status === "disabled" ? "Disabled" : "Re-enabled", description: `${c.fullName} ${status === "disabled" ? "can no longer post alerts." : "can post alerts again."}` });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not update.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  function copyCode(code: string) {
    try {
      navigator.clipboard?.writeText(code);
      toast({ title: "Copied", description: "Access code copied to the clipboard." });
    } catch { /* ignore */ }
  }

  const pending = rows.filter((c) => c.status === "pending");
  const active = rows.filter((c) => c.status === "active");
  const disabled = rows.filter((c) => c.status === "disabled");

  const chip = (codes: string[]) => (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {codes.length ? codes.map((c) => (
        <span key={c} className="text-[11px] font-semibold text-brand border border-brand/40 rounded-full px-2 py-0.5">{c}</span>
      )) : <span className="text-xs text-muted-foreground">—</span>}
    </div>
  );

  const row = (c: Councillor) => (
    <div key={c.id} className="rounded-lg border border-border p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{c.fullName}{c.ward ? <span className="text-brand"> — Ward {c.ward}</span> : null}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {c.idNumber ? <>ID {c.idNumber}</> : null}
            {c.idNumber && c.staffNumber ? " · " : null}
            {c.staffNumber ? <>Staff #{c.staffNumber}</> : null}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Ward postal codes:</div>
          {chip(c.postalCodes)}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {c.status === "pending" && (
            <Button size="sm" disabled={busyId === c.id} onClick={() => approve(c)} className="bg-brand hover:bg-brand/90 text-brand-foreground">
              <ShieldCheck className="h-4 w-4 mr-1" /> Approve
            </Button>
          )}
          {c.status === "active" && (
            <>
              <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => regenerate(c)}>Regenerate code</Button>
              <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => setStatus(c, "disabled")}>Disable</Button>
            </>
          )}
          {c.status === "disabled" && (
            <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => setStatus(c, "active")}>Re-enable</Button>
          )}
        </div>
      </div>
      {issued[c.id] && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-brand/40 bg-brand/5 px-3 py-2">
          <div className="text-xs text-muted-foreground">Access code (send to councillor):</div>
          <code className="text-sm font-bold tracking-wide text-brand">{issued[c.id]}</code>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyCode(issued[c.id])}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-brand" /> Pending approval
            {pending.length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold h-4 min-w-[16px] px-1">{pending.length}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <div className="text-sm text-muted-foreground">Loading…</div>
            : pending.length ? pending.map(row)
            : <div className="text-sm text-muted-foreground">No councillors are waiting for approval.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Active councillors</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {active.length ? active.map(row) : <div className="text-sm text-muted-foreground">No active councillors yet.</div>}
        </CardContent>
      </Card>

      {disabled.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Disabled</CardTitle></CardHeader>
          <CardContent className="space-y-3">{disabled.map(row)}</CardContent>
        </Card>
      )}
    </div>
  );
}
