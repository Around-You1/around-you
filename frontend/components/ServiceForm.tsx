import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import ProfileReferenceCodeDisplay from "./ProfileReferenceCodeDisplay";
import MultiImageUpload from "./MultiImageUpload";
import OfficialUseSection, { type OfficialUseData } from "./OfficialUseSection";
import { loadCharity, saveCharity } from "../lib/charity";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import type { ServiceData, ServiceCategory } from "~backend/service/types";
import { SA_PROVINCES } from "../lib/saRegions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

interface ServiceFormProps {
  serviceId: string | null;
  onClose: () => void;
  partnerEdit?: boolean;
}

interface CategoryGroup {
  label: string;
  subcategories: ServiceCategory[];
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: "Accessibility & Languages",
    subcategories: [
      "Accessibility Consulting",
      "Assistive Technology Services",
      "Braille & Large Print Services",
      "Interpretation Services",
      "Sign Language Support",
      "Translation Services",
    ],
  },
  {
    label: "Business & Admin",
    subcategories: [
      "Accounting & Bookkeeping",
      "Business Consulting",
      "HR & Recruitment",
      "IT Support & Networking",
      "Legal & Compliance",
      "Office Supplies & Equipment",
      "Printing & Document Services",
      "Virtual Assistants",
    ],
  },
  {
    label: "Community & Local",
    subcategories: [
      "Charity & Non Profit Services",
      "Community Centres",
      "Local Clubs & Associations",
      "Local Events & Activities",
      "Public Services & Municipal Office",
      "Religious Organizations",
    ],
  },
  {
    label: "Food & Drink",
    subcategories: [
      "Bakeries",
      "Butcheries & Fishmongers",
      "Catering Services",
      "Fresh Produce Markets",
      "Grocery Stores",
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
      "Wellness Retreats",
    ],
  },
  {
    label: "Home & Property",
    subcategories: [
      "Architecture",
      "Cleaning Services",
      "Gardening & Landscaping",
      "Home Security",
      "Interior Design & Décor",
      "Pest Control",
    ],
  },
  {
    label: "Leisure & Experiences",
    subcategories: [
      "Arts & Culture",
      "Events & Entertainment",
      "Fitness & Gyms",
      "Kids Activities",
      "Sport Clubs",
      "Tours & Activities",
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
      "Appliance Repairs",
      "Carpenters",
      "Electricians",
      "Handyman Services",
      "Locksmiths",
      "Mechanics",
      "Painters",
      "Plumbers",
      "Welders",
    ],
  },
  {
    label: "Transport",
    subcategories: [
      "Delivery & Courier Services",
      "Equipment Hire",
      "Freight & Haulage",
      "Logistics Support",
      "Moving Services",
      "Shuttle Services",
      "Taxi & Ride Hailing",
      "Towing Services",
      "Trailer Hire",
      "Vehicle Rentals",
    ],
  },
];

export default function ServiceForm({ serviceId, onClose, partnerEdit = false }: ServiceFormProps) {
  const [loading, setLoading] = useState(false);
  // Gate the form render until the record has loaded. The Province <Select>
  // reads its value when it mounts and does not re-sync if the value arrives a
  // render later — so on edit we wait for the data before rendering the form,
  // exactly as RestaurantForm does. Prevents a blank Province on edit.
  const [initialLoading, setInitialLoading] = useState(false);
  const [serviceData, setServiceData] = useState<ServiceData | null>(null);
  const [officialUse, setOfficialUse] = useState<OfficialUseData>({
    officialHoldingCompany: "",
    officialContactName: "",
    officialContactNumber: "",
    officialEmail: "",
    officialRepCode: "",
    officialRepName: "",
    companyRegNumber: "",
    companyVatNumber: "",
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
    imageUrls: [] as string[],
    discountOffered: "",
    discountCode: "",
    description: "",
    paymentCard: false,
    paymentCash: false,
    paymentMobile: false,
    paymentGaap: false,
    paymentSnapScan: false,
    paymentYoco: false,
    paymentZapper: false,
    socialsWebsite: "",
    socialsFacebook: "",
    socialsInstagram: "",
    socialsTwitter: "",
    socialsTiktok: "",
    safetyInfo: "",
    ageRestrictions: "",
    fitnessLevel: "",
    bestTimeOfDay: "",
    whatToBring: "",
    wheelchairAccess: false,
    parkingAvailability: false,
    littleExplorerApproved: false,
    isActive: false,
    bookingItems: [] as { name: string; price: number; duration: number }[],
  });
  const { toast } = useToast();

  useEffect(() => {
    if (serviceId) {
      loadService();
    }
  }, [serviceId]);

  const loadService = async () => {
    if (!serviceId) return;
    setInitialLoading(true);
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
        officialRepName: data.officialRepName || "",
        companyRegNumber: data.companyRegNumber || "",
        companyVatNumber: data.companyVatNumber || "",
        guestType: data.guestType || "",
        accessLevel: data.accessLevel || "",
      });
      loadCharity("service", data.id).then((cats) =>
        setOfficialUse((o) => ({ ...o, charity: cats })),
      );

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
        imageUrls: data.imageUrls || [],
        discountOffered: data.discountOffered || "",
        discountCode: data.discountCode || "",
        description: data.description || "",
        paymentCard: data.paymentCard || false,
        paymentCash: data.paymentCash || false,
        paymentMobile: data.paymentMobile || false,
        paymentGaap: data.paymentGaap || false,
        paymentSnapScan: data.paymentSnapScan || false,
        paymentYoco: data.paymentYoco || false,
        paymentZapper: data.paymentZapper || false,
        socialsWebsite: data.socialsWebsite || "",
        socialsFacebook: data.socialsFacebook || "",
        socialsInstagram: data.socialsInstagram || "",
        socialsTwitter: data.socialsTwitter || "",
        socialsTiktok: data.socialsTiktok || "",
        safetyInfo: data.safetyInfo || "",
        ageRestrictions: data.ageRestrictions || "",
        fitnessLevel: data.fitnessLevel || "",
        bestTimeOfDay: data.bestTimeOfDay || "",
        whatToBring: data.whatToBring || "",
        wheelchairAccess: data.wheelchairAccess || false,
        parkingAvailability: data.parkingAvailability || false,
        littleExplorerApproved: data.littleExplorerApproved || false,
        isActive: data.isActive,
        bookingItems: data.bookingItems || [],
      });
    } catch (error) {
      console.error("Failed to load service:", error);
      toast({
        title: "Error",
        description: "Failed to load service details",
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
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
          imageUrls: formData.imageUrls || undefined,
          discountOffered: formData.discountOffered || undefined,
          discountCode: formData.discountCode || undefined,
          description: formData.description || undefined,
          paymentCard: formData.paymentCard,
          paymentCash: formData.paymentCash,
          paymentMobile: formData.paymentMobile,
          paymentGaap: formData.paymentGaap,
          paymentSnapScan: formData.paymentSnapScan,
          paymentYoco: formData.paymentYoco,
          paymentZapper: formData.paymentZapper,
          socialsWebsite: formData.socialsWebsite,
          socialsFacebook: formData.socialsFacebook,
          socialsInstagram: formData.socialsInstagram,
          socialsTwitter: formData.socialsTwitter,
          socialsTiktok: formData.socialsTiktok,
          safetyInfo: formData.safetyInfo,
          ageRestrictions: formData.ageRestrictions,
          fitnessLevel: formData.fitnessLevel,
          bestTimeOfDay: formData.bestTimeOfDay,
          whatToBring: formData.whatToBring,
          wheelchairAccess: formData.wheelchairAccess,
          parkingAvailability: formData.parkingAvailability,
          littleExplorerApproved: formData.littleExplorerApproved,
          isActive: formData.isActive,
          officialHoldingCompany: officialUse.officialHoldingCompany || undefined,
          officialContactName: officialUse.officialContactName || undefined,
          officialContactNumber: officialUse.officialContactNumber || undefined,
          officialEmail: officialUse.officialEmail || undefined,
          officialRepCode: officialUse.officialRepCode || undefined,
          officialRepName: officialUse.officialRepName || undefined,
          companyRegNumber: officialUse.companyRegNumber || undefined,
          companyVatNumber: officialUse.companyVatNumber || undefined,
          guestType: officialUse.guestType || undefined,
          accessLevel: officialUse.accessLevel || undefined,
          bookingItems: formData.bookingItems,
        });
        await saveCharity("service", serviceData?.id, officialUse.charity || []);
        toast({
          title: "Success",
          description: "Service updated successfully",
        });
      } else {
        const createdSvc: any = await backend.service.create({
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
          imageUrls: formData.imageUrls || undefined,
          discountOffered: formData.discountOffered || undefined,
          discountCode: formData.discountCode || undefined,
          description: formData.description || undefined,
          paymentCard: formData.paymentCard,
          paymentCash: formData.paymentCash,
          paymentMobile: formData.paymentMobile,
          paymentGaap: formData.paymentGaap,
          paymentSnapScan: formData.paymentSnapScan,
          paymentYoco: formData.paymentYoco,
          paymentZapper: formData.paymentZapper,
          socialsWebsite: formData.socialsWebsite,
          socialsFacebook: formData.socialsFacebook,
          socialsInstagram: formData.socialsInstagram,
          socialsTwitter: formData.socialsTwitter,
          socialsTiktok: formData.socialsTiktok,
          safetyInfo: formData.safetyInfo,
          ageRestrictions: formData.ageRestrictions,
          fitnessLevel: formData.fitnessLevel,
          bestTimeOfDay: formData.bestTimeOfDay,
          whatToBring: formData.whatToBring,
          wheelchairAccess: formData.wheelchairAccess,
          parkingAvailability: formData.parkingAvailability,
          littleExplorerApproved: formData.littleExplorerApproved,
          isActive: formData.isActive,
          officialHoldingCompany: officialUse.officialHoldingCompany || undefined,
          officialContactName: officialUse.officialContactName || undefined,
          officialContactNumber: officialUse.officialContactNumber || undefined,
          officialEmail: officialUse.officialEmail || undefined,
          officialRepCode: officialUse.officialRepCode || undefined,
          officialRepName: officialUse.officialRepName || undefined,
          companyRegNumber: officialUse.companyRegNumber || undefined,
          companyVatNumber: officialUse.companyVatNumber || undefined,
          guestType: officialUse.guestType || undefined,
          accessLevel: officialUse.accessLevel || undefined,
          bookingItems: formData.bookingItems,
        });
        await saveCharity("service", createdSvc.id, officialUse.charity || []);
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

  if (initialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Service...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-12">
          <div className="text-muted-foreground">Loading service details...</div>
        </CardContent>
      </Card>
    );
  }

  // Progressive disclosure by tier (mirrors the Rep Onboarding app). Required
  // identity/location fields + images stay in the Tier 1 baseline.
  const tierNum = parseInt((officialUse.accessLevel || "").replace(/[^0-9]/g, ""), 10) || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{partnerEdit ? "Edit Your Profile" : `${serviceId ? "Edit" : "Add"} Service`}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!partnerEdit && <OfficialUseSection data={officialUse} onChange={setOfficialUse} />}

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

          <div className="space-y-3" style={{ display: tierNum >= 4 ? undefined : "none" }}>
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

          <MultiImageUpload
            label="Service Images"
            images={formData.imageUrls}
            onChange={(urls) => setFormData({ ...formData, imageUrls: urls, imageUrl: urls[0] || "" })}
          />

          <div className="grid grid-cols-2 gap-4" style={{ display: tierNum >= 4 ? undefined : "none" }}>
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

          <div className="space-y-2" style={{ display: tierNum >= 3 ? undefined : "none" }}>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-4" style={{ display: tierNum >= 4 ? undefined : "none" }}>
            <Label className="text-base font-semibold">Experience Info</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="safetyInfo">Safety Info</Label>
                <Input
                  id="safetyInfo"
                  value={formData.safetyInfo}
                  onChange={(e) => setFormData({ ...formData, safetyInfo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ageRestrictions">Age Restrictions</Label>
                <Input
                  id="ageRestrictions"
                  value={formData.ageRestrictions}
                  onChange={(e) => setFormData({ ...formData, ageRestrictions: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fitnessLevel">Fitness Level</Label>
                <Input
                  id="fitnessLevel"
                  value={formData.fitnessLevel}
                  onChange={(e) => setFormData({ ...formData, fitnessLevel: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bestTimeOfDay">Best Time of Day</Label>
                <Input
                  id="bestTimeOfDay"
                  value={formData.bestTimeOfDay}
                  onChange={(e) => setFormData({ ...formData, bestTimeOfDay: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatToBring">What to Bring</Label>
                <Input
                  id="whatToBring"
                  value={formData.whatToBring}
                  onChange={(e) => setFormData({ ...formData, whatToBring: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4" style={{ display: tierNum >= 4 ? undefined : "none" }}>
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
                <Label htmlFor="paymentMobile">Mobile Tap</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="paymentGaap"
                  checked={formData.paymentGaap}
                  onCheckedChange={(checked) => setFormData({ ...formData, paymentGaap: checked })}
                />
                <Label htmlFor="paymentGaap">Gaap</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="paymentSnapScan"
                  checked={formData.paymentSnapScan}
                  onCheckedChange={(checked) => setFormData({ ...formData, paymentSnapScan: checked })}
                />
                <Label htmlFor="paymentSnapScan">Snap Scan</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="paymentYoco"
                  checked={formData.paymentYoco}
                  onCheckedChange={(checked) => setFormData({ ...formData, paymentYoco: checked })}
                />
                <Label htmlFor="paymentYoco">Yoco</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="paymentZapper"
                  checked={formData.paymentZapper}
                  onCheckedChange={(checked) => setFormData({ ...formData, paymentZapper: checked })}
                />
                <Label htmlFor="paymentZapper">Zapper</Label>
              </div>
            </div>
          </div>

          <div className="space-y-4" style={{ display: tierNum >= 2 ? undefined : "none" }}>
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

          <div className="space-y-4" style={{ display: tierNum >= 4 ? undefined : "none" }}>
            <Label className="text-base font-semibold">Bookable Items</Label>
            <p className="text-sm text-muted-foreground">
              Products or services a guest can select when booking (name, price in Rand, duration in minutes).
            </p>
            {formData.bookingItems.map((item, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Item</Label>
                  <Input value={item.name}
                    onChange={(e) => setFormData({ ...formData, bookingItems: formData.bookingItems.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price (R)</Label>
                  <Input type="number" step="any" value={item.price}
                    onChange={(e) => setFormData({ ...formData, bookingItems: formData.bookingItems.map((r, idx) => (idx === i ? { ...r, price: parseFloat(e.target.value) || 0 } : r)) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Duration (min)</Label>
                  <Input type="number" step="1" value={item.duration}
                    onChange={(e) => setFormData({ ...formData, bookingItems: formData.bookingItems.map((r, idx) => (idx === i ? { ...r, duration: parseInt(e.target.value) || 0 } : r)) })} />
                </div>
                <Button type="button" variant="outline"
                  onClick={() => setFormData({ ...formData, bookingItems: formData.bookingItems.filter((_, idx) => idx !== i) })}>
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline"
              onClick={() => setFormData({ ...formData, bookingItems: [...formData.bookingItems, { name: "", price: 0, duration: 0 }] })}>
              + Add Item
            </Button>
          </div>

          <div className="space-y-4" style={{ display: tierNum >= 4 ? undefined : "none" }}>
            <Label className="text-base font-semibold">Social Media</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="socialsWebsite">Website</Label>
                <Input
                  id="socialsWebsite"
                  type="text"
                  value={formData.socialsWebsite}
                  onChange={(e) => setFormData({ ...formData, socialsWebsite: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="socialsFacebook">Facebook</Label>
                <Input
                  id="socialsFacebook"
                  type="text"
                  value={formData.socialsFacebook}
                  onChange={(e) => setFormData({ ...formData, socialsFacebook: e.target.value })}
                  placeholder="https://facebook.com/yourpage"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="socialsInstagram">Instagram</Label>
                <Input
                  id="socialsInstagram"
                  type="text"
                  value={formData.socialsInstagram}
                  onChange={(e) => setFormData({ ...formData, socialsInstagram: e.target.value })}
                  placeholder="https://instagram.com/yourpage"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="socialsTwitter">X (Twitter)</Label>
                <Input
                  id="socialsTwitter"
                  type="text"
                  value={formData.socialsTwitter}
                  onChange={(e) => setFormData({ ...formData, socialsTwitter: e.target.value })}
                  placeholder="https://x.com/yourpage"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="socialsTiktok">TikTok</Label>
                <Input
                  id="socialsTiktok"
                  type="text"
                  value={formData.socialsTiktok}
                  onChange={(e) => setFormData({ ...formData, socialsTiktok: e.target.value })}
                  placeholder="https://tiktok.com/@yourpage"
                />
              </div>
            </div>
          </div>

          {!partnerEdit && serviceData && (
            <ProfileReferenceCodeDisplay
              entityType="service"
              entityId={serviceData.id}
              entityStringId={serviceData.serviceId}
              currentCode={serviceData.profileReferenceCode}
            />
          )}

          <div className="flex flex-col gap-4">
            <div className="flex items-center space-x-2" style={{ display: tierNum >= 3 ? undefined : "none" }}>
              <Switch
                id="littleExplorerApproved"
                checked={formData.littleExplorerApproved}
                onCheckedChange={(checked) => setFormData({ ...formData, littleExplorerApproved: checked })}
              />
              <Label htmlFor="littleExplorerApproved">Child Friendly</Label>
            </div>
            {!partnerEdit && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            )}
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
      </CardContent>
    </Card>
  );
}
