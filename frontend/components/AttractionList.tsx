import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Edit, Trash2, Navigation, Loader2, Copy, ChevronDown, ChevronRight } from "lucide-react";
import ProfileQRCode from "./ProfileQRCode";
import ProfileClassificationGroups from "./ProfileClassificationGroups";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { getCurrentPosition, buildDirectionsUrl } from "../lib/geolocation";
import type { AttractionData } from "~backend/attraction/types";

interface AttractionListProps {
  onEdit: (attractionId: string) => void;
  onUpdate?: () => void;
  searchQuery?: string;
  sortBy?: string;
  sortOrder?: string;
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

export default function AttractionList({ onEdit, onUpdate, searchQuery = "", sortBy = "created_at", sortOrder = "desc" }: AttractionListProps) {
  const [attractions, setAttractions] = useState<AttractionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [gettingDirections, setGettingDirections] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const filteredAttractions = attractions.filter((attraction) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      attraction.name.toLowerCase().includes(query) ||
      attraction.address.toLowerCase().includes(query) ||
      attraction.postalCode.toLowerCase().includes(query) ||
      (Array.isArray(attraction.attractionType) &&
        attraction.attractionType.some((type) => type.toLowerCase().includes(query)))
    );
  });

  useEffect(() => {
    loadAttractions();
  }, [sortBy, sortOrder]);

  const loadAttractions = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const data = await backend.attraction.list({ sortBy: sortBy as any, sortOrder: sortOrder as any });
      setAttractions(data.attractions);
    } catch (error) {
      console.error("Failed to load attractions:", error);
      toast({ title: "Error", description: "Failed to load attractions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (attractionId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const backend = getAuthenticatedBackend();
      await backend.attraction.deleteAttraction({ attractionId });
      toast({ title: "Success", description: "Attraction deleted successfully" });
      loadAttractions();
      onUpdate?.();
    } catch (error) {
      console.error("Delete failed:", error);
      toast({ title: "Error", description: "Failed to delete attraction", variant: "destructive" });
    }
  };

  const handleNavigate = async (latitude: number, longitude: number, attractionId: string) => {
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      toast({ title: "Error", description: "Invalid coordinates for this location", variant: "destructive" });
      return;
    }
    setGettingDirections(attractionId);
    try {
      const userPosition = await getCurrentPosition();
      const url = buildDirectionsUrl(
        { latitude, longitude },
        { latitude: userPosition.latitude, longitude: userPosition.longitude }
      );
      window.open(url, "_blank");
    } catch (error: any) {
      const url = buildDirectionsUrl({ latitude, longitude });
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



  const toggleActive = async (attraction: AttractionData) => {
    setToggling(attraction.attractionId);
    try {
      const backend = getAuthenticatedBackend();
      await backend.attraction.update({ attractionId: attraction.attractionId, isActive: !attraction.isActive });
      toast({ title: "Success", description: `Attraction ${!attraction.isActive ? "activated" : "deactivated"} successfully` });
      loadAttractions();
      onUpdate?.();
    } catch (error) {
      console.error("Failed to toggle status:", error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  if (loading) return <div className="text-center py-8">Loading attractions...</div>;
  if (attractions.length === 0) return <div className="text-center py-12 text-muted-foreground">No attractions found. Add your first attraction to get started.</div>;
  if (filteredAttractions.length === 0) return <div className="text-center py-12 text-muted-foreground">No attractions match your search criteria.</div>;

  return (
    <div className="space-y-1">
      {filteredAttractions.map((attraction) => {
        const isOpen = openIds.has(attraction.attractionId);
        return (
          <Collapsible key={attraction.attractionId} open={isOpen} onOpenChange={() => toggleOpen(attraction.attractionId)}>
            <Card>
              <CardContent className="p-2">
                <div className="flex items-center justify-between gap-2">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      {isOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                      <h3 className="font-semibold text-sm text-foreground truncate min-w-[120px]">{attraction.name}</h3>
                      {attraction.isDuplicate && (
                        <Badge variant="destructive" className="text-xs shrink-0" title={attraction.duplicateReason || "Duplicate Entry"}>
                          Duplicate
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground truncate">{attraction.postalCode}</span>
                      {Array.isArray(attraction.attractionType) && attraction.attractionType.length > 0 && (
                        <span className="text-xs text-muted-foreground truncate">{attraction.attractionType.slice(0, 1).join(", ")}</span>
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-2 shrink-0">
                    {attraction.profileReferenceCode && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-muted-foreground">{attraction.profileReferenceCode}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyProfileCode(attraction.profileReferenceCode, attraction.name)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={attraction.isActive}
                        onCheckedChange={() => toggleActive(attraction)}
                        disabled={toggling === attraction.attractionId}
                        className="data-[state=checked]:bg-green-600"
                      />
                      <span className="text-xs text-muted-foreground">{attraction.isActive ? "Active" : "Disabled"}</span>
                    </div>
                    <div className="flex gap-1">
                      {attraction.latitude != null && attraction.longitude != null && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleNavigate(attraction.latitude!, attraction.longitude!, attraction.attractionId)}
                          disabled={gettingDirections === attraction.attractionId}
                          className="h-7 w-7 p-0"
                        >
                          {gettingDirections === attraction.attractionId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => onEdit(attraction.attractionId)} className="h-7 w-7 p-0">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(attraction.attractionId, attraction.name)}
                        className="text-destructive hover:text-destructive h-7 w-7 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="mt-3 pt-3 border-t border-border space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Basic Information</p>
                      <FieldRow label="Name" value={attraction.name} />
                      <FieldRow label="Address" value={attraction.address} />
                      <FieldRow label="Country" value={attraction.country} />
                      <FieldRow label="Province" value={attraction.province} />
                      <FieldRow label="Area" value={attraction.area} />
                      <FieldRow label="Postal Code" value={attraction.postalCode} />
                      <FieldRow label="Contact Number" value={attraction.contactNumber} />
                      <FieldRow label="Description" value={attraction.description} />
                      <FieldRow label="Profile Reference Code" value={attraction.profileReferenceCode} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Location</p>
                      <FieldRow label="Latitude" value={attraction.latitude} />
                      <FieldRow label="Longitude" value={attraction.longitude} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Type & Approvals</p>
                      <FieldRow
                        label="Attraction Type"
                        value={Array.isArray(attraction.attractionType) && attraction.attractionType.length > 0 ? attraction.attractionType.join(", ") : null}
                      />
                      <FieldRow label="Little Explorer Approved" value={attraction.littleExplorerApproved} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Payment Methods</p>
                      <FieldRow label="Card" value={attraction.paymentCard} />
                      <FieldRow label="Cash" value={attraction.paymentCash} />
                      <FieldRow label="Mobile" value={attraction.paymentMobile} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Accessibility & Facilities</p>
                      <FieldRow label="Wheelchair Access" value={attraction.wheelchairAccess} />
                      <FieldRow label="Parking Availability" value={attraction.parkingAvailability} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Discounts</p>
                      <FieldRow label="Discount Offered" value={attraction.discountOffered} />
                      <FieldRow label="Discount Code" value={attraction.discountCode} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Image</p>
                      {attraction.imageUrl ? (
                        <a href={attraction.imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline break-all">
                          {attraction.imageUrl}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">{FALLBACK}</span>
                      )}
                    </div>

                    {attraction.profileReferenceCode && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Profile QR Code</p>
                        <ProfileClassificationGroups
                          guestType={attraction.guestType}
                          accessLevel={attraction.accessLevel}
                        />
                        <ProfileQRCode
                          profileName={attraction.name}
                          profileCode={attraction.profileReferenceCode}
                          entityType="attraction"
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
