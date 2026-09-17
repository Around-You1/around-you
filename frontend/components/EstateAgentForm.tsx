"use client";

// -----------------------------------------------------------------------------
// EstateAgentForm — an Estate Agent's page + property listings (Admin).
//
// Captures the agent's profile (hero photo, bio, up to 10 carousel images,
// agency name, address, contact) and the agent's property listings (each using
// the image-1 criteria via PropertyListingFields). On save it writes the agent
// and every listing to the backend (estate.*), and deletes any listing the user
// removed.
// -----------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { getAuthenticatedBackend } from "../lib/backend";
import { SA_PROVINCES } from "../lib/saRegions";
import ImageUpload from "./ImageUpload";
import MultiImageUpload from "./MultiImageUpload";
import PropertyListingFields, { PropertyListing, newListing } from "./EstatePropertyForm";

const emptyAgent = {
  name: "",
  agencyName: "",
  address: "",
  province: "",
  postalCode: "",
  contactNumber: "",
  email: "",
  bio: "",
  photoUrl: "",
  imageUrls: [] as string[],
};

// "R 1 200 000 / month" -> 120000000 cents (best effort; blank when no digits).
function priceToCents(text: string): number {
  const digits = (text || "").replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number(digits) * 100;
}

export default function EstateAgentForm({
  agentId,
  onClose,
  onSaved,
}: {
  agentId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [agent, setAgent] = useState({ ...emptyAgent });
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(!!agentId);
  const [saving, setSaving] = useState(false);

  const setA = (k: keyof typeof emptyAgent) => (v: any) => setAgent((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!agentId) return;
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const list: any = await backend.estate.listAllAgents();
        const found = (list.agents || []).find((a: any) => a.id === agentId);
        if (found) {
          setAgent({
            name: found.name || "",
            agencyName: found.agencyName || "",
            address: found.address || "",
            province: found.province || "",
            postalCode: found.postalCode || "",
            contactNumber: found.contactNumber || "",
            email: found.email || "",
            bio: found.bio || "",
            photoUrl: found.photoUrl || "",
            imageUrls: found.imageUrls || [],
          });
        }
        const pr: any = await backend.estate.listProperties({ agentId });
        setListings(
          (pr.properties || []).map((p: any) => ({
            id: p.id,
            images: p.imageUrls || [],
            isShowHouse: !!p.showHouse,
            showHouseNumber: String(p.showHouseNumber || 1),
            listingType: p.listingType === "rent" ? "rent" : p.listingType === "sale" ? "sale" : "",
            code: p.code || "",
            price: p.priceText || "",
            bedrooms: p.bedrooms ? String(p.bedrooms) : "",
            bathrooms: p.bathrooms ? String(p.bathrooms) : "",
            garages: p.garages ? String(p.garages) : "",
            url: p.listingUrl || "",
          })),
        );
      } catch (error: any) {
        toast({ title: "Couldn't load", description: error?.message || "Please try again.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [agentId, toast]);

  const updateListing = (i: number, v: PropertyListing) =>
    setListings((prev) => prev.map((x, idx) => (idx === i ? v : x)));

  const removeListing = (i: number) =>
    setListings((prev) => {
      const item = prev[i];
      if (item.id) setRemovedIds((r) => [...r, item.id as number]);
      return prev.filter((_, idx) => idx !== i);
    });

  const handleSave = async () => {
    if (!agent.name.trim()) {
      toast({ title: "Agent name is required", variant: "destructive" });
      return;
    }
    // Validate listings: code, price, beds, baths, garages.
    for (let i = 0; i < listings.length; i++) {
      const l = listings[i];
      const miss: string[] = [];
      if (!l.code.trim()) miss.push("Code");
      if (!l.price.trim()) miss.push("Price");
      if (!l.bedrooms) miss.push("Bedrooms");
      if (!l.bathrooms) miss.push("Bathrooms");
      if (!l.garages) miss.push("Garages");
      if (miss.length) {
        toast({
          title: `Listing #${i + 1} is incomplete`,
          description: `Missing: ${miss.join(", ")}.`,
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const backend = getAuthenticatedBackend();
      const agentPayload: any = { ...agent, isActive: true };
      let savedAgentId = agentId;
      if (agentId) {
        await backend.estate.updateAgent({ id: agentId, ...agentPayload });
      } else {
        const created: any = await backend.estate.createAgent(agentPayload);
        savedAgentId = created?.id;
      }
      if (!savedAgentId) throw new Error("Could not determine the saved agent.");

      for (const id of removedIds) {
        await backend.estate.deleteProperty({ id });
      }

      for (const l of listings) {
        const payload: any = {
          agentId: savedAgentId,
          title: l.code.trim() || "Listing",
          code: l.code.trim(),
          priceText: l.price.trim(),
          priceCents: priceToCents(l.price),
          listingType: l.listingType || "sale",
          bedrooms: Number(l.bedrooms) || 0,
          bathrooms: Number(l.bathrooms) || 0,
          garages: Number(l.garages) || 0,
          imageUrls: l.images,
          showHouse: l.isShowHouse,
          showHouseNumber: l.isShowHouse ? Number(l.showHouseNumber) || 0 : 0,
          listingUrl: l.url.trim(),
          isActive: true,
        };
        if (l.id) {
          await backend.estate.updateProperty({ id: l.id, ...payload });
        } else {
          await backend.estate.createProperty(payload);
        }
      }

      toast({ title: "Saved", description: `${agent.name} and ${listings.length} listing${listings.length === 1 ? "" : "s"} saved.` });
      onSaved();
    } catch (error: any) {
      toast({ title: "Save failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{agentId ? "Edit Estate Agent" : "Add Estate Agent"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Agent name *</Label>
              <Input value={agent.name} onChange={(e) => setA("name")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Agency name</Label>
              <Input value={agent.agencyName} onChange={(e) => setA("agencyName")(e.target.value)} />
            </div>
          </div>

          {/* Hero photo (single) + carousel (up to 10) */}
          <ImageUpload
            label="Agent photo"
            imageUrl={agent.photoUrl}
            onImageUploaded={(url) => setA("photoUrl")(url)}
          />

          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Textarea
              value={agent.bio}
              onChange={(e) => setA("bio")(e.target.value)}
              placeholder="A short introduction the agent shows to buyers/renters."
              rows={4}
            />
          </div>

          <MultiImageUpload
            label="Agent gallery"
            images={agent.imageUrls}
            onChange={(urls) => setA("imageUrls")(urls)}
            maxImages={10}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Contact number</Label>
              <Input value={agent.contactNumber} onChange={(e) => setA("contactNumber")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={agent.email} onChange={(e) => setA("email")(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Province</Label>
              <Select value={agent.province} onValueChange={setA("province")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {SA_PROVINCES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Postal code</Label>
              <Input value={agent.postalCode} onChange={(e) => setA("postalCode")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={agent.address} onChange={(e) => setA("address")(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Property listings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Property listings ({listings.length})</p>
          <Button
            type="button"
            variant="outline"
            className="border-[#AEECE4] text-foreground"
            onClick={() => setListings((prev) => [...prev, newListing()])}
          >
            + Add property listing
          </Button>
        </div>

        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No listings yet. Click “Add property listing”.</p>
        ) : (
          listings.map((l, i) => (
            <PropertyListingFields
              key={l.id ?? `new-${i}`}
              value={l}
              index={i}
              onChange={(v) => updateListing(i, v)}
              onRemove={() => removeListing(i)}
            />
          ))
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black"
        >
          {saving ? "Saving…" : "Save agent"}
        </Button>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
