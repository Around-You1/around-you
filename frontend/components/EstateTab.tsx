"use client";

// -----------------------------------------------------------------------------
// Admin › Real Estate tab.
//
// Agencies are the top level; each agency shows the agents associated with it
// (linked by agency_id, or by the agency name a standalone agent typed). Agents
// that match no agency appear under "Independent agents". Each agent owns their
// profile + property listings (EstateAgentForm).
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const backend = getAuthenticatedBackend();
      const [ag, agn]: any = await Promise.all([backend.estate.listAgencies(), backend.estate.listAllAgents()]);
      setAgencies((ag.agencies || []) as Agency[]);
      setAgents((agn.agents || []) as Agent[]);
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
    <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-2">
      <div className="min-w-0">
        <p className="truncate text-sm">{a.name}</p>
        <p className="truncate text-xs text-muted-foreground">{a.province || "—"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Switch checked={a.isActive} onCheckedChange={() => toggleAgent(a)} className="data-[state=checked]:bg-green-600" />
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
                <div className="flex items-center justify-between gap-3">
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
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch checked={a.isActive} onCheckedChange={() => toggleAgency(a)} className="data-[state=checked]:bg-green-600" />
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
