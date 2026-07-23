import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import ProfileReferenceCodeDisplay from "./ProfileReferenceCodeDisplay";
import ImageUpload from "./ImageUpload";
import OfficialUseSection, { type OfficialUseData } from "./OfficialUseSection";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import type { AttractionData } from "~backend/attraction/types";
import { SA_PROVINCES } from "../lib/saRegions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AttractionFormProps {
  attractionId: string | null;
  onClose: () => void;
}

const ATTRACTION_CATEGORIES = [
  "Artisanal Tastings & Pairings",
  "Beaches & Coastal",
  "Cultural & Historical",
  "Entertainment & Events",
  "Nature & Outdoors",
  "Shopping & Markets",
  "Sports & Adventure",
  "Water-Based Activities",
  "Wellness & Retreats",
  "Wildlife & Eco",
];

export default function AttractionForm({ attractionId, onClose }: AttractionFormProps) {
  const [loading, setLoading] = useState(false);
  const [attractionData, setAttractionData] = useState<AttractionData | null>(null);
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
    contactNumber: "",
    attractionType: [] as string[],
    imageUrl: "",
    discountOffered: "",
    discountCode: "",
    description: "",
    paymentCard: false,
    paymentCash: false,
    paymentMobile: false,
    wheelchairAccess: false,
    parkingAvailability: false,
    littleExplorerApproved: false,
    isActive: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (attractionId) {
      loadAttraction();
    }
  }, [attractionId]);

  const loadAttraction = async () => {
    if (!attractionId) return;
    try {
      const backend = getAuthenticatedBackend();
      const data = await backend.attraction.get({ attractionId });
      setAttractionData(data);
      setOfficialUse({
        officialHoldingCompany: data.officialHoldingCompany || "",
        officialContactName: data.officialContactName || "",
        officialContactNumber: data.officialContactNumber || "",
        officialEmail: data.officialEmail || "",
        officialRepCode: data.officialRepCode || "",
        guestType: data.guestType || "",
        accessLevel: data.accessLevel || "",
      });

      setFormData({
        name: data.name,
        address: data.address,
        latitude: data.latitude != null ? String(data.latitude) : "",
        longitude: data.longitude != null ? String(data.longitude) : "",
        country: data.country,
        province: data.province,
        area: data.area || "",
        postalCode: data.postalCode,
        contactNumber: data.contactNumber || "",
        attractionType: data.attractionType,
        imageUrl: data.imageUrl || "",
        discountOffered: data.discountOffered || "",
        discountCode: data.discountCode || "",
        description: data.description || "",
        paymentCard: data.paymentCard || false,
        paymentCash: data.paymentCash || false,
        paymentMobile: data.paymentMobile || false,
        wheelchairAccess: data.wheelchairAccess || false,
        parkingAvailability: data.parkingAvailability || false,
        littleExplorerApproved: data.littleExplorerApproved || false,
        isActive: data.isActive,
      });
    } catch (error) {
      console.error("Failed to load attraction:", error);
      toast({
        title: "Error",
        description: "Failed to load attraction details",
        variant: "destructive",
      });
    }
  };

  const handleProvinceChange = (value: string) => {
    setFormData({ ...formData, province: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.province) {
      toast({ title: "Validation Error", description: "Province is required", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const backend = getAuthenticatedBackend();
      if (attractionId) {
        await backend.attraction.update({
          attractionId,
          name: formData.name,
          address: formData.address,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          country: formData.country,
          province: formData.province,
          area: formData.area || undefined,
          postalCode: formData.postalCode,
          contactNumber: formData.contactNumber || undefined,
          attractionType: formData.attractionType,
          imageUrl: formData.imageUrl || undefined,
          discountOffered: formData.discountOffered || undefined,
          discountCode: formData.discountCode || undefined,
          description: formData.description || undefined,
          paymentCard: formData.paymentCard,
          paymentCash: formData.paymentCash,
          paymentMobile: formData.paymentMobile,
          wheelchairAccess: formData.wheelchairAccess,
          parkingAvailability: formData.parkingAvailability,
          littleExplorerApproved: formData.littleExplorerApproved,
          isActive: formData.isActive,
          officialHoldingCompany: officialUse.officialHoldingCompany || undefined,
          officialContactName: officialUse.officialContactName || undefined,
          officialContactNumber: officialUse.officialContactNumber || undefined,
          officialEmail: officialUse.officialEmail || undefined,
          officialRepCode: officialUse.officialRepCode || undefined,
          guestType: officialUse.guestType || undefined,
          accessLevel: officialUse.accessLevel || undefined,
        });
        toast({
          title: "Success",
          description: "Attraction updated successfully",
        });
      } else {
        await backend.attraction.create({
          name: formData.name,
          address: formData.address,
          latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
          longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
          country: formData.country,
          province: formData.province,
          postalCode: formData.postalCode,
          contactNumber: formData.contactNumber || undefined,
          attractionType: formData.attractionType,
          imageUrl: formData.imageUrl || undefined,
          discountOffered: formData.discountOffered || undefined,
          discountCode: formData.discountCode || undefined,
          description: formData.description || undefined,
          paymentCard: formData.paymentCard,
          paymentCash: formData.paymentCash,
          paymentMobile: formData.paymentMobile,
          wheelchairAccess: formData.wheelchairAccess,
          parkingAvailability: formData.parkingAvailability,
          littleExplorerApproved: formData.littleExplorerApproved,
          isActive: formData.isActive,
          officialHoldingCompany: officialUse.officialHoldingCompany || undefined,
          officialContactName: officialUse.officialContactName || undefined,
          officialContactNumber: officialUse.officialContactNumber || undefined,
          officialEmail: officialUse.officialEmail || undefined,
          officialRepCode: officialUse.officialRepCode || undefined,
          guestType: officialUse.guestType || undefined,
          accessLevel: officialUse.accessLevel || undefined,
        });
        toast({
          title: "Success",
          description: "Attraction created successfully",
        });
      }
      onClose();
    } catch (error: any) {
      console.error("Save failed:", error);
      toast({
        title: "Error",
        description: error?.message || `Failed to ${attractionId ? "update" : "create"} attraction`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{attractionId ? "Edit" : "Add"} Attraction</DialogTitle>
          <DialogDescription>
            {attractionId ? "Update the attraction details below" : "Fill in the details to add a new attraction"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <OfficialUseSection data={officialUse} onChange={setOfficialUse} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Attraction Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Attraction Categories (Select all that apply)</Label>
            <div className="grid grid-cols-2 gap-2 p-4 border rounded-md max-h-48 overflow-y-auto">
              {ATTRACTION_CATEGORIES.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={category}
                    checked={formData.attractionType.includes(category)}
                    onCheckedChange={() => {
                      setFormData({
                        ...formData,
                        attractionType: formData.attractionType.includes(category)
                          ? formData.attractionType.filter((c) => c !== category)
                          : [...formData.attractionType, category],
                      });
                    }}
                  />
                  <Label htmlFor={category} className="cursor-pointer">
                    {category}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
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
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                required
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code *</Label>
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactNumber">Contact Number</Label>
            <Input
              id="contactNumber"
              value={formData.contactNumber}
              onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
            />
          </div>

          <ImageUpload
            label="Attraction Image"
            imageUrl={formData.imageUrl}
            onImageUploaded={(url) => setFormData({ ...formData, imageUrl: url })}
            maxSizeMB={5}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discountOffered">Discount Offered</Label>
              <Input
                id="discountOffered"
                value={formData.discountOffered}
                onChange={(e) => setFormData({ ...formData, discountOffered: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountCode">Discount Code</Label>
              <Input
                id="discountCode"
                value={formData.discountCode}
                onChange={(e) => setFormData({ ...formData, discountCode: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <Label className="text-base font-semibold">Payment Options</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="paymentCard"
                  checked={formData.paymentCard}
                  onCheckedChange={(checked) => setFormData({ ...formData, paymentCard: checked })}
                />
                <Label htmlFor="paymentCard">Card</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="paymentCash"
                  checked={formData.paymentCash}
                  onCheckedChange={(checked) => setFormData({ ...formData, paymentCash: checked })}
                />
                <Label htmlFor="paymentCash">Cash</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="paymentMobile"
                  checked={formData.paymentMobile}
                  onCheckedChange={(checked) => setFormData({ ...formData, paymentMobile: checked })}
                />
                <Label htmlFor="paymentMobile">Mobile</Label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-semibold">Accessibility</Label>
            <div className="grid grid-cols-2 gap-4">
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
          </div>

          {attractionData && (
            <ProfileReferenceCodeDisplay
              entityType="attraction"
              entityId={attractionData.id}
              entityStringId={attractionData.attractionId}
              currentCode={attractionData.profileReferenceCode}
            />
          )}

          <div className="flex flex-col gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="littleExplorerApproved"
                checked={formData.littleExplorerApproved}
                onCheckedChange={(checked) => setFormData({ ...formData, littleExplorerApproved: checked })}
              />
              <Label htmlFor="littleExplorerApproved">Little Explorer Approved</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : attractionId ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
