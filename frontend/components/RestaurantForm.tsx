import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProfileReferenceCodeDisplay from "./ProfileReferenceCodeDisplay";
import MultiImageUpload from "./MultiImageUpload";
import MultiPdfUpload from "./MultiPdfUpload";
import OfficialUseSection, { type OfficialUseData } from "./OfficialUseSection";
import { getAuthenticatedBackend } from "../lib/backend";
import type { Restaurant } from "~backend/restaurant/types";
import { useToast } from "@/components/ui/use-toast";
import { SA_PROVINCES } from "../lib/saRegions";

interface RestaurantFormProps {
  restaurantId: number | null;
  onClose: () => void;
  // When true, this form is being used by a partner (via the edit code), not an
  // admin: admin-only sections (Official Use, access/edit codes, Active toggle)
  // are hidden and their existing values pass through the save untouched.
  partnerEdit?: boolean;
}

const CUISINE_TYPES = [
  "African",
  "American",
  "Asian",
  "BBQ",
  "Breakfast",
  "Bunny Chow",
  "Burgers",
  "Cafe",
  "Chinese",
  "Dagwood",
  "Deli",
  "Fast Food",
  "Fine Dining",
  "French",
  "Gatsby",
  "Greek",
  "Indian",
  "Irish",
  "Italian",
  "Japanese",
  "Mediterranean",
  "Mexican",
  "Middle Eastern",
  "Pasta",
  "Pizza",
  "Ribs",
  "Seafood",
  "Spanish",
  "Steaks",
  "Sushi",
  "Thai",
  "Vegan",
  "Vegetarian",
  "Vetkoek",
];

export default function RestaurantForm({ restaurantId, onClose, partnerEdit = false }: RestaurantFormProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
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
    latitude: "" as string | number,
    longitude: "" as string | number,
    country: "South Africa",
    province: "",
    area: "",
    postalCode: "",
    contactNumber: "",
    cuisineTypes: [] as string[],
    menuLink: "",
    imageUrl: "",
    imageUrls: [] as string[],
    menuPdfUrls: [] as string[],
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
    wheelchairAccess: false,
    parkingAvailability: false,
    serviceDineIn: false,
    serviceTakeaway: false,
    serviceDelivery: false,
    wifiNetwork: "",
    wifiPassword: "",
    bookingsEmail: "",
    bookingsContactNumber: "",
    socialsWebsite: "",
    socialsInstagram: "",
    socialsTwitter: "",
    socialsFacebook: "",
    socialsTiktok: "",
    littleExplorerApproved: false,
    isActive: false,
    bookingItems: [] as { name: string; price: number; duration: number }[],
  });

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (restaurantId) {
      loadRestaurant();
    }
  }, [restaurantId]);

  const loadRestaurant = async () => {
    if (!restaurantId) return;
    setInitialLoading(true);
    try {
      console.log("[RestaurantForm] Loading restaurant with ID:", restaurantId);
      const backend = getAuthenticatedBackend();
      const data = await backend.restaurant.get({ id: restaurantId });
      console.log("[RestaurantForm] Received restaurant data:", data);
      setRestaurant(data);
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

      setFormData({
        name: data.name,
        address: data.address,
        latitude: data.latitude ?? "",
        longitude: data.longitude ?? "",
        country: data.country,
        province: data.province,
        area: data.area || "",
        postalCode: data.postalCode,
        contactNumber: data.contactNumber || "",
        cuisineTypes: data.cuisineTypes,
        menuLink: data.menuLink || "",
        imageUrl: data.imageUrl || "",
        imageUrls: data.imageUrls || [],
        menuPdfUrls: data.menuPdfUrls || [],
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
        wheelchairAccess: data.wheelchairAccess || false,
        parkingAvailability: data.parkingAvailability || false,
        serviceDineIn: data.serviceDineIn || false,
        serviceTakeaway: data.serviceTakeaway || false,
        serviceDelivery: data.serviceDelivery || false,
        wifiNetwork: data.wifiNetwork || "",
        wifiPassword: data.wifiPassword || "",
        bookingsEmail: data.bookingsEmail || "",
        bookingsContactNumber: data.bookingsContactNumber || "",
        socialsWebsite: data.socialsWebsite || "",
        socialsInstagram: data.socialsInstagram || "",
        socialsTwitter: data.socialsTwitter || "",
        socialsFacebook: data.socialsFacebook || "",
        socialsTiktok: data.socialsTiktok || "",
        littleExplorerApproved: data.littleExplorerApproved,
        isActive: data.isActive,
        bookingItems: data.bookingItems || [],
      });
      console.log("[RestaurantForm] Form data populated:", {
        name: data.name,
        cuisineTypes: data.cuisineTypes,
        province: data.province
      });
    } catch (error) {
      console.error("[RestaurantForm] Failed to load restaurant:", error);
      toast({
        title: "Error",
        description: "Failed to load restaurant details",
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
      if (restaurantId) {
        await backend.restaurant.update({
          id: restaurantId,
          ...formData,
          latitude: formData.latitude ? parseFloat(String(formData.latitude)) : null,
          longitude: formData.longitude ? parseFloat(String(formData.longitude)) : null,
          imageUrl: formData.imageUrl || undefined,
          imageUrls: formData.imageUrls || undefined,
          area: formData.area || undefined,
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
        });
        toast({
          title: "Success",
          description: "Restaurant updated successfully",
        });
      } else {
        await backend.restaurant.create({
          ...formData,
          latitude: formData.latitude ? parseFloat(String(formData.latitude)) : undefined,
          longitude: formData.longitude ? parseFloat(String(formData.longitude)) : undefined,
          imageUrl: formData.imageUrl || undefined,
          imageUrls: formData.imageUrls || undefined,
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
        });
        toast({
          title: "Success",
          description: "Restaurant created successfully",
        });
      }
      onClose();
    } catch (error: any) {
      console.error("Failed to save restaurant:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save restaurant",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCuisineType = (cuisine: string) => {
    setFormData({
      ...formData,
      cuisineTypes: formData.cuisineTypes.includes(cuisine)
        ? formData.cuisineTypes.filter((c) => c !== cuisine)
        : [...formData.cuisineTypes, cuisine],
    });
  };

  if (initialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Restaurant...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-12">
          <div className="text-muted-foreground">Loading restaurant details...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{partnerEdit ? "Edit Your Profile" : `${restaurantId ? "Edit" : "Add"} Restaurant`}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {!partnerEdit && <OfficialUseSection data={officialUse} onChange={setOfficialUse} />}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Restaurant Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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

            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input
                id="contactNumber"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
              />
            </div>
          </div>

          <MultiImageUpload
            label="Restaurant Images"
            images={formData.imageUrls}
            onChange={(urls) => setFormData({ ...formData, imageUrls: urls, imageUrl: urls[0] || "" })}
          />

          <MultiPdfUpload
            label="Menu PDF(s)"
            pdfs={formData.menuPdfUrls}
            onChange={(urls) => setFormData({ ...formData, menuPdfUrls: urls })}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="menuLink">Menu Link</Label>
              <Input
                id="menuLink"
                type="text"
                value={formData.menuLink}
                onChange={(e) => setFormData({ ...formData, menuLink: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountOffered">Discount Offered</Label>
              <Input
                id="discountOffered"
                value={formData.discountOffered}
                onChange={(e) => setFormData({ ...formData, discountOffered: e.target.value })}
                placeholder="e.g., 10% off"
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
            <Label>Cuisine Types</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {CUISINE_TYPES.map((cuisine) => (
                <div key={cuisine} className="flex items-center space-x-2">
                  <Checkbox
                    id={cuisine}
                    checked={formData.cuisineTypes.includes(cuisine)}
                    onCheckedChange={() => toggleCuisineType(cuisine)}
                  />
                  <Label htmlFor={cuisine} className="cursor-pointer font-normal">
                    {cuisine}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="space-y-4">
            <Label className="text-base font-semibold">Payment Options</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <div className="space-y-4">
            <Label className="text-base font-semibold">Service Options</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="serviceDineIn"
                  checked={formData.serviceDineIn}
                  onCheckedChange={(checked) => setFormData({ ...formData, serviceDineIn: checked })}
                />
                <Label htmlFor="serviceDineIn">Dine-in</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="serviceTakeaway"
                  checked={formData.serviceTakeaway}
                  onCheckedChange={(checked) => setFormData({ ...formData, serviceTakeaway: checked })}
                />
                <Label htmlFor="serviceTakeaway">Takeaway</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="serviceDelivery"
                  checked={formData.serviceDelivery}
                  onCheckedChange={(checked) => setFormData({ ...formData, serviceDelivery: checked })}
                />
                <Label htmlFor="serviceDelivery">Delivery</Label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-semibold">Accessibility</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="wifiNetwork">WiFi Network</Label>
              <Input
                id="wifiNetwork"
                value={formData.wifiNetwork}
                onChange={(e) => setFormData({ ...formData, wifiNetwork: e.target.value })}
                placeholder="WiFi network name (SSID)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wifiPassword">WiFi Password</Label>
              <Input
                id="wifiPassword"
                value={formData.wifiPassword}
                onChange={(e) => setFormData({ ...formData, wifiPassword: e.target.value })}
                placeholder="WiFi password"
                type="text"
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-semibold">Bookings</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="bookingsEmail">Bookings Email</Label>
                <Input
                  id="bookingsEmail"
                  type="email"
                  value={formData.bookingsEmail}
                  onChange={(e) => setFormData({ ...formData, bookingsEmail: e.target.value })}
                  placeholder="bookings@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bookingsContactNumber">Bookings Contact Number</Label>
                <Input
                  id="bookingsContactNumber"
                  value={formData.bookingsContactNumber}
                  onChange={(e) => setFormData({ ...formData, bookingsContactNumber: e.target.value })}
                  placeholder="+27 000 000 0000"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
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

          <div className="space-y-4">
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

          {!partnerEdit && restaurant && (
            <ProfileReferenceCodeDisplay
              entityType="restaurant"
              entityId={restaurant.id}
              currentCode={restaurant.profileReferenceCode}
            />
          )}

          <div className="flex flex-col gap-4">
            <div className="flex items-center space-x-2">
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

          <div className="flex gap-4">
            <Button
              type="submit"
              className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black"
              disabled={loading}
            >
              {loading ? "Saving..." : restaurantId ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
