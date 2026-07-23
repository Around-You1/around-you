import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OfficialUseSection, { type OfficialUseData } from "./OfficialUseSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { getAuthenticatedBackend } from "../lib/backend";
import type { Accommodation } from "~backend/accommodation/types";
import { useToast } from "@/components/ui/use-toast";
import ImageUpload from "./ImageUpload";
import ProfileReferenceCodeDisplay from "./ProfileReferenceCodeDisplay";
import { SA_PROVINCES } from "../lib/saRegions";

const MAX_IMAGES = 10;

const FACILITIES = [
  "Braai",
  "Fly Fishing",
  "Golf",
  "Gym",
  "Laundry",
  "Spa",
  "Swimming Pool",
];

interface AccommodationFormProps {
  accommodation: Accommodation | null;
  onClose: () => void;
}

export default function AccommodationForm({ accommodation, onClose }: AccommodationFormProps) {
  const [officialUse, setOfficialUse] = useState<OfficialUseData>({
    officialHoldingCompany: "",
    officialContactName: "",
    officialContactNumber: "",
    officialEmail: "",
    officialRepCode: "",
    guestType: "",
    accessLevel: "",
  });

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    country: "South Africa",
    province: "",
    area: "",
    postalCode: "",
    wifiName: "",
    wifiPassword: "",
    imageUrl: "",
    imageUrls: [] as string[],
    checkInInstructions: "",
    amenities: "",
    guidelines: "",
    checkOutInstructions: "",
    wheelchairAccess: false,
    parkingAvailability: false,
    primaryContact: "",
    policeContact: "",
    doctorContact: "",
    ambulanceContact: "",
    hospitalContact: "",
    fireDepartmentContact: "",
    facilities: [] as string[],
    isActive: false,
  });

  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (accommodation) {
      setOfficialUse({
        officialHoldingCompany: accommodation.officialHoldingCompany || "",
        officialContactName: accommodation.officialContactName || "",
        officialContactNumber: accommodation.officialContactNumber || "",
        officialEmail: accommodation.officialEmail || "",
        officialRepCode: accommodation.officialRepCode || "",
        guestType: "",
        accessLevel: "",
      });
      setFormData({
        name: accommodation.name,
        address: accommodation.address,
        latitude: accommodation.latitude != null ? String(accommodation.latitude) : "",
        longitude: accommodation.longitude != null ? String(accommodation.longitude) : "",
        country: accommodation.country,
        province: accommodation.province,
        area: accommodation.area || "",
        postalCode: accommodation.postalCode,
        wifiName: accommodation.wifiName || "",
        wifiPassword: accommodation.wifiPassword || "",
        imageUrl: accommodation.imageUrl || "",
        imageUrls: accommodation.imageUrls || [],
        checkInInstructions: accommodation.checkInInstructions || "",
        amenities: accommodation.amenities || "",
        guidelines: accommodation.guidelines || "",
        checkOutInstructions: accommodation.checkOutInstructions || "",
        wheelchairAccess: accommodation.wheelchairAccess || false,
        parkingAvailability: accommodation.parkingAvailability || false,
        primaryContact: accommodation.primaryContact || "",
        policeContact: accommodation.policeContact || "",
        doctorContact: accommodation.doctorContact || "",
        ambulanceContact: accommodation.ambulanceContact || "",
        hospitalContact: accommodation.hospitalContact || "",
        fireDepartmentContact: accommodation.fireDepartmentContact || "",
        facilities: accommodation.facilities || [],
        isActive: accommodation.isActive,
      });
    }
  }, [accommodation]);

  const handleProvinceChange = (value: string) => {
    setFormData({ ...formData, province: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.province) {
      toast({ title: "Validation Error", description: "Please select a province.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const backend = getAuthenticatedBackend();
      if (accommodation) {
        await backend.accommodation.update({
          id: accommodation.id,
          ...formData,
          latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
          longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
          area: formData.area || undefined,
          imageUrls: formData.imageUrls,
          officialHoldingCompany: officialUse.officialHoldingCompany || undefined,
          officialContactName: officialUse.officialContactName || undefined,
          officialContactNumber: officialUse.officialContactNumber || undefined,
          officialEmail: officialUse.officialEmail || undefined,
          officialRepCode: officialUse.officialRepCode || undefined,
        });
        toast({
          title: "Success",
          description: "Accommodation updated successfully",
        });
      } else {
        await backend.accommodation.create({
          ...formData,
          latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
          longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
          imageUrls: formData.imageUrls,
          officialHoldingCompany: officialUse.officialHoldingCompany || undefined,
          officialContactName: officialUse.officialContactName || undefined,
          officialContactNumber: officialUse.officialContactNumber || undefined,
          officialEmail: officialUse.officialEmail || undefined,
          officialRepCode: officialUse.officialRepCode || undefined,
        });
        toast({
          title: "Accommodation Created",
          description: "Accommodation has been created successfully.",
        });
      }
      onClose();
    } catch (error: any) {
      console.error("Failed to save accommodation:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save accommodation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{accommodation ? "Edit" : "Add"} Accommodation</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <OfficialUseSection data={officialUse} onChange={setOfficialUse} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Accommodation Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                autoComplete="organization"
                enterKeyHint="next"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                autoComplete="street-address"
                enterKeyHint="next"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                inputMode="decimal"
                enterKeyHint="next"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                inputMode="decimal"
                enterKeyHint="next"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                required
                autoComplete="country-name"
                enterKeyHint="next"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="province">Province *</Label>
              <Select value={formData.province} onValueChange={handleProvinceChange}>
                <SelectTrigger id="province">
                  <SelectValue placeholder="Select Province" />
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

            <div className="space-y-2">
              <Label htmlFor="area">Area</Label>
              <Input
                id="area"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                placeholder="e.g. Cape Town, Stellenbosch"
                enterKeyHint="next"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code *</Label>
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                required
                autoComplete="postal-code"
                enterKeyHint="next"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="wifiName">WiFi Name</Label>
              <Input
                id="wifiName"
                value={formData.wifiName}
                onChange={(e) => setFormData({ ...formData, wifiName: e.target.value })}
                autoComplete="off"
                enterKeyHint="next"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wifiPassword">WiFi Password</Label>
              <Input
                id="wifiPassword"
                value={formData.wifiPassword}
                onChange={(e) => setFormData({ ...formData, wifiPassword: e.target.value })}
                type="text"
                autoComplete="off"
                enterKeyHint="next"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="wheelchairAccess"
                checked={formData.wheelchairAccess}
                onCheckedChange={(checked) => setFormData({ ...formData, wheelchairAccess: checked })}
              />
              <Label htmlFor="wheelchairAccess">Wheelchair Access</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="parkingAvailability"
                checked={formData.parkingAvailability}
                onCheckedChange={(checked) => setFormData({ ...formData, parkingAvailability: checked })}
              />
              <Label htmlFor="parkingAvailability">Parking Available</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Facilities</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border rounded-md">
              {FACILITIES.map((facility) => (
                <div key={facility} className="flex items-center space-x-2">
                  <Checkbox
                    id={`facility-${facility}`}
                    checked={formData.facilities.includes(facility)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({ ...formData, facilities: [...formData.facilities, facility] });
                      } else {
                        setFormData({ ...formData, facilities: formData.facilities.filter((f) => f !== facility) });
                      }
                    }}
                  />
                  <Label htmlFor={`facility-${facility}`} className="cursor-pointer">{facility}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Weather Link</Label>
              <a
                href="https://www.weathersa.co.za/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[#AEECE4] hover:underline"
              >
                https://www.weathersa.co.za/
              </a>
            </div>

            <div className="space-y-2">
              <Label>Tides Link</Label>
              <a
                href="https://tides4fishing.com/za"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[#AEECE4] hover:underline"
              >
                https://tides4fishing.com/za
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primaryContact">Primary Contact</Label>
              <Input
                id="primaryContact"
                value={formData.primaryContact}
                onChange={(e) => setFormData({ ...formData, primaryContact: e.target.value })}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="next"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="policeContact">Police Contact</Label>
              <Input
                id="policeContact"
                value={formData.policeContact}
                onChange={(e) => setFormData({ ...formData, policeContact: e.target.value })}
                type="tel"
                inputMode="tel"
                enterKeyHint="next"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doctorContact">Doctor Contact</Label>
              <Input
                id="doctorContact"
                value={formData.doctorContact}
                onChange={(e) => setFormData({ ...formData, doctorContact: e.target.value })}
                type="tel"
                inputMode="tel"
                enterKeyHint="next"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ambulanceContact">Ambulance Contact</Label>
              <Input
                id="ambulanceContact"
                value={formData.ambulanceContact}
                onChange={(e) => setFormData({ ...formData, ambulanceContact: e.target.value })}
                type="tel"
                inputMode="tel"
                enterKeyHint="next"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hospitalContact">Hospital Contact</Label>
              <Input
                id="hospitalContact"
                value={formData.hospitalContact}
                onChange={(e) => setFormData({ ...formData, hospitalContact: e.target.value })}
                type="tel"
                inputMode="tel"
                enterKeyHint="next"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fireDepartmentContact">Fire Department</Label>
              <Input
                id="fireDepartmentContact"
                value={formData.fireDepartmentContact}
                onChange={(e) => setFormData({ ...formData, fireDepartmentContact: e.target.value })}
                type="tel"
                inputMode="tel"
                enterKeyHint="next"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkInInstructions">Check-in Instructions</Label>
            <Textarea
              id="checkInInstructions"
              value={formData.checkInInstructions}
              onChange={(e) => setFormData({ ...formData, checkInInstructions: e.target.value })}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amenities">Amenities</Label>
            <Textarea
              id="amenities"
              value={formData.amenities}
              onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guidelines">Guidelines</Label>
            <Textarea
              id="guidelines"
              value={formData.guidelines}
              onChange={(e) => setFormData({ ...formData, guidelines: e.target.value })}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkOutInstructions">Check-out Instructions</Label>
            <Textarea
              id="checkOutInstructions"
              value={formData.checkOutInstructions}
              onChange={(e) => setFormData({ ...formData, checkOutInstructions: e.target.value })}
              rows={4}
            />
          </div>

          <div className="space-y-4">
            <ImageUpload
              label="Primary Accommodation Image"
              imageUrl={formData.imageUrl}
              onImageUploaded={(url) => setFormData({ ...formData, imageUrl: url })}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Additional Images ({formData.imageUrls.length}/{MAX_IMAGES})</Label>
                {formData.imageUrls.length < MAX_IMAGES && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, imageUrls: ["", ...formData.imageUrls] })}
                    className="min-h-[36px]"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Image
                  </Button>
                )}
              </div>
              {formData.imageUrls.map((url, index) => (
                <div key={index} className="relative">
                  <ImageUpload
                    label={`Image ${index + 1}`}
                    imageUrl={url}
                    onImageUploaded={(newUrl) => {
                      const updated = [...formData.imageUrls];
                      updated[index] = newUrl;
                      setFormData({ ...formData, imageUrls: updated });
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const updated = formData.imageUrls.filter((_, i) => i !== index);
                      setFormData({ ...formData, imageUrls: updated });
                    }}
                    className="absolute top-0 right-0 mt-1 mr-1 min-h-[32px] px-2 z-10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {accommodation && (
            <ProfileReferenceCodeDisplay
              entityType="accommodation"
              entityId={accommodation.id}
              currentCode={accommodation.profileReferenceCode}
            />
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          <div className="flex gap-4">
            <Button
              type="submit"
              className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black min-h-[44px] touch-manipulation"
              disabled={loading}
            >
              {loading ? "Saving..." : accommodation ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="min-h-[44px] touch-manipulation">
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
