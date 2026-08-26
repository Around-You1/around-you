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

const PROPERTY_TYPES = ["House", "Apartment", "Townhouse", "Plot", "Farm", "Commercial", "Land", "Industrial"];
const FEATURES = ["Pool", "Tennis Court", "Garden", "Security Estate", "Double Garage", "Borehole", "Solar", "Fibre", "Sea View", "Mountain View", "Pet Friendly", "Fireplace", "Staff Quarters", "Backup Power"];
const SA_PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];

const emptyOfficial = (): OfficialUseData => ({
  officialHoldingCompany: "", officialContactName: "", officialContactNumber: "", officialEmail: "",
  officialRepCode: "", officialRepName: "", companyRegNumber: "", companyVatNumber: "", guestType: "", accessLevel: "",
});

interface PropertyRow {
  id?: number;
  title: string;
  propertyType: string;
  plotSizeM2: string;
  houseSizeM2: string;
  bedrooms: string;
  bathrooms: string;
  garages: string;
  features: string[];
  priceRand: string;
  listingType: string; // sale | rent
  address: string;
  province: string;
  country: string;
  postalCode: string;
  description: string;
  imageUrls: string[];
  agentRef: number; // index into agents[], or -1 = none
  isActive: boolean;
}

interface AgentRow {
  id?: number;
  name: string;
  photoUrl: string;
  contactNumber: string;
  email: string;
  bio: string;
  officialRepCode: string;
  officialRepName: string;
  isActive: boolean;
  profileReferenceCode?: string;
}

const newProperty = (): PropertyRow => ({
  title: "", propertyType: "House", plotSizeM2: "", houseSizeM2: "", bedrooms: "", bathrooms: "", garages: "",
  features: [], priceRand: "", listingType: "sale", address: "", province: "", country: "South Africa", postalCode: "",
  description: "", imageUrls: [], agentRef: -1, isActive: true,
});
const newAgent = (): AgentRow => ({
  name: "", photoUrl: "", contactNumber: "", email: "", bio: "", officialRepCode: "", officialRepName: "", isActive: true,
});

export default function EstateAgencyForm({
  agencyId,
  onClose,
  onSaved,
  defaultRepCode,
  defaultRepName,
}: {
  agencyId?: number;
  onClose: () => void;
  onSaved: () => void;
  defaultRepCode?: string;
  defaultRepName?: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(!!agencyId);
  const [saving, setSaving] = useState(false);

  const [agency, setAgency] = useState({
    name: "", description: "", address: "", province: "", country: "South Africa", postalCode: "",
    contactNumber: "", email: "", latitude: "", longitude: "", imageUrls: [] as string[],
    createAgentPages: false, isActive: true, profileReferenceCode: "",
  });
  const [official, setOfficial] = useState<OfficialUseData>(() => ({
    ...emptyOfficial(),
    officialRepCode: defaultRepCode || "",
    officialRepName: defaultRepName || "",
  }));
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [deletedProps, setDeletedProps] = useState<number[]>([]);
  const [deletedAgents, setDeletedAgents] = useState<number[]>([]);

  useEffect(() => {
    if (!agencyId) return;
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const a: any = await backend.estate.getAgency({ id: agencyId });
        setAgency({
          name: a.name || "", description: a.description || "", address: a.address || "", province: a.province || "",
          country: a.country || "South Africa", postalCode: a.postalCode || "", contactNumber: a.contactNumber || "",
          email: a.email || "", latitude: a.latitude != null ? String(a.latitude) : "", longitude: a.longitude != null ? String(a.longitude) : "",
          imageUrls: a.imageUrls || [], createAgentPages: !!a.createAgentPages, isActive: a.isActive !== false,
          profileReferenceCode: a.profileReferenceCode || "",
        });
        setOfficial({
          officialHoldingCompany: a.officialHoldingCompany || "", officialContactName: a.officialContactName || "",
          officialContactNumber: a.officialContactNumber || "", officialEmail: a.officialEmail || "",
          officialRepCode: a.officialRepCode || "", officialRepName: a.officialRepName || "",
          companyRegNumber: a.companyRegNumber || "", companyVatNumber: a.companyVatNumber || "", guestType: "", accessLevel: "",
        });
        const cats = await loadCharity("estate_agency", agencyId);
        setOfficial((o) => ({ ...o, charity: cats }));
        const ag: any = await backend.estate.listAgents({ agencyId });
        const agentList: AgentRow[] = (ag.agents || []).map((x: any) => ({
          id: x.id, name: x.name || "", photoUrl: x.photoUrl || "", contactNumber: x.contactNumber || "",
          email: x.email || "", bio: x.bio || "", officialRepCode: x.officialRepCode || "", officialRepName: x.officialRepName || "",
          isActive: x.isActive !== false, profileReferenceCode: x.profileReferenceCode || "",
        }));
        setAgents(agentList);
        const pr: any = await backend.estate.listProperties({ agencyId });
        setProperties((pr.properties || []).map((p: any) => ({
          id: p.id, title: p.title || "", propertyType: p.propertyType || "House",
          plotSizeM2: p.plotSizeM2 ? String(p.plotSizeM2) : "", houseSizeM2: p.houseSizeM2 ? String(p.houseSizeM2) : "",
          bedrooms: p.bedrooms ? String(p.bedrooms) : "", bathrooms: p.bathrooms ? String(p.bathrooms) : "", garages: p.garages ? String(p.garages) : "",
          features: p.features || [], priceRand: p.priceCents ? String(p.priceCents / 100) : "", listingType: p.listingType || "sale",
          address: p.address || "", province: p.province || "", country: p.country || "South Africa", postalCode: p.postalCode || "",
          description: p.description || "", imageUrls: p.imageUrls || [],
          agentRef: p.agentId ? agentList.findIndex((a) => a.id === p.agentId) : -1, isActive: p.isActive !== false,
        })));
      } catch (error: any) {
        toast({ title: "Couldn't load agency", description: error?.message || "Please try again.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  const activeAgentCount = agents.filter((a) => a.isActive).length;
  const monthly = 300 * (1 + activeAgentCount);

  const setProp = (i: number, patch: Partial<PropertyRow>) =>
    setProperties((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const setAg = (i: number, patch: Partial<AgentRow>) =>
    setAgents((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const removeProperty = (i: number) => {
    const p = properties[i];
    if (p.id) setDeletedProps((d) => [...d, p.id!]);
    setProperties((prev) => prev.filter((_, idx) => idx !== i));
  };
  const removeAgent = (i: number) => {
    const a = agents[i];
    if (a.id) setDeletedAgents((d) => [...d, a.id!]);
    // Un-assign any properties pointing at this agent index.
    setProperties((prev) => prev.map((p) => (p.agentRef === i ? { ...p, agentRef: -1 } : (p.agentRef > i ? { ...p, agentRef: p.agentRef - 1 } : p))));
    setAgents((prev) => prev.filter((_, idx) => idx !== i));
  };

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const handleSave = async () => {
    if (!agency.name.trim()) {
      toast({ title: "Agency name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const backend = getAuthenticatedBackend();
      const agencyPayload = {
        ...(agencyId ? { id: agencyId } : {}),
        name: agency.name, description: agency.description, address: agency.address, province: agency.province,
        country: agency.country, postalCode: agency.postalCode, contactNumber: agency.contactNumber, email: agency.email,
        latitude: num(agency.latitude), longitude: num(agency.longitude),
        imageUrl: agency.imageUrls[0] || "", imageUrls: agency.imageUrls,
        createAgentPages: agency.createAgentPages, isActive: agency.isActive,
        officialHoldingCompany: official.officialHoldingCompany, officialContactName: official.officialContactName,
        officialContactNumber: official.officialContactNumber, officialEmail: official.officialEmail,
        officialRepCode: official.officialRepCode, officialRepName: official.officialRepName,
        companyRegNumber: official.companyRegNumber, companyVatNumber: official.companyVatNumber,
      };
      const savedAgency: any = agencyId
        ? await backend.estate.updateAgency(agencyPayload)
        : await backend.estate.createAgency(agencyPayload);
      const newAgencyId = savedAgency.id;
      await saveCharity("estate_agency", newAgencyId, official.charity || []);

      // Delete removed agents/properties.
      for (const id of deletedAgents) await backend.estate.deleteAgent({ id });
      for (const id of deletedProps) await backend.estate.deleteProperty({ id });

      // Save agents; keep a map from array index -> saved id (for property links).
      const agentIdByIndex: (number | null)[] = [];
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        const payload = {
          ...(a.id ? { id: a.id } : {}), agencyId: newAgencyId, name: a.name, photoUrl: a.photoUrl,
          contactNumber: a.contactNumber, email: a.email, bio: a.bio,
          officialRepCode: a.officialRepCode || official.officialRepCode, officialRepName: a.officialRepName || official.officialRepName,
          isActive: a.isActive,
        };
        const saved: any = a.id ? await backend.estate.updateAgent(payload) : await backend.estate.createAgent(payload);
        agentIdByIndex[i] = saved.id;
      }

      // Save properties with resolved agent ids.
      for (const p of properties) {
        const payload = {
          ...(p.id ? { id: p.id } : {}), agencyId: newAgencyId,
          agentId: p.agentRef >= 0 ? agentIdByIndex[p.agentRef] : null,
          title: p.title, propertyType: p.propertyType, plotSizeM2: num(p.plotSizeM2), houseSizeM2: num(p.houseSizeM2),
          bedrooms: num(p.bedrooms), bathrooms: num(p.bathrooms), garages: num(p.garages), features: p.features,
          priceCents: p.priceRand.trim() ? Math.round(Number(p.priceRand) * 100) : 0, listingType: p.listingType,
          address: p.address, province: p.province, country: p.country, postalCode: p.postalCode,
          description: p.description, imageUrl: p.imageUrls[0] || "", imageUrls: p.imageUrls, isActive: p.isActive,
        };
        if (p.id) await backend.estate.updateProperty(payload);
        else await backend.estate.createProperty(payload);
      }

      toast({ title: "Saved", description: `${agency.name} saved. Billing: R${monthly}/mo.` });
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
        <CardTitle>{agencyId ? "Edit Estate Agency" : "Add Estate Agency"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <OfficialUseSection data={official} onChange={setOfficial} showTierFields={false} />

        {/* Agency */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Agency Name *</Label>
            <Input value={agency.name} onChange={(e) => setAgency({ ...agency, name: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea rows={3} value={agency.description} onChange={(e) => setAgency({ ...agency, description: e.target.value })} />
          </div>
          <div className="space-y-2"><Label>Address</Label><Input value={agency.address} onChange={(e) => setAgency({ ...agency, address: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Province</Label>
            <Select value={agency.province} onValueChange={(v) => setAgency({ ...agency, province: v })}>
              <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
              <SelectContent>{SA_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Country</Label><Input value={agency.country} onChange={(e) => setAgency({ ...agency, country: e.target.value })} /></div>
          <div className="space-y-2"><Label>Postal Code</Label><Input value={agency.postalCode} onChange={(e) => setAgency({ ...agency, postalCode: e.target.value })} /></div>
          <div className="space-y-2"><Label>Contact Number</Label><Input value={agency.contactNumber} onChange={(e) => setAgency({ ...agency, contactNumber: e.target.value })} /></div>
          <div className="space-y-2"><Label>Email</Label><Input value={agency.email} onChange={(e) => setAgency({ ...agency, email: e.target.value })} /></div>
          <div className="space-y-2"><Label>Latitude</Label><Input type="number" step="any" value={agency.latitude} onChange={(e) => setAgency({ ...agency, latitude: e.target.value })} /></div>
          <div className="space-y-2"><Label>Longitude</Label><Input type="number" step="any" value={agency.longitude} onChange={(e) => setAgency({ ...agency, longitude: e.target.value })} /></div>
        </div>

        <MultiImageUpload label="Agency Images" images={agency.imageUrls} maxImages={10} onChange={(urls) => setAgency({ ...agency, imageUrls: urls })} />

        {agencyId && (
          <ProfileReferenceCodeDisplay entityType="estate_agency" entityId={agencyId} currentCode={agency.profileReferenceCode} />
        )}

        <div className="flex items-center gap-2">
          <Switch checked={agency.isActive} onCheckedChange={(v) => setAgency({ ...agency, isActive: v })} />
          <Label>Active</Label>
        </div>

        {/* Properties */}
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

        <p className="text-xs text-muted-foreground">
          Estate Agents are now added separately via the <strong>+ Add Estate Agent</strong> button on the Real Estate tab.
        </p>

        <div className="rounded-lg border border-[#AEECE4] bg-[#AEECE4]/10 p-3 text-sm">
          <strong>Billing:</strong> R300/month for this agency.
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black">
            {saving ? "Saving…" : agencyId ? "Update Agency" : "Create Agency"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
