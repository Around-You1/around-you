"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import EstateAgencyForm from "./EstateAgencyForm";
import EstateAgentForm from "./EstateAgentForm";

interface Agency {
  id: number;
  name: string;
  province: string;
  isActive: boolean;
  createAgentPages: boolean;
}

interface Agent {
  id: number;
  agencyId?: number;
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
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>(undefined);
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
    if (!showForm && !showAgentForm) load();
  }, [showForm, showAgentForm, load]);

  const toggleActive = async (a: Agency) => {
    try {
      const backend = getAuthenticatedBackend();
      await backend.estate.setAgencyActive({ id: a.id, active: !a.isActive });
      setAgencies((prev) => prev.map((x) => (x.id === a.id ? { ...x, isActive: !a.isActive } : x)));
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed", variant: "destructive" });
    }
  };

  const remove = async (a: Agency) => {
    if (!confirm(`Delete "${a.name}" and all its agents and properties? This also cancels their billing.`)) return;
    try {
      const backend = getAuthenticatedBackend();
      await backend.estate.deleteAgency({ id: a.id });
      toast({ title: "Deleted", description: `${a.name} removed.` });
      setAgencies((prev) => prev.filter((x) => x.id !== a.id));
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to delete", variant: "destructive" });
    }
  };

  const toggleAgentActive = async (a: Agent) => {
    try {
      const backend = getAuthenticatedBackend();
      await backend.estate.setAgentActive({ id: a.id, active: !a.isActive });
      setAgents((prev) => prev.map((x) => (x.id === a.id ? { ...x, isActive: !a.isActive } : x)));
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed", variant: "destructive" });
    }
  };

  const removeAgent = async (a: Agent) => {
    if (!confirm(`Delete agent "${a.name}"? This also cancels their billing.`)) return;
    try {
      const backend = getAuthenticatedBackend();
      await backend.estate.deleteAgent({ id: a.id });
      toast({ title: "Deleted", description: `${a.name} removed.` });
      setAgents((prev) => prev.filter((x) => x.id !== a.id));
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to delete", variant: "destructive" });
    }
  };

  if (showForm) {
    return <EstateAgencyForm agencyId={editingId} onClose={() => setShowForm(false)} onSaved={() => setShowForm(false)} />;
  }
  if (showAgentForm) {
    return <EstateAgentForm agentId={editingAgentId} onClose={() => setShowAgentForm(false)} onSaved={() => setShowAgentForm(false)} />;
  }

  const q = query.trim().toLowerCase();
  const norm = (s?: string) => (s || "").trim().toLowerCase();
  const filteredAgencies = q ? agencies.filter((a) => a.name.toLowerCase().includes(q)) : agencies;
  const belongsTo = (x: Agent, a: Agency) => x.agencyId === a.id || (!!norm(x.agencyName) && norm(x.agencyName) === norm(a.name));
  const agentsForAgency = (a: Agency) => agents.filter((x) => belongsTo(x, a));
  const isMatched = (x: Agent) => agencies.some((a) => belongsTo(x, a));
  const independentAgents = (q ? agents.filter((a) => norm(a.name).includes(q) || norm(a.agencyName).includes(q)) : agents).filter((x) => !isMatched(x));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <Input placeholder="Search agencies or agents…" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:max-w-xs" />
        <div className="flex gap-2">
          <Button className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black" onClick={() => { setEditingId(undefined); setShowForm(true); }}>
            + Add Estate Agency
          </Button>
          <Button variant="outline" className="border-[#AEECE4] text-foreground" onClick={() => { setEditingAgentId(undefined); setShowAgentForm(true); }}>
            + Add Estate Agent
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* Agencies, each with its agents nested inside */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Estate Agencies ({filteredAgencies.length})</p>
            {filteredAgencies.length === 0 ? (
              <p className="text-sm text-muted-foreground">{agencies.length === 0 ? "No estate agencies yet." : "No agencies match your search."}</p>
            ) : (
              filteredAgencies.map((a) => {
                const nested = agentsForAgency(a);
                return (
                  <Card key={a.id}>
                    <CardContent className="p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.province || "—"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch checked={a.isActive} onCheckedChange={() => toggleActive(a)} className="data-[state=checked]:bg-green-600" />
                          <span className="text-xs text-muted-foreground">{a.isActive ? "Active" : "Disabled"}</span>
                          <Button variant="outline" size="sm" onClick={() => { setEditingId(a.id); setShowForm(true); }}>Edit</Button>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove(a)}>Delete</Button>
                        </div>
                      </div>

                      <div className="ml-2 pl-3 border-l-2 border-[#AEECE4]/40 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">Estate Agents ({nested.length})</p>
                        {nested.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No estate agents yet.</p>
                        ) : (
                          nested.map((ag) => (
                            <div key={ag.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-2">
                              <div className="min-w-0">
                                <p className="text-sm truncate">{ag.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{[ag.agencyName, ag.province].filter(Boolean).join(" · ") || "—"}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Switch checked={ag.isActive} onCheckedChange={() => toggleAgentActive(ag)} className="data-[state=checked]:bg-green-600" />
                                <span className="text-xs text-muted-foreground">{ag.isActive ? "Active" : "Disabled"}</span>
                                <Button variant="outline" size="sm" onClick={() => { setEditingAgentId(ag.id); setShowAgentForm(true); }}>Edit</Button>
                                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeAgent(ag)}>Delete</Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Independent agents — their typed agency isn't a registered agency */}
          {independentAgents.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Independent Estate Agents ({independentAgents.length})</p>
              {independentAgents.map((ag) => (
                <Card key={ag.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{ag.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{ag.agencyName || "Independent"}{ag.province ? ` · ${ag.province}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={ag.isActive} onCheckedChange={() => toggleAgentActive(ag)} className="data-[state=checked]:bg-green-600" />
                      <span className="text-xs text-muted-foreground">{ag.isActive ? "Active" : "Disabled"}</span>
                      <Button variant="outline" size="sm" onClick={() => { setEditingAgentId(ag.id); setShowAgentForm(true); }}>Edit</Button>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeAgent(ag)}>Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
