import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import ProfileReferenceCodeDisplay from "./ProfileReferenceCodeDisplay";
import ImageUpload from "./ImageUpload";
import OfficialUseSection, { type OfficialUseData } from "./OfficialUseSection";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import type { ServiceData, ServiceCategory } from "~backend/service/types";
import { SA_PROVINCES } from "../lib/saRegions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

interface ServiceFormProps {
  serviceId: string | null;
  onClose: () => void;
}

interface CategoryGroup {
  label: string;
  subcategories: ServiceCategory[];
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: "Accessibility & Languages",
    subcategories: [
      "Translation Services",
      "Sign Language Support",
      "Braille & Large Print Services",
    ],
  },
  {
    label: "Business & Admin",
    subcategories: [
      "Accounting & Bookkeeping",
      "Business Consulting",
      "HR & Recruitment",
      "Legal & Compliance",
      "Printing & Document Services",
      "Virtual Assistants",
      "Office Supplies & Equipment",
      "IT Support & Networking",
    ],
  },
  {
    label: "Community & Local",
    subcategories: [
      "Community Centres",
      "Local Clubs & Associations",
      "Religious Organisations",
      "Charity & Non Profit Services",
      "Local Events & Activities",
      "Public Services & Municipal Office",
    ],
  },
  {
    label: "Food & Drink",
    subcategories: [
      "Grocery Stores",
      "Butcheries & Fishmongers",
      "Bakeries",
      "Fresh Produce Markets",
      "Catering Services",
      "Water & Ice Supply",
    ],
  },
  {
    label: "Health & Wellness",
    subcategories: [
      "Beauty Boutiques",
      "Beauty Treatments",
      "Fitness & Gyms",
      "Fitness & Wellbeing",
      "Grooming Services",
      "Holistic Therapies",
      "Skin Care & Aesthetics",
      "Spas & Beauty Treatments",
      "Spas & Massage",
      "Wellness Retreats",
    ],
  },
  {
    label: "Home & Property",
    subcategories: [
      "Architecture",
      "Cleaning Services",
      "Gardening & Landscaping",
      "Plumbing",
      "Electrical Services",
      "Building & Renovations",
      "Pest Control",
      "Home Security",
      "Real Estate & Rentals",
      "Interior Design & Décor",
    ],
  },
  {
    label: "Leisure & Experiences",
    subcategories: [
      "Arts & Culture",
      "Kids Activities",
      "Sport Clubs",
    ],
  },
  {
    label: "Safety",
    subcategories: [
      "Emergency Services",
      "Fire & Safety Equipment",
      "First Aid Training",
      "Medical Services",
      "Occupational Health",
      "Pharmacies",
      "Security Services",
    ],
  },
  {
    label: "Services & Trades",
    subcategories: [
      "Mechanics",
      "Carpenters",
      "Handyman Services",
      "Welders",
      "Painters",
      "Appliance Repairs",
      "Locksmiths",
    ],
  },
  {
    label: "Transport",
    subcategories: [
      "Vehicle Rentals",
      "Trailer Hire",
      "Moving Services",
      "Equipment Hire",
      "Logistics Support",
      "Shuttle Services",
      "Taxi & Ride Hailing",
      "Delivery & Courier Services",
      "Towing Services",
      "Freight & Haulage",
    ],
  },
];

export default function ServiceForm({ serviceId, onClose }: ServiceFormProps) {
  const [loading, setLoading] = useState(false);
  const [serviceData, setServiceData] = useState<ServiceData | null>(null);
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
    serviceCategories: [] as ServiceCategory[],
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
    if (serviceId) {
      loadService();
    }
  }, [serviceId]);

  const loadService = async () => {
    if (!serviceId) return;
    try {
      const backend = getAuthenticatedBackend();
      const data = await backend.service.get({ serviceId });
      setServiceData(data);
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
        serviceCategories: data.serviceCategories,
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
      console.error("Failed to load service:", error);
      toast({
        title: "Error",
        description: "Failed to load service details",
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
      if (serviceId) {
        await backend.service.update({
          serviceId,
          name: formData.name,
          address: formData.address,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          country: formData.country,
          province: formData.province,
          area: formData.area || undefined,
          postalCode: formData.postalCode,
          contactNumber: formData.contactNumber || undefined,
          serviceCategories: formData.serviceCategories,
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
          description: "Service updated successfully",
        });
      } else {
        await backend.service.create({
          name: formData.name,
          address: formData.address,
          latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
          longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
          country: formData.country,
          province: formData.province,
          postalCode: formData.postalCode,
          contactNumber: formData.contactNumber || undefined,
          serviceCategories: formData.serviceCategories,
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
          description: "Service created successfully",
        });
      }
      onClose();
    } catch (error: any) {
      console.error("Save failed:", error);
      toast({
        title: "Error",
        description: error?.message || `Failed to ${serviceId ? "update" : "create"} service`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addSubcategory = (subcategory: ServiceCategory) => {
    if (!formData.serviceCategories.includes(subcategory)) {
      setFormData((prev) => ({
        ...prev,
        serviceCategories: [...prev.serviceCategories, subcategory],
      }));
    }
  };

  const removeSubcategory = (subcategory: ServiceCategory) => {
    setFormData((prev) => ({
      ...prev,
      serviceCategories: prev.serviceCategories.filter((c) => c !== subcategory),
    }));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{serviceId ? "Edit" : "Add"} Service</DialogTitle>
          <DialogDescription>
            {serviceId ? "Update the service details below" : "Fill in the details to add a new service"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <OfficialUseSection data={officialUse} onChange={setOfficialUse} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Service Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input
                id="contactNumber"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
              />
            </div>
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

          <div className="space-y-3">
            <Label>Service Categories</Label>
            <div className="space-y-2">
              {CATEGORY_GROUPS.map((group) => {
                const selectedInGroup = formData.serviceCategories.filter((c) =>
                  group.subcategories.includes(c)
                );
                return (
                  <div key={group.label} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{group.label}</span>
                      <Select
                        value=""
                        onValueChange={(val) => addSubcategory(val as ServiceCategory)}
                      >
                        <SelectTrigger className="w-56 h-8 text-xs">
                          <SelectValue placeholder="Add subcategory..." />
                        </SelectTrigger>
                        <SelectContent>
                          {group.subcategories
                            .filter((sub) => !formData.serviceCategories.includes(sub))
                            .map((sub) => (
                              <SelectItem key={sub} value={sub}>
                                {sub}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedInGroup.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedInGroup.map((cat) => (
                          <span
                            key={cat}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs"
                          >
                            {cat}
                            <button
                              type="button"
                              onClick={() => removeSubcategory(cat)}
                              className="hover:text-purple-900"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <ImageUpload
            label="Service Image"
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

          {serviceData && (
            <ProfileReferenceCodeDisplay
              entityType="service"
              entityId={serviceData.id}
              entityStringId={serviceData.serviceId}
              currentCode={serviceData.profileReferenceCode}
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
              {loading ? "Saving..." : serviceId ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
