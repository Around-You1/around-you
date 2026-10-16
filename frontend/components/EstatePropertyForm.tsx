"use client";

// -----------------------------------------------------------------------------
// Property listing fields — one property an Estate Agent lists (image 1 spec):
// 10-image carousel, Show House / Sale / Rent, Code, Price, Bedrooms, Bathrooms,
// Garages, URL.
//
// Controlled component: the parent (EstateAgentForm) owns the array of listings,
// the collapse/accordion shell, the Remove button, and the show-house numbering.
// Ticking "Show House" just flips isShowHouse; the parent assigns the number and
// this component shows it as "N / 10".
// -----------------------------------------------------------------------------

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
import { Textarea } from "@/components/ui/textarea";
import MultiImageUpload from "./MultiImageUpload";

const ONE_TO_TEN = Array.from({ length: 10 }, (_, i) => String(i + 1));
// Keep in step with PROPERTY_TYPES / FEATURES in EstateRepFlow.tsx.
const PROPERTY_TYPES = ["House", "Apartment", "Townhouse", "Plot", "Farm", "Commercial", "Land", "Industrial"];
const FEATURES = ["Pool", "Tennis Court", "Garden", "Security Estate", "Double Garage", "Borehole", "Solar", "Fibre", "Sea View", "Mountain View", "Pet Friendly", "Fireplace", "Staff Quarters", "Backup Power"];

export interface PropertyListing {
  id?: number; // set for listings already saved in the database
  images: string[];
  isShowHouse: boolean;
  showHouseNumber: number; // 1..10 when isShowHouse (assigned by the parent), else 0
  listingType: "" | "sale" | "rent";
  propertyType: string; // House / Apartment / Plot / …
  title: string;
  code: string;
  price: string; // free text
  bedrooms: string; // "1".."10"
  bathrooms: string;
  garages: string;
  plotSizeM2: string;
  houseSizeM2: string;
  features: string[];
  address: string;
  description: string;
  url: string;
  videoUrl: string;
}

export const newListing = (): PropertyListing => ({
  images: [],
  isShowHouse: false,
  showHouseNumber: 0,
  listingType: "",
  propertyType: "",
  title: "",
  code: "",
  price: "",
  bedrooms: "",
  bathrooms: "",
  garages: "",
  plotSizeM2: "",
  houseSizeM2: "",
  features: [],
  address: "",
  description: "",
  url: "",
  videoUrl: "",
});

function numberSelect(value: string, onChange: (v: string) => void, placeholder = "Select…") {
  return (
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
}

export default function PropertyListingFields({
  value,
  onChange,
}: {
  value: PropertyListing;
  onChange: (v: PropertyListing) => void;
}) {
  const set = <K extends keyof PropertyListing>(key: K, v: PropertyListing[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-6 p-4">
      {/* Carousel of up to 10 images (drag & drop) */}
      <MultiImageUpload
        label="Property images"
        images={value.images}
        onChange={(urls) => set("images", urls)}
        maxImages={10}
      />

      {/* Title */}
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Sea-view family home"
        />
      </div>

      {/* Show House (auto-numbered), Sale, Rent */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={value.isShowHouse}
            onCheckedChange={(v) => set("isShowHouse", v === true)}
          />
          <Label className="cursor-pointer">Show House</Label>
          {value.isShowHouse && value.showHouseNumber > 0 && (
            <span className="text-sm font-bold text-[#00C7BE]">{value.showHouseNumber} / 10</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={value.listingType === "sale"}
            onCheckedChange={(v) => set("listingType", v === true ? "sale" : "")}
          />
          <Label className="cursor-pointer">Sale</Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={value.listingType === "rent"}
            onCheckedChange={(v) => set("listingType", v === true ? "rent" : "")}
          />
          <Label className="cursor-pointer">Rent</Label>
        </div>
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={value.propertyType} onValueChange={(v) => set("propertyType", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select property type…" />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Code */}
      <div className="space-y-1.5">
        <Label>Code</Label>
        <Input
          value={value.code}
          onChange={(e) => set("code", e.target.value)}
          placeholder="Agent contact / listing code"
        />
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <Label>Price</Label>
        <Input
          value={value.price}
          onChange={(e) => set("price", e.target.value)}
          placeholder="e.g. R 1 200 000 or R 6 000 / month"
        />
      </div>

      {/* Bedrooms / Bathrooms / Garages */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Bedrooms</Label>
          {numberSelect(value.bedrooms, (v) => set("bedrooms", v))}
        </div>
        <div className="space-y-1.5">
          <Label>Bathrooms</Label>
          {numberSelect(value.bathrooms, (v) => set("bathrooms", v))}
        </div>
        <div className="space-y-1.5">
          <Label>Garages</Label>
          {numberSelect(value.garages, (v) => set("garages", v))}
        </div>
      </div>

      {/* Plot / House size */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Plot size (m²)</Label>
          <Input
            type="number"
            value={value.plotSizeM2}
            onChange={(e) => set("plotSizeM2", e.target.value)}
            placeholder="e.g. 620"
          />
        </div>
        <div className="space-y-1.5">
          <Label>House size (m²)</Label>
          <Input
            type="number"
            value={value.houseSizeM2}
            onChange={(e) => set("houseSizeM2", e.target.value)}
            placeholder="e.g. 180"
          />
        </div>
      </div>

      {/* Features */}
      <div className="space-y-1.5">
        <Label>Features</Label>
        <div className="flex flex-wrap gap-2">
          {FEATURES.map((f) => {
            const on = value.features.includes(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => set("features", on ? value.features.filter((x) => x !== f) : [...value.features, f])}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                  (on ? "border-[#00C7BE] bg-[#AEECE4] text-[#054b47]" : "border-border bg-background text-muted-foreground")
                }
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <Label>Address</Label>
        <Input
          value={value.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Street address"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe the property — key features, location highlights, etc."
          rows={3}
        />
      </div>

      {/* URL */}
      <div className="space-y-1.5">
        <Label>URL</Label>
        <Input
          type="url"
          value={value.url}
          onChange={(e) => set("url", e.target.value)}
          placeholder="https://…"
        />
      </div>

      {/* Video link */}
      <div className="space-y-1.5">
        <Label>Video link (YouTube or Vimeo)</Label>
        <Input
          type="url"
          value={value.videoUrl}
          onChange={(e) => set("videoUrl", e.target.value)}
          placeholder="https://youtu.be/… or https://vimeo.com/…"
        />
        <p className="text-xs text-muted-foreground">Optional. Paste a YouTube or Vimeo link to show a video player on the listing.</p>
      </div>
    </div>
  );
}
