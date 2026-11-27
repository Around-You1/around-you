"use client";

// -----------------------------------------------------------------------------
// Admin › Real Estate tab.
//
// Agencies are the top level; each agency shows the agents associated with it
// (linked by agency_id, or by the agency name a standalone agent typed). Agents
// that match no agency appear under "Independent agents". Each agent owns their
// profile + property listings (EstateAgentForm).
//
// Each agency is a billable R300/month page and each agent R200/month, so both carry the
// same Accept / Disable / Suspend controls as the other partner categories:
//   • Accept    — sends the first invoice + sign-in codes email (partner stays
//                 off the site until activated after payment).
//   • Disable   — the green Active switch: live on the site + recurring billing.
//   • Suspend   — amber switch: page stays visible but contact number, address
//                 and directions are hidden from guests/locals.
// Accept/Suspend go through the shared admin endpoints with entity types
// "estate_agency" / "estate_agent"; Active stays on the estate endpoints.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { getAuthenticatedBackend } from "../lib/backend";
import EstateAgencyForm from "./EstateAgencyForm";
import EstateAgentForm from "./EstateAgentForm";

interface Agency {
  id: number;
  name: string;
  province?: string;
  address?: string;
  imageUrl?: string;
  isActive: boolean;
}
interface Agent {
  id: number;
  name: string;
  agencyId?: number;
  agencyName?: string;
  province?: string;
  isActive: boolean;
}

export default function EstateTab() {
  const { toast } = useToast();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAgencyForm, setShowAgencyForm] = useState(false);
  const [editingAgencyId, setEditingAgencyId] = useState<number | undefined>(undefined);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<number | undefined>(undefined);
  const [agentDefaultAgency, setAgentDefaultAgency] = useState<string>("");

  // Accept (first invoice + codes) + Suspend state, for agencies and agents.
  const [accepting, setAccepting] = useState<number | null>(null);
  const [suspending, setSuspending] = useState<number | null>(null);
  const [acceptedAgencyIds, setAcceptedAgencyIds] = useState<Set<number>>(new Set());
  const [acceptedAgentIds, setAcceptedAgentIds] = useState<Set<number>>(new Set());
  const [suspendedAgencyIds, setSuspendedAgencyIds] = useState<Set<number>>(new Set());
  const [suspendedAgentIds, setSuspendedAgentIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const backend = getAuthenticatedBackend();
      const [ag, agn]: any = await Promise.all([backend.estate.listAgencies(), backend.estate.listAllAgents()]);
      setAgencies((ag.agencies || []) as Agency[]);
      setAgents((agn.agents || []) as Agent[]);
      try {
        const [invA, invG, susA, susG]: any = await Promise.all([
          backend.admin.invoicedIds({ entityType: "estate_agency" }),
          backend.admin.invoicedIds({ entityType: "estate_agent" }),
          backend.admin.suspendedIds({ entityType: "estate_agency" }),
          backend.admin.suspendedIds({ entityType: "estate_agent" }),
        ]);
        setAcceptedAgencyIds(new Set<number>(invA?.ids || []));
        setAcceptedAgentIds(new Set<number>(invG?.ids || []));
        setSuspendedAgencyIds(new Set<number>(susA?.ids || []));
        setSuspendedAgentIds(new Set<number>(susG?.ids || []));
      } catch {
        /* ignore — the Accept/Suspend buttons still render */
      }
    } catch (error: any) {
      toast({ title: "Couldn't load", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!showAgencyForm && !showAgentForm) load();
  }, [showAgencyForm, showAgentForm, load]);

  const norm = (s?: string) => (s || "").trim().toLowerCase();
  const belongsTo = (x: Agent, a: Agency) => x.agencyId === a.id || (!!norm(x.agencyName) && norm(x.agencyName) === norm(a.name));
  const isMatched = (x: Agent) => agencies.some((a) => belongsTo(x, a));
  const independentAgents = agents.filter((x) => !isMatched(x));

  const toggleAgency = async (a: Agency) => {
    try {
      await getAuthenticatedBackend().estate.setAgencyActive({ id: a.id, active: !a.isActive });
      setAgencies((prev) => prev.map((x) => (x.id === a.id ? { ...x, isActive: !a.isActive } : x)));
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed", variant: "destructive" });
    }
  };
  const removeAgency = async (a: Agency) => {
    if (!confirm(`Delete "${a.name}" and all its agents and properties?`)) return;
    try {
      await getAuthenticatedBackend().estate.deleteAgency({ id: a.id });
      load();
      toast({ title: "Deleted", description: `${a.name} removed.` });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to delete", variant: "destructive" });
    }
  };
  const toggleAgent = async (a: Agent) => {
    try {
      await getAuthenticatedBackend().estate.setAgentActive({ id: a.id, active: !a.isActive });
      setAgents((prev) => prev.map((x) => (x.id === a.id ? { ...x, isActive: !a.isActive } : x)));
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed", variant: "destructive" });
    }
  };
  const removeAgent = async (a: Agent) => {
    if (!confirm(`Delete agent "${a.name}" and their listings?`)) return;
    try {
      await getAuthenticatedBackend().estate.deleteAgent({ id: a.id });
      setAgents((prev) => prev.filter((x) => x.id !== a.id));
      toast({ title: "Deleted", description: `${a.name} removed.` });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to delete", variant: "destructive" });
    }
  };

  const acceptAgency = async (a: Agency) => {
    setAccepting(a.id);
    try {
      await getAuthenticatedBackend().admin.acceptPartners({ entityType: "estate_agency", ids: [a.id] });
      setAcceptedAgencyIds((prev) => new Set(prev).add(a.id));
      toast({ title: "Accepted", description: "First invoice and sign-in codes emailed. Activate the agency once payment is received." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to accept agency", variant: "destructive" });
    } finally {
      setAccepting(null);
    }
  };
  const acceptAgent = async (a: Agent) => {
    setAccepting(a.id);
    try {
      await getAuthenticatedBackend().admin.acceptPartners({ entityType: "estate_agent", ids: [a.id] });
      setAcceptedAgentIds((prev) => new Set(prev).add(a.id));
      toast({ title: "Accepted", description: "First invoice and sign-in codes emailed. Activate the agent once payment is received." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to accept agent", variant: "destructive" });
    } finally {
      setAccepting(null);
    }
  };

  const toggleAgencySuspended = async (a: Agency) => {
    const next = !suspendedAgencyIds.has(a.id);
    setSuspending(a.id);
    try {
      await getAuthenticatedBackend().admin.setSuspended({ entityType: "estate_agency", ids: [a.id], suspended: next });
      setSuspendedAgencyIds((prev) => { const s2 = new Set(prev); if (next) s2.add(a.id); else s2.delete(a.id); return s2; });
      toast({ title: next ? "Suspended" : "Un-suspended", description: next ? "Agency stays visible, but contact number, address and directions are now hidden from guests/locals." : "Contact number, address and directions are visible again." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to update suspension", variant: "destructive" });
    } finally {
      setSuspending(null);
    }
  };
  const toggleAgentSuspended = async (a: Agent) => {
    const next = !suspendedAgentIds.has(a.id);
    setSuspending(a.id);
    try {
      await getAuthenticatedBackend().admin.setSuspended({ entityType: "estate_agent", ids: [a.id], suspended: next });
      setSuspendedAgentIds((prev) => { const s2 = new Set(prev); if (next) s2.add(a.id); else s2.delete(a.id); return s2; });
      toast({ title: next ? "Suspended" : "Un-suspended", description: next ? "Agent stays visible, but contact number, address and directions are now hidden from guests/locals." : "Contact number, address and directions are visible again." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to update suspension", variant: "destructive" });
    } finally {
      setSuspending(null);
    }
  };

  const openAddAgent = (agencyName: string) => {
    setEditingAgentId(undefined);
    setAgentDefaultAgency(agencyName);
    setShowAgentForm(true);
  };
  const openEditAgent = (id: number) => {
    setEditingAgentId(id);
    setAgentDefaultAgency("");
    setShowAgentForm(true);
  };

  if (showAgencyForm) {
    return (
      <EstateAgencyForm
        agencyId={editingAgencyId}
        onClose={() => setShowAgencyForm(false)}
        onSaved={() => setShowAgencyForm(false)}
      />
    );
  }
  if (showAgentForm) {
    return (
      <EstateAgentForm
        agentId={editingAgentId}
        defaultAgencyName={agentDefaultAgency}
        onClose={() => setShowAgentForm(false)}
        onSaved={() => setShowAgentForm(false)}
      />
    );
  }

  const agentRow = (a: Agent) => (
    <div key={a.id} className="flex flex-col gap-2 rounded-md border border-border/60 p-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm">{a.name}</p>
        <p className="truncate text-xs text-muted-foreground">{a.province || "—"}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {!a.isActive && (
          <Button
            variant="outline"
            size="sm"
            className={acceptedAgentIds.has(a.id) ? "text-xs border-muted-foreground/30 text-muted-foreground" : "text-xs border-brand/50 text-[#2a9d12] hover:bg-brand/10"}
            title={acceptedAgentIds.has(a.id) ? "Invoice sent — awaiting payment. Activate once paid." : "Accept: send the first invoice + codes"}
            disabled={accepting === a.id}
            onClick={() => acceptAgent(a)}
          >
            {accepting === a.id ? "Sending…" : acceptedAgentIds.has(a.id) ? "✓ Accepted" : "Accept"}
          </Button>
        )}
        <div className="flex items-center gap-1">
          <Switch checked={a.isActive} onCheckedChange={() => toggleAgent(a)} className="data-[state=checked]:bg-green-600" />
          <span className="hidden text-xs text-muted-foreground sm:inline">{a.isActive ? "Active" : "Disabled"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Switch
            checked={suspendedAgentIds.has(a.id)}
            onCheckedChange={() => toggleAgentSuspended(a)}
            disabled={suspending === a.id}
            className="data-[state=checked]:bg-amber-500"
            title="Suspended — page stays visible but contact number, address and directions are hidden from guests/locals"
          />
          <span className={`hidden text-xs sm:inline ${suspendedAgentIds.has(a.id) ? "font-medium text-amber-600" : "text-muted-foreground"}`}>Suspended</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => openEditAgent(a.id)}>Edit</Button>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeAgent(a)}>Delete</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Estate Agencies ({agencies.length})</p>
        <Button
          className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black"
          onClick={() => { setEditingAgencyId(undefined); setShowAgencyForm(true); }}
        >
          + Add Estate Agency
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : agencies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No estate agencies yet.</p>
      ) : (
        agencies.map((a) => {
          const nested = agents.filter((x) => belongsTo(x, a));
          return (
            <Card key={a.id}>
              <CardContent className="space-y-3 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {a.imageUrl ? (
                      <img src={a.imageUrl} alt={a.name} className="h-12 w-12 shrink-0 rounded object-contain bg-white" />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded bg-muted" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[a.address, a.province].filter(Boolean).join(", ") || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {!a.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={acceptedAgencyIds.has(a.id) ? "text-xs border-muted-foreground/30 text-muted-foreground" : "text-xs border-brand/50 text-[#2a9d12] hover:bg-brand/10"}
                        title={acceptedAgencyIds.has(a.id) ? "Invoice sent — awaiting payment. Activate once paid." : "Accept: send the first invoice + codes"}
                        disabled={accepting === a.id}
                        onClick={() => acceptAgency(a)}
                      >
                        {accepting === a.id ? "Sending…" : acceptedAgencyIds.has(a.id) ? "✓ Accepted" : "Accept"}
                      </Button>
                    )}
                    <div className="flex items-center gap-1">
                      <Switch checked={a.isActive} onCheckedChange={() => toggleAgency(a)} className="data-[state=checked]:bg-green-600" />
                      <span className="hidden text-xs text-muted-foreground sm:inline">{a.isActive ? "Active" : "Disabled"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={suspendedAgencyIds.has(a.id)}
                        onCheckedChange={() => toggleAgencySuspended(a)}
                        disabled={suspending === a.id}
                        className="data-[state=checked]:bg-amber-500"
                        title="Suspended — page stays visible but contact number, address and directions are hidden from guests/locals"
                      />
                      <span className={`hidden text-xs sm:inline ${suspendedAgencyIds.has(a.id) ? "font-medium text-amber-600" : "text-muted-foreground"}`}>Suspended</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setEditingAgencyId(a.id); setShowAgencyForm(true); }}>Edit</Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeAgency(a)}>Delete</Button>
                  </div>
                </div>

                <div className="ml-2 space-y-2 border-l-2 border-[#AEECE4]/40 pl-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Agents ({nested.length})</p>
                    <Button variant="outline" size="sm" className="border-[#AEECE4] text-foreground" onClick={() => openAddAgent(a.name)}>
                      + Add Agent
                    </Button>
                  </div>
                  {nested.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No agents yet.</p>
                  ) : (
                    nested.map((ag) => agentRow(ag))
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Agents whose typed agency doesn't match a registered agency */}
      {!loading && independentAgents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Independent agents ({independentAgents.length})</p>
            <Button variant="outline" size="sm" className="border-[#AEECE4] text-foreground" onClick={() => openAddAgent("")}>
              + Add Agent
            </Button>
          </div>
          {independentAgents.map((ag) => agentRow(ag))}
        </div>
      )}
    </div>
  );
}
