"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import MultiImageUpload from "./MultiImageUpload";
import OfficialUseSection, { type OfficialUseData } from "./OfficialUseSection";
import ProfileReferenceCodeDisplay from "./ProfileReferenceCodeDisplay";

const SA_PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];

const emptyOfficial = (): OfficialUseData => ({
  officialHoldingCompany: "", officialContactName: "", officialContactNumber: "", officialEmail: "",
  officialRepCode: "", officialRepName: "", companyRegNumber: "", companyVatNumber: "", guestType: "", accessLevel: "",
});

// Standalone Estate Agent: a self-paying profile (R300/mo). Not linked to an
// agency record — the agent simply types the agency name they work under.
export default function EstateAgentForm({
  agentId,
  onClose,
  onSaved,
  defaultRepCode,
  defaultRepName,
}: {
  agentId?: number;
  onClose: () => void;
  onSaved: () => void;
  defaultRepCode?: string;
  defaultRepName?: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(!!agentId);
  const [saving, setSaving] = useState(false);

  const [agent, setAgent] = useState({
    name: "", agencyName: "", address: "", province: "", postalCode: "",
    latitude: "", longitude: "", contactNumber: "", email: "", bio: "",
    photoUrl: "", isActive: true, profileReferenceCode: "",
  });
  const [official, setOfficial] = useState<OfficialUseData>(() => ({
    ...emptyOfficial(),
    officialRepCode: defaultRepCode || "",
    officialRepName: defaultRepName || "",
  }));

  useEffect(() => {
    if (!agentId) return;
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const list: any = await backend.estate.listAllAgents();
        const a = (list.agents || []).find((x: any) => x.id === agentId);
        if (a) {
          setAgent({
            name: a.name || "", agencyName: a.agencyName || "", address: a.address || "", province: a.province || "",
            postalCode: a.postalCode || "", latitude: a.latitude != null ? String(a.latitude) : "",
            longitude: a.longitude != null ? String(a.longitude) : "", contactNumber: a.contactNumber || "",
            email: a.email || "", bio: a.bio || "", photoUrl: a.photoUrl || "", isActive: a.isActive !== false,
            profileReferenceCode: a.profileReferenceCode || "",
          });
          setOfficial({
            officialHoldingCompany: a.officialHoldingCompany || "", officialContactName: a.officialContactName || "",
            officialContactNumber: a.officialContactNumber || "", officialEmail: a.officialEmail || "",
            officialRepCode: a.officialRepCode || "", officialRepName: a.officialRepName || "",
            companyRegNumber: a.companyRegNumber || "", companyVatNumber: a.companyVatNumber || "", guestType: "", accessLevel: "",
          });
        }
      } catch (error: any) {
        toast({ title: "Couldn't load agent", description: error?.message || "Please try again.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const handleSave = async () => {
    if (!agent.name.trim()) { toast({ title: "Agent name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const backend = getAuthenticatedBackend();
      const payload = {
        ...(agentId ? { id: agentId } : {}),
        name: agent.name, agencyName: agent.agencyName, address: agent.address, province: agent.province,
        postalCode: agent.postalCode, latitude: num(agent.latitude), longitude: num(agent.longitude),
        contactNumber: agent.contactNumber, email: agent.email, bio: agent.bio, photoUrl: agent.photoUrl,
        officialHoldingCompany: official.officialHoldingCompany, officialContactName: official.officialContactName,
        officialContactNumber: official.officialContactNumber, officialEmail: official.officialEmail,
        officialRepCode: official.officialRepCode, officialRepName: official.officialRepName,
        companyRegNumber: official.companyRegNumber, companyVatNumber: official.companyVatNumber,
        isActive: agent.isActive,
      };
      if (agentId) await backend.estate.updateAgent(payload);
      else await backend.estate.createAgent(payload);
      toast({ title: "Saved", description: `${agent.name} saved. Billing: R300/mo.` });
      onSaved();
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading…</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{agentId ? "Edit Estate Agent" : "Add Estate Agent"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <OfficialUseSection data={official} onChange={setOfficial} showTierFields={false} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Agent Name *</Label><Input value={agent.name} onChange={(e) => setAgent({ ...agent, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Agency Name</Label><Input value={agent.agencyName} onChange={(e) => setAgent({ ...agent, agencyName: e.target.value })} placeholder="The agency this agent works under" /></div>
          <div className="space-y-2 md:col-span-2"><Label>Address</Label><Input value={agent.address} onChange={(e) => setAgent({ ...agent, address: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Province</Label>
            <Select value={agent.province} onValueChange={(v) => setAgent({ ...agent, province: v })}>
              <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
              <SelectContent>{SA_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Postal Code</Label><Input value={agent.postalCode} onChange={(e) => setAgent({ ...agent, postalCode: e.target.value })} /></div>
          <div className="space-y-2"><Label>Latitude</Label><Input type="number" step="any" value={agent.latitude} onChange={(e) => setAgent({ ...agent, latitude: e.target.value })} /></div>
          <div className="space-y-2"><Label>Longitude</Label><Input type="number" step="any" value={agent.longitude} onChange={(e) => setAgent({ ...agent, longitude: e.target.value })} /></div>
          <div className="space-y-2"><Label>Contact Number</Label><Input value={agent.contactNumber} onChange={(e) => setAgent({ ...agent, contactNumber: e.target.value })} /></div>
          <div className="space-y-2"><Label>Email</Label><Input value={agent.email} onChange={(e) => setAgent({ ...agent, email: e.target.value })} /></div>
          <div className="space-y-2 md:col-span-2"><Label>Bio</Label><Textarea rows={3} value={agent.bio} onChange={(e) => setAgent({ ...agent, bio: e.target.value })} /></div>
        </div>

        <MultiImageUpload label="Agent Photo" images={agent.photoUrl ? [agent.photoUrl] : []} maxImages={1} onChange={(urls) => setAgent({ ...agent, photoUrl: urls[0] || "" })} />

        {agentId && (
          <ProfileReferenceCodeDisplay entityType="estate_agent" entityId={agentId} currentCode={agent.profileReferenceCode} />
        )}

        <div className="flex items-center gap-2">
          <Switch checked={agent.isActive} onCheckedChange={(v) => setAgent({ ...agent, isActive: v })} />
          <Label>Active (billed R300/month)</Label>
        </div>

        <div className="rounded-lg border border-[#AEECE4] bg-[#AEECE4]/10 p-3 text-sm">
          <strong>Billing:</strong> R300/month for this agent profile.
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black">
            {saving ? "Saving…" : agentId ? "Update Agent" : "Create Agent"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
