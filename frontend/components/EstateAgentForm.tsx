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
import { loadCharity, saveCharity } from "../lib/charity";

const SA_PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];
const PROPERTY_TYPES = ["House", "Apartment", "Townhouse", "Plot", "Farm", "Commercial", "Land", "Industrial"];
const FEATURES = ["Pool", "Tennis Court", "Garden", "Security Estate", "Double Garage", "Borehole", "Solar", "Fibre", "Sea View", "Mountain View", "Pet Friendly", "Fireplace", "Staff Quarters", "Backup Power"];

interface PropertyRow {
  id?: number;
  title: string; propertyType: string; listingType: string; priceRand: string;
  plotSizeM2: string; houseSizeM2: string; bedrooms: string; bathrooms: string; garages: string;
  features: string[]; address: string; province: string; postalCode: string; description: string;
  imageUrls: string[]; isActive: boolean;
}
const newProperty = (): PropertyRow => ({
  title: "", propertyType: "House", listingType: "sale", priceRand: "", plotSizeM2: "", houseSizeM2: "",
  bedrooms: "", bathrooms: "", garages: "", features: [], address: "", province: "", postalCode: "",
  description: "", imageUrls: [], isActive: true,
});

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
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [deletedProps, setDeletedProps] = useState<number[]>([]);

  const setProp = (i: number, patch: Partial<PropertyRow>) =>
    setProperties((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removeProperty = (i: number) => {
    const p = properties[i];
    if (p.id) setDeletedProps((d) => [...d, p.id!]);
    setProperties((prev) => prev.filter((_, idx) => idx !== i));
  };

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
        const cats = await loadCharity("estate_agent", agentId);
        setOfficial((o) => ({ ...o, charity: cats }));
        const pr: any = await backend.estate.listProperties({ agentId });
        setProperties((pr.properties || []).map((p: any) => ({
          id: p.id, title: p.title || "", propertyType: p.propertyType || "House", listingType: p.listingType || "sale",
          priceRand: p.priceCents ? String(p.priceCents / 100) : "", plotSizeM2: p.plotSizeM2 ? String(p.plotSizeM2) : "",
          houseSizeM2: p.houseSizeM2 ? String(p.houseSizeM2) : "", bedrooms: p.bedrooms ? String(p.bedrooms) : "",
          bathrooms: p.bathrooms ? String(p.bathrooms) : "", garages: p.garages ? String(p.garages) : "",
          features: p.features || [], address: p.address || "", province: p.province || "", postalCode: p.postalCode || "",
          description: p.description || "", imageUrls: p.imageUrls || [], isActive: p.isActive !== false,
        })));
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
      const saved: any = agentId ? await backend.estate.updateAgent(payload) : await backend.estate.createAgent(payload);
      const newAgentId = saved.id;
      await saveCharity("estate_agent", newAgentId, official.charity || []);

      for (const id of deletedProps) await backend.estate.deleteProperty({ id });
      for (const p of properties) {
        const propPayload = {
          ...(p.id ? { id: p.id } : {}), agentId: newAgentId,
          title: p.title, propertyType: p.propertyType, listingType: p.listingType,
          priceCents: p.priceRand.trim() ? Math.round(Number(p.priceRand) * 100) : 0,
          plotSizeM2: num(p.plotSizeM2), houseSizeM2: num(p.houseSizeM2),
          bedrooms: num(p.bedrooms), bathrooms: num(p.bathrooms), garages: num(p.garages),
          features: p.features, address: p.address, province: p.province, country: "South Africa", postalCode: p.postalCode,
          description: p.description, imageUrl: p.imageUrls[0] || "", imageUrls: p.imageUrls, isActive: p.isActive,
        };
        if (p.id) await backend.estate.updateProperty(propPayload);
        else await backend.estate.createProperty(propPayload);
      }

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

        {/* Properties listed by this agent */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Properties ({properties.length})</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setProperties((p) => [...p, newProperty()])}>+ Add Property</Button>
          </div>
          {properties.map((p, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Property {i + 1}</span>
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeProperty(i)}>Remove</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1 md:col-span-2"><Label className="text-xs">Title *</Label><Input value={p.title} onChange={(e) => setProp(i, { title: e.target.value })} /></div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={p.propertyType} onValueChange={(v) => setProp(i, { propertyType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PROPERTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">For Sale / Rent</Label>
                    <Select value={p.listingType} onValueChange={(v) => setProp(i, { listingType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="sale">For Sale</SelectItem><SelectItem value="rent">For Rent</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Price (R)</Label><Input type="number" value={p.priceRand} onChange={(e) => setProp(i, { priceRand: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Plot Size (m²)</Label><Input type="number" value={p.plotSizeM2} onChange={(e) => setProp(i, { plotSizeM2: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">House Size (m²)</Label><Input type="number" value={p.houseSizeM2} onChange={(e) => setProp(i, { houseSizeM2: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Bedrooms</Label><Input type="number" value={p.bedrooms} onChange={(e) => setProp(i, { bedrooms: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Bathrooms</Label><Input type="number" value={p.bathrooms} onChange={(e) => setProp(i, { bathrooms: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Garages</Label><Input type="number" value={p.garages} onChange={(e) => setProp(i, { garages: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Address</Label><Input value={p.address} onChange={(e) => setProp(i, { address: e.target.value })} /></div>
                  <div className="space-y-1">
                    <Label className="text-xs">Province</Label>
                    <Select value={p.province} onValueChange={(v) => setProp(i, { province: v })}>
                      <SelectTrigger><SelectValue placeholder="Province" /></SelectTrigger>
                      <SelectContent>{SA_PROVINCES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Postal Code</Label><Input value={p.postalCode} onChange={(e) => setProp(i, { postalCode: e.target.value })} /></div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Features</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {FEATURES.map((f) => (
                      <label key={f} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="accent-green-600" checked={p.features.includes(f)}
                          onChange={() => setProp(i, { features: p.features.includes(f) ? p.features.filter((x) => x !== f) : [...p.features, f] })} />
                        {f}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea rows={3} value={p.description} onChange={(e) => setProp(i, { description: e.target.value })} /></div>
                <MultiImageUpload label="Property Images" images={p.imageUrls} maxImages={10} onChange={(urls) => setProp(i, { imageUrls: urls })} />
                <div className="flex items-center gap-2"><Switch checked={p.isActive} onCheckedChange={(v) => setProp(i, { isActive: v })} /><Label className="text-xs">Active</Label></div>
              </CardContent>
            </Card>
          ))}
        </div>

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
