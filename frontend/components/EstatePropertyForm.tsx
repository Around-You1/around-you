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
import MultiImageUpload from "./MultiImageUpload";

const ONE_TO_TEN = Array.from({ length: 10 }, (_, i) => String(i + 1));

export interface PropertyListing {
  id?: number; // set for listings already saved in the database
  images: string[];
  isShowHouse: boolean;
  showHouseNumber: number; // 1..10 when isShowHouse (assigned by the parent), else 0
  listingType: "" | "sale" | "rent";
  code: string;
  price: string; // free text
  bedrooms: string; // "1".."10"
  bathrooms: string;
  garages: string;
  url: string;
}

export const newListing = (): PropertyListing => ({
  images: [],
  isShowHouse: false,
  showHouseNumber: 0,
  listingType: "",
  code: "",
  price: "",
  bedrooms: "",
  bathrooms: "",
  garages: "",
  url: "",
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
    </div>
  );
}
