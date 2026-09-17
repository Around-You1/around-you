"use client";

// -----------------------------------------------------------------------------
// Admin › Real Estate tab.
//
// Manage Estate Agencies and Estate Agents. Each agent owns their profile and
// their property listings (added via EstateAgentForm → PropertyListingFields).
// The public Agencies → Agent → property pages read this data (Phases 3-4).
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
  isActive: boolean;
}
interface Agent {
  id: number;
  name: string;
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
      setAgencies((prev) => prev.filter((x) => x.id !== a.id));
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
        onClose={() => setShowAgentForm(false)}
        onSaved={() => setShowAgentForm(false)}
      />
    );
  }

  const row = (
    title: string,
    subtitle: string,
    active: boolean,
    onToggle: () => void,
    onEdit: () => void,
    onDelete: () => void,
  ) => (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle || "—"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch checked={active} onCheckedChange={onToggle} className="data-[state=checked]:bg-green-600" />
          <span className="text-xs text-muted-foreground">{active ? "Active" : "Disabled"}</span>
          <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* Agencies */}
      <div className="space-y-3">
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
          agencies.map((a) =>
            <div key={a.id}>
              {row(a.name, a.province || "", a.isActive, () => toggleAgency(a),
                () => { setEditingAgencyId(a.id); setShowAgencyForm(true); }, () => removeAgency(a))}
            </div>,
          )
        )}
      </div>

      {/* Agents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Estate Agents ({agents.length})</p>
          <Button
            variant="outline"
            className="border-[#AEECE4] text-foreground"
            onClick={() => { setEditingAgentId(undefined); setShowAgentForm(true); }}
          >
            + Add Estate Agent
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No estate agents yet.</p>
        ) : (
          agents.map((a) =>
            <div key={a.id}>
              {row(a.name, [a.agencyName, a.province].filter(Boolean).join(" · "), a.isActive, () => toggleAgent(a),
                () => { setEditingAgentId(a.id); setShowAgentForm(true); }, () => removeAgent(a))}
            </div>,
          )
        )}
      </div>
    </div>
  );
}
