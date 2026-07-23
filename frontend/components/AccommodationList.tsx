import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Edit, MapPin, Trash2, Loader2, ChevronDown, ChevronRight, Copy } from "lucide-react";
import ProfileQRCode from "./ProfileQRCode";
import type { Accommodation } from "~backend/accommodation/types";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { getCurrentPosition, buildDirectionsUrl } from "../lib/geolocation";

interface AccommodationListProps {
  accommodations: Accommodation[];
  onEdit: (accommodation: Accommodation) => void;
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

export default function AccommodationList({ accommodations, onEdit, onUpdate }: AccommodationListProps) {
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
    if (!confirm("Are you sure you want to delete this accommodation?")) return;
    try {
      const backend = getAuthenticatedBackend();
      await backend.accommodation.deleteAccommodation({ id });
      toast({ title: "Success", description: "Accommodation deleted successfully" });
      onUpdate();
    } catch (error) {
      console.error("Failed to delete accommodation:", error);
      toast({ title: "Error", description: "Failed to delete accommodation", variant: "destructive" });
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
    toast({ title: "Copied!", description: `Profile Access Code for ${name} copied to clipboard` });
  };

  const toggleActive = async (accommodation: Accommodation) => {
    setToggling(accommodation.id);
    try {
      const backend = getAuthenticatedBackend();
      await backend.accommodation.update({ id: accommodation.id, isActive: !accommodation.isActive });
      toast({ title: "Success", description: `Accommodation ${!accommodation.isActive ? "activated" : "deactivated"} successfully` });
      onUpdate();
    } catch (error) {
      console.error("Failed to toggle status:", error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  if (accommodations.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No accommodations found</div>;
  }

  return (
    <div className="space-y-1">
      {accommodations.map((accommodation) => {
        const isOpen = openIds.has(accommodation.id);
        return (
          <Collapsible key={accommodation.id} open={isOpen} onOpenChange={() => toggleOpen(accommodation.id)}>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-2">
                <div className="flex items-center justify-between gap-2">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      {isOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                      <h3 className="font-semibold text-sm text-foreground truncate min-w-[120px]">{accommodation.name}</h3>
                      {accommodation.isDuplicate && (
                        <Badge variant="destructive" className="text-xs shrink-0" title={accommodation.duplicateReason || "Duplicate Entry"}>
                          Duplicate
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground truncate">{accommodation.postalCode}</span>
                      <span className="text-xs text-muted-foreground truncate">{accommodation.province}</span>
                    </button>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-2 shrink-0">
                    {accommodation.profileReferenceCode && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-muted-foreground">{accommodation.profileReferenceCode}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyProfileCode(accommodation.profileReferenceCode, accommodation.name)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={accommodation.isActive}
                        onCheckedChange={() => toggleActive(accommodation)}
                        disabled={toggling === accommodation.id}
                        className="data-[state=checked]:bg-green-600"
                      />
                      <span className="text-xs text-muted-foreground">{accommodation.isActive ? "Active" : "Disabled"}</span>
                    </div>
                    <div className="flex gap-1">
                      {accommodation.latitude != null && accommodation.longitude != null && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => getDirections(accommodation.latitude!, accommodation.longitude!, accommodation.id)}
                          disabled={gettingDirections === accommodation.id}
                          className="h-7 w-7 p-0"
                        >
                          {gettingDirections === accommodation.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => onEdit(accommodation)} className="h-7 w-7 p-0">
                        <Edit className="w-4 h-4" />
                      </Button>
                      {user.role === "SuperAdmin" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(accommodation.id)}
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
                      <FieldRow label="Name" value={accommodation.name} />
                      <FieldRow label="Address" value={accommodation.address} />
                      <FieldRow label="Country" value={accommodation.country} />
                      <FieldRow label="Province" value={accommodation.province} />
                      <FieldRow label="Area" value={accommodation.area} />
                      <FieldRow label="Postal Code" value={accommodation.postalCode} />
                      <FieldRow label="Profile Reference Code" value={accommodation.profileReferenceCode} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Location</p>
                      <FieldRow label="Latitude" value={accommodation.latitude} />
                      <FieldRow label="Longitude" value={accommodation.longitude} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Accessibility & Facilities</p>
                      <FieldRow label="Wheelchair Access" value={accommodation.wheelchairAccess} />
                      <FieldRow label="Parking Availability" value={accommodation.parkingAvailability} />
                      <FieldRow
                        label="Facilities"
                        value={accommodation.facilities && accommodation.facilities.length > 0 ? accommodation.facilities.join(", ") : null}
                      />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">WiFi</p>
                      <FieldRow label="WiFi Name" value={accommodation.wifiName} />
                      <FieldRow label="WiFi Password" value={accommodation.wifiPassword} />
                      <FieldRow label="WiFi Credentials" value={accommodation.wifiCredentials} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Check-In / Check-Out</p>
                      <FieldRow label="Check-In Instructions" value={accommodation.checkInInstructions} />
                      <FieldRow label="Check-Out Instructions" value={accommodation.checkOutInstructions} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Amenities & Guidelines</p>
                      <FieldRow label="Amenities" value={accommodation.amenities} />
                      <FieldRow label="Guidelines" value={accommodation.guidelines} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Contact Information</p>
                      <FieldRow label="Primary Contact" value={accommodation.primaryContact} />
                      <FieldRow label="Police Contact" value={accommodation.policeContact} />
                      <FieldRow label="Doctor Contact" value={accommodation.doctorContact} />
                      <FieldRow label="Ambulance Contact" value={accommodation.ambulanceContact} />
                      <FieldRow label="Hospital Contact" value={accommodation.hospitalContact} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Emergency Contacts</p>
                      {accommodation.emergencyContacts && accommodation.emergencyContacts.length > 0 ? (
                        accommodation.emergencyContacts.map((ec, i) => (
                          <div key={i} className="pl-2 mb-1">
                            <FieldRow label={`Role`} value={ec.role} />
                            <FieldRow label={`Name`} value={ec.name} />
                            <FieldRow label={`Number`} value={ec.number} />
                          </div>
                        ))
                      ) : (
                        <div className="grid grid-cols-2 gap-2 py-1">
                          <span className="text-xs font-medium text-muted-foreground">Emergency Contacts</span>
                          <span className="text-xs text-muted-foreground italic">{FALLBACK}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Image</p>
                      {accommodation.imageUrl ? (
                        <a href={accommodation.imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline break-all">
                          {accommodation.imageUrl}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">{FALLBACK}</span>
                      )}
                    </div>

                    {accommodation.profileReferenceCode && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Profile QR Code</p>
                        <ProfileQRCode
                          profileName={accommodation.name}
                          profileCode={accommodation.profileReferenceCode}
                          entityType="accommodation"
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
