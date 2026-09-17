"use client";

// -----------------------------------------------------------------------------
// EstatePropertyForm — Real Estate property criteria for an Estate Agent to
// populate (Admin › Real Estate tab).
//
// Phase 1: front-end form only. All fields are captured in local state; the
// "Save listing" button currently just validates and reports the captured
// values. Backend persistence (storing the listing against an agent) and the
// public Agencies → Agent → property display pages are the next phases.
// -----------------------------------------------------------------------------

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import MultiImageUpload from "./MultiImageUpload";

// 1–10 options shared by Bedrooms / Bathrooms / Garages and the show-house number.
const ONE_TO_TEN = Array.from({ length: 10 }, (_, i) => String(i + 1));

const emptyListing = {
  images: [] as string[],
  isShowHouse: false,
  showHouseNumber: "1",
  code: "",
  price: "",
  bedrooms: "",
  bathrooms: "",
  garages: "",
  url: "",
};

export default function EstatePropertyForm({
  onSaved,
}: {
  onSaved?: (listing: typeof emptyListing) => void;
}) {
  const { toast } = useToast();
  const [listing, setListing] = useState({ ...emptyListing });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof emptyListing>(key: K, value: (typeof emptyListing)[K]) =>
    setListing((s) => ({ ...s, [key]: value }));

  const handleSave = async () => {
    // Required: code, price, bedrooms, bathrooms, garages.
    const missing: string[] = [];
    if (!listing.code.trim()) missing.push("Code");
    if (!listing.price.trim()) missing.push("Price");
    if (!listing.bedrooms) missing.push("Bedrooms");
    if (!listing.bathrooms) missing.push("Bathrooms");
    if (!listing.garages) missing.push("Garages");
    if (missing.length > 0) {
      toast({
        title: "Please complete all fields",
        description: `Missing: ${missing.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Phase 2 will send this to the backend (e.g. backend.estate.createProperty).
      onSaved?.(listing);
      toast({
        title: "Listing captured",
        description: "Saving to the database will be wired up in the next phase.",
      });
    } finally {
      setSaving(false);
    }
  };

  const numberSelect = (
    value: string,
    onChange: (v: string) => void,
    placeholder = "Select…",
  ) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {ONE_TO_TEN.map((n) => (
          <SelectItem key={n} value={n}>
            {n}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Property Listing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Carousel of up to 10 images (drag & drop) */}
        <MultiImageUpload
          label="Property images"
          images={listing.images}
          onChange={(urls) => set("images", urls)}
          maxImages={10}
        />

        {/* Show House + number 1/10 */}
        <div className="flex items-center gap-3">
          <Checkbox
            id="showHouse"
            checked={listing.isShowHouse}
            onCheckedChange={(v) => set("isShowHouse", v === true)}
          />
          <Label htmlFor="showHouse" className="cursor-pointer">
            Show House
          </Label>
          {listing.isShowHouse && (
            <div className="w-24">
              {numberSelect(listing.showHouseNumber, (v) => set("showHouseNumber", v), "1")}
            </div>
          )}
        </div>

        {/* Code */}
        <div className="space-y-1.5">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            value={listing.code}
            onChange={(e) => set("code", e.target.value)}
            placeholder="Agent contact / listing code"
          />
        </div>

        {/* Price */}
        <div className="space-y-1.5">
          <Label htmlFor="price">Price</Label>
          <Input
            id="price"
            value={listing.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="e.g. R 1 200 000 or R 6 000 / month"
          />
        </div>

        {/* Bedrooms / Bathrooms / Garages */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Bedrooms</Label>
            {numberSelect(listing.bedrooms, (v) => set("bedrooms", v))}
          </div>
          <div className="space-y-1.5">
            <Label>Bathrooms</Label>
            {numberSelect(listing.bathrooms, (v) => set("bathrooms", v))}
          </div>
          <div className="space-y-1.5">
            <Label>Garages</Label>
            {numberSelect(listing.garages, (v) => set("garages", v))}
          </div>
        </div>

        {/* URL */}
        <div className="space-y-1.5">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            type="url"
            value={listing.url}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black"
          >
            {saving ? "Saving…" : "Save listing"}
          </Button>
          <Button variant="outline" onClick={() => setListing({ ...emptyListing })} disabled={saving}>
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
