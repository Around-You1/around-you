"use client";

// -----------------------------------------------------------------------------
// EstateAgencyForm — an Estate Agency page (Admin).
//
// Captures the agency's logo (single image), name, address, province and
// contact details. Agents are managed separately (they link to an agency by
// name); the public Agencies landing lists agencies and, under each, its agents.
// -----------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const emptyAgency = {
  name: "",
  imageUrl: "",
  address: "",
  province: "",
  postalCode: "",
  contactNumber: "",
  email: "",
};

export default function EstateAgencyForm({
  agencyId,
  onClose,
  onSaved,
}: {
  agencyId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [agency, setAgency] = useState({ ...emptyAgency });
  const [loading, setLoading] = useState(!!agencyId);
  const [saving, setSaving] = useState(false);

  const setA = (k: keyof typeof emptyAgency) => (v: any) => setAgency((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!agencyId) return;
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const a: any = await backend.estate.getAgency({ id: agencyId });
        setAgency({
          name: a.name || "",
          imageUrl: a.imageUrl || "",
          address: a.address || "",
          province: a.province || "",
          postalCode: a.postalCode || "",
          contactNumber: a.contactNumber || "",
          email: a.email || "",
        });
      } catch (error: any) {
        toast({ title: "Couldn't load", description: error?.message || "Please try again.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [agencyId, toast]);

  const handleSave = async () => {
    if (!agency.name.trim()) {
      toast({ title: "Agency name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const backend = getAuthenticatedBackend();
      const payload: any = { ...agency, isActive: true };
      if (agencyId) {
        await backend.estate.updateAgency({ id: agencyId, ...payload });
      } else {
        await backend.estate.createAgency(payload);
      }
      toast({ title: "Saved", description: `${agency.name} saved.` });
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
    <Card>
      <CardHeader>
        <CardTitle>{agencyId ? "Edit Estate Agency" : "Add Estate Agency"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ImageUpload
          label="Agency logo"
          imageUrl={agency.imageUrl}
          onImageUploaded={(url) => setA("imageUrl")(url)}
        />

        <div className="space-y-1.5">
          <Label>Agency name *</Label>
          <Input value={agency.name} onChange={(e) => setA("name")(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Address</Label>
          <Input value={agency.address} onChange={(e) => setA("address")(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Province</Label>
            <Select value={agency.province} onValueChange={setA("province")}>
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
            <Input value={agency.postalCode} onChange={(e) => setA("postalCode")(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Contact number</Label>
            <Input value={agency.contactNumber} onChange={(e) => setA("contactNumber")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={agency.email} onChange={(e) => setA("email")(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black"
          >
            {saving ? "Saving…" : "Save agency"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
