"use client";

// -----------------------------------------------------------------------------
// Property listing fields — one property an Estate Agent lists (image 1 spec):
// 10-image carousel, Show House (+1-10) / Sale / Rent, Code, Price, Bedrooms,
// Bathrooms, Garages, URL.
//
// This is a CONTROLLED component: the parent (EstateAgentForm) owns the array of
// listings and passes `value` + `onChange`. Saving to the backend happens in the
// parent when the agent is saved.
// -----------------------------------------------------------------------------

import { Card, CardContent } from "@/components/ui/card";
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
import { Trash2 } from "lucide-react";
import MultiImageUpload from "./MultiImageUpload";

const ONE_TO_TEN = Array.from({ length: 10 }, (_, i) => String(i + 1));

export interface PropertyListing {
  id?: number; // set for listings already saved in the database
  images: string[];
  isShowHouse: boolean;
  showHouseNumber: string; // "1".."10"
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
  showHouseNumber: "1",
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
  onRemove,
  index,
}: {
  value: PropertyListing;
  onChange: (v: PropertyListing) => void;
  onRemove?: () => void;
  index?: number;
}) {
  const set = <K extends keyof PropertyListing>(key: K, v: PropertyListing[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <Card className="border-[#AEECE4]/40">
      <CardContent className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            Property listing{typeof index === "number" ? ` #${index + 1}` : ""}
          </p>
          {onRemove && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Remove
            </Button>
          )}
        </div>

        {/* Carousel of up to 10 images (drag & drop) */}
        <MultiImageUpload
          label="Property images"
          images={value.images}
          onChange={(urls) => set("images", urls)}
          maxImages={10}
        />

        {/* Show House (+1-10), Sale, Rent */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={value.isShowHouse}
              onCheckedChange={(v) => set("isShowHouse", v === true)}
            />
            <Label className="cursor-pointer">Show House</Label>
            {value.isShowHouse && (
              <div className="w-20">
                {numberSelect(value.showHouseNumber, (v) => set("showHouseNumber", v), "1")}
              </div>
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
      </CardContent>
    </Card>
  );
}
