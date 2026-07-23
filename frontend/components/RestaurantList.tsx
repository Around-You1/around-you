import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Edit, MapPin, Trash2, Loader2, ChevronDown, ChevronRight, Copy } from "lucide-react";
import ProfileQRCode from "./ProfileQRCode";
import ProfileClassificationGroups from "./ProfileClassificationGroups";
import type { Restaurant } from "~backend/restaurant/types";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { getCurrentPosition, buildDirectionsUrl } from "../lib/geolocation";

interface RestaurantListProps {
  restaurants: Restaurant[];
  onEdit: (restaurant: Restaurant) => void;
  onUpdate: () => void;
}

const FALLBACK = "The company has opted not to make this information visible.";

function FieldRow({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  const displayValue =
    value === null || value === undefined || value === ""
      ? FALLBACK
      : typeof value === "boolean"
      ? value ? "Yes" : "No"
      : String(value);
  const isFallback = displayValue === FALLBACK;
  return (
    <div className="grid grid-cols-2 gap-2 py-1 border-b border-border/40 last:border-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={`text-xs ${isFallback ? "text-muted-foreground italic" : "text-foreground"}`}>{displayValue}</span>
    </div>
  );
}

export default function RestaurantList({ restaurants, onEdit, onUpdate }: RestaurantListProps) {
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [gettingDirections, setGettingDirections] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  const toggleOpen = (id: number) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this restaurant?")) return;
    try {
      const backend = getAuthenticatedBackend();
      await backend.restaurant.deleteRestaurant({ id });
      toast({ title: "Success", description: "Restaurant deleted successfully" });
      onUpdate();
    } catch (error) {
      console.error("Failed to delete restaurant:", error);
      toast({ title: "Error", description: "Failed to delete restaurant", variant: "destructive" });
    }
  };

  const getDirections = async (lat: number, lng: number, id: number) => {
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      toast({ title: "Error", description: "Invalid coordinates for this location", variant: "destructive" });
      return;
    }
    setGettingDirections(id);
    try {
      const userPosition = await getCurrentPosition();
      const url = buildDirectionsUrl(
        { latitude: lat, longitude: lng },
        { latitude: userPosition.latitude, longitude: userPosition.longitude }
      );
      window.open(url, "_blank");
    } catch (error: any) {
      const url = buildDirectionsUrl({ latitude: lat, longitude: lng });
      toast({ title: "Location Access Limited", description: error.message || "Enable location services for accurate directions from your current location." });
      window.open(url, "_blank");
    } finally {
      setGettingDirections(null);
    }
  };

  const copyProfileCode = (code: string | null | undefined, name: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: `Profile access code for ${name} copied to clipboard` });
  };



  const toggleActive = async (restaurant: Restaurant) => {
    setToggling(restaurant.id);
    try {
      const backend = getAuthenticatedBackend();
      await backend.restaurant.update({ id: restaurant.id, isActive: !restaurant.isActive });
      toast({ title: "Success", description: `Restaurant ${!restaurant.isActive ? "activated" : "deactivated"} successfully` });
      onUpdate();
    } catch (error) {
      console.error("Failed to toggle status:", error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  if (restaurants.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No restaurants found</div>;
  }

  return (
    <div className="space-y-1">
      {restaurants.map((restaurant) => {
        const isOpen = openIds.has(restaurant.id);
        return (
          <Collapsible key={restaurant.id} open={isOpen} onOpenChange={() => toggleOpen(restaurant.id)}>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-2">
                <div className="flex items-center justify-between gap-2">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      {isOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                      <h3 className="font-semibold text-sm text-foreground truncate min-w-[120px]">{restaurant.name}</h3>
                      {restaurant.isDuplicate && (
                        <Badge variant="destructive" className="text-xs shrink-0" title={restaurant.duplicateReason || "Duplicate Entry"}>
                          Duplicate
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground truncate">{restaurant.postalCode}</span>
                      {restaurant.cuisineTypes.length > 0 && (
                        <span className="text-xs text-muted-foreground truncate">{restaurant.cuisineTypes.slice(0, 1).join(", ")}</span>
                      )}
                      {restaurant.littleExplorerApproved && <span className="text-xs shrink-0">👶</span>}
                    </button>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-2 shrink-0">
                    {restaurant.profileReferenceCode && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-muted-foreground">{restaurant.profileReferenceCode}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyProfileCode(restaurant.profileReferenceCode, restaurant.name)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={restaurant.isActive}
                        onCheckedChange={() => toggleActive(restaurant)}
                        disabled={toggling === restaurant.id}
                        className="data-[state=checked]:bg-green-600"
                      />
                      <span className="text-xs text-muted-foreground">{restaurant.isActive ? "Active" : "Disabled"}</span>
                    </div>
                    <div className="flex gap-1">
                      {restaurant.latitude != null && restaurant.longitude != null && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => getDirections(restaurant.latitude!, restaurant.longitude!, restaurant.id)}
                          disabled={gettingDirections === restaurant.id}
                          className="h-7 w-7 p-0"
                        >
                          {gettingDirections === restaurant.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => onEdit(restaurant)} className="h-7 w-7 p-0">
                        <Edit className="w-4 h-4" />
                      </Button>
                      {user.role === "SuperAdmin" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(restaurant.id)}
                          className="text-destructive hover:text-destructive h-7 w-7 p-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="mt-3 pt-3 border-t border-border space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Basic Information</p>
                      <FieldRow label="Name" value={restaurant.name} />
                      <FieldRow label="Address" value={restaurant.address} />
                      <FieldRow label="Country" value={restaurant.country} />
                      <FieldRow label="Province" value={restaurant.province} />
                      <FieldRow label="Area" value={restaurant.area} />
                      <FieldRow label="Postal Code" value={restaurant.postalCode} />
                      <FieldRow label="Contact Number" value={restaurant.contactNumber} />
                      <FieldRow label="Description" value={restaurant.description} />
                      <FieldRow label="Profile Reference Code" value={restaurant.profileReferenceCode} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Location</p>
                      <FieldRow label="Latitude" value={restaurant.latitude} />
                      <FieldRow label="Longitude" value={restaurant.longitude} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Cuisine & Services</p>
                      <FieldRow label="Cuisine Types" value={restaurant.cuisineTypes.length > 0 ? restaurant.cuisineTypes.join(", ") : null} />
                      <FieldRow label="Menu Link" value={restaurant.menuLink} />
                      <FieldRow label="Dine-In" value={restaurant.serviceDineIn} />
                      <FieldRow label="Takeaway" value={restaurant.serviceTakeaway} />
                      <FieldRow label="Delivery" value={restaurant.serviceDelivery} />
                      <FieldRow label="Little Explorer Approved" value={restaurant.littleExplorerApproved} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Payment Methods</p>
                      <FieldRow label="Card" value={restaurant.paymentCard} />
                      <FieldRow label="Cash" value={restaurant.paymentCash} />
                      <FieldRow label="Mobile" value={restaurant.paymentMobile} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Accessibility & Facilities</p>
                      <FieldRow label="Wheelchair Access" value={restaurant.wheelchairAccess} />
                      <FieldRow label="Parking Availability" value={restaurant.parkingAvailability} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">WiFi</p>
                      <FieldRow label="WiFi Network" value={restaurant.wifiNetwork} />
                      <FieldRow label="WiFi Password" value={restaurant.wifiPassword} />
                      <FieldRow label="WiFi Credentials" value={restaurant.wifiCredentials} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Discounts</p>
                      <FieldRow label="Discount Offered" value={restaurant.discountOffered} />
                      <FieldRow label="Discount Code" value={restaurant.discountCode} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Image</p>
                      {restaurant.imageUrl ? (
                        <a href={restaurant.imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline break-all">
                          {restaurant.imageUrl}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">{FALLBACK}</span>
                      )}
                    </div>

                    {restaurant.profileReferenceCode && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Profile QR Code</p>
                        <ProfileClassificationGroups
                          guestType={restaurant.guestType}
                          accessLevel={restaurant.accessLevel}
                        />
                        <ProfileQRCode
                          profileName={restaurant.name}
                          profileCode={restaurant.profileReferenceCode}
                          entityType="restaurant"
                        />
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </CardContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
