"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import EstateAgencyForm from "./EstateAgencyForm";

interface Agency {
  id: number;
  name: string;
  province: string;
  isActive: boolean;
  createAgentPages: boolean;
}

export default function EstateTab() {
  const { toast } = useToast();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const backend = getAuthenticatedBackend();
      const res: any = await backend.estate.listAgencies();
      setAgencies((res.agencies || []) as Agency[]);
    } catch (error: any) {
      toast({ title: "Couldn't load agencies", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!showForm) load();
  }, [showForm, load]);

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

  if (showForm) {
    return (
      <EstateAgencyForm
        agencyId={editingId}
        onClose={() => setShowForm(false)}
        onSaved={() => setShowForm(false)}
      />
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? agencies.filter((a) => a.name.toLowerCase().includes(q)) : agencies;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <Input placeholder="Search agencies…" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:max-w-xs" />
        <Button className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black" onClick={() => { setEditingId(undefined); setShowForm(true); }}>
          + Add Estate Agency
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{agencies.length === 0 ? "No estate agencies yet." : "No agencies match your search."}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.province || "—"}{a.createAgentPages ? " · has agent pages" : ""}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={a.isActive} onCheckedChange={() => toggleActive(a)} className="data-[state=checked]:bg-green-600" />
                  <span className="text-xs text-muted-foreground">{a.isActive ? "Active" : "Disabled"}</span>
                  <Button variant="outline" size="sm" onClick={() => { setEditingId(a.id); setShowForm(true); }}>Edit</Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove(a)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
