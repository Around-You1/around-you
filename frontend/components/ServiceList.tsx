import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Edit, Trash2, Navigation, Loader2, Copy, ChevronDown, ChevronRight, Star } from "lucide-react";
import ProfileQRCode from "./ProfileQRCode";
import ProfileClassificationGroups from "./ProfileClassificationGroups";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { getCurrentPosition, buildDirectionsUrl } from "../lib/geolocation";
import type { ServiceData } from "~backend/service/types";

interface ServiceListProps {
  onEdit: (serviceId: string) => void;
  onUpdate?: () => void;
  searchQuery?: string;
  sortBy?: string;
  sortOrder?: string;
}

const FALLBACK = "The company has opted not to make this information visible.";

// StarRatingDisplay is read-only here — admins/partners can see how a
// listing is rated, but the actual vote is cast on the guest-facing side,
// not from this internal management list.
function StarRatingDisplay({ average, count }: { average: number; count: number }) {
  if (!count) {
    return <span className="text-xs text-muted-foreground italic shrink-0">No ratings yet</span>;
  }
  return (
    <span
      className="flex items-center gap-1 text-xs shrink-0"
      title={`${average.toFixed(1)} out of 5, from ${count} rating${count === 1 ? "" : "s"}`}
    >
      <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
      <span className="font-medium text-foreground">{average.toFixed(1)}</span>
      <span className="text-muted-foreground">({count})</span>
    </span>
  );
}

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

export default function ServiceList({ onEdit, onUpdate, searchQuery = "", sortBy = "created_at", sortOrder = "desc" }: ServiceListProps) {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [gettingDirections, setGettingDirections] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<number, { averageRating: number; ratingCount: number }>>({});
  const { toast } = useToast();
  const isAdmin = (JSON.parse(localStorage.getItem("user") || "{}").role) === "SuperAdmin";
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleSel = (id: number) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const clearSel = () => setSelected(new Set());

  const bulkActive = async (active: boolean) => {
    setBulkBusy(true);
    try {
      const backend = getAuthenticatedBackend();
      await backend.admin.bulkSetActive({ entityType: "service", ids: Array.from(selected), active });
      toast({
        title: active ? "Set Active" : "Set Non-Active",
        description: `${selected.size} updated. ${active ? "New access & edit codes issued." : "Access & edit codes disabled."}`,
      });
      clearSel();
      loadServices();
      onUpdate?.();
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Bulk update failed", variant: "destructive" });
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} selected service(s)? They'll be archived and can be reinstated later from the Archived tab.`)) return;
    setBulkBusy(true);
    try {
      const backend = getAuthenticatedBackend();
      await backend.admin.bulkDelete({ entityType: "service", ids: Array.from(selected) });
      toast({ title: "Deleted", description: `${selected.size} service(s) archived.` });
      clearSel();
      loadServices();
      onUpdate?.();
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Bulk delete failed", variant: "destructive" });
    } finally {
      setBulkBusy(false);
    }
  };

  useEffect(() => {
    if (services.length === 0) return;
    const backend = getAuthenticatedBackend();
    backend.rating
      .listSummaries({ entityType: "service", entityIds: services.map((s) => s.id) })
      .then((res) => {
        const byId: Record<number, { averageRating: number; ratingCount: number }> = {};
        for (const s of res.summaries) {
          byId[s.entityId] = { averageRating: s.averageRating, ratingCount: s.ratingCount };
        }
        setRatings(byId);
      })
      .catch((error) => console.error("Failed to load ratings:", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services.map((s) => s.id).join(",")]);

  const filteredServices = services.filter((service) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      service.name.toLowerCase().includes(query) ||
      service.address.toLowerCase().includes(query) ||
      service.postalCode.toLowerCase().includes(query) ||
      service.serviceCategories.some((cat) => cat.toLowerCase().includes(query))
    );
  });

  useEffect(() => {
    loadServices();
  }, [sortBy, sortOrder]);

  const loadServices = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const data = await backend.service.list({ sortBy: sortBy as any, sortOrder: sortOrder as any });
      setServices(data.services);
    } catch (error) {
      console.error("Failed to load services:", error);
      toast({ title: "Error", description: "Failed to load services", variant: "destructive" });
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

  const handleDelete = async (serviceId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const backend = getAuthenticatedBackend();
      await backend.service.deleteService({ serviceId });
      toast({ title: "Success", description: "Service deleted successfully" });
      loadServices();
      onUpdate?.();
    } catch (error) {
      console.error("Delete failed:", error);
      toast({ title: "Error", description: "Failed to delete service", variant: "destructive" });
    }
  };

  const handleNavigate = async (latitude: number, longitude: number, serviceId: string) => {
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      toast({ title: "Error", description: "Invalid coordinates for this location", variant: "destructive" });
      return;
    }
    setGettingDirections(serviceId);
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



  const toggleActive = async (service: ServiceData) => {
    setToggling(service.serviceId);
    try {
      const backend = getAuthenticatedBackend();
      await backend.service.update({ serviceId: service.serviceId, isActive: !service.isActive });
      toast({ title: "Success", description: `Service ${!service.isActive ? "activated" : "deactivated"} successfully` });
      loadServices();
      onUpdate?.();
    } catch (error) {
      console.error("Failed to toggle status:", error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  if (loading) return <div className="text-center py-8">Loading services...</div>;
  if (services.length === 0) return <div className="text-center py-12 text-muted-foreground">No services found. Add your first service to get started.</div>;
  if (filteredServices.length === 0) return <div className="text-center py-12 text-muted-foreground">No services match your search criteria.</div>;

  return (
    <div className="space-y-1">
      {isAdmin && selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-border bg-background/95 backdrop-blur p-2 shadow-sm">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkActive(false)} disabled={bulkBusy}>Set Non-Active</Button>
          <Button size="sm" variant="outline" onClick={() => bulkActive(true)} disabled={bulkBusy}>Set Active</Button>
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={bulkDelete} disabled={bulkBusy}>Delete</Button>
          <Button size="sm" variant="ghost" onClick={clearSel} disabled={bulkBusy}>Clear</Button>
        </div>
      )}
      {filteredServices.map((service) => {
        const isOpen = openIds.has(service.serviceId);
        return (
          <Collapsible key={service.serviceId} open={isOpen} onOpenChange={() => toggleOpen(service.serviceId)}>
            <Card>
              <CardContent className="p-2">
                <div className="flex items-center justify-between gap-2">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={selected.has(service.id)}
                      onChange={() => toggleSel(service.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 shrink-0 accent-green-600"
                      title="Select for bulk action"
                    />
                  )}
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      {isOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                      <h3 className="font-semibold text-sm text-foreground truncate min-w-[120px]">{service.name}</h3>
                      <StarRatingDisplay
                        average={ratings[service.id]?.averageRating ?? 0}
                        count={ratings[service.id]?.ratingCount ?? 0}
                      />
                      {service.isDuplicate && (
                        <Badge variant="destructive" className="text-xs shrink-0" title={service.duplicateReason || "Duplicate Entry"}>
                          Duplicate
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground truncate">{service.postalCode}</span>
                      {service.serviceCategories.length > 0 && (
                        <span className="text-xs text-muted-foreground truncate">{service.serviceCategories.slice(0, 1).join(", ")}</span>
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-2 shrink-0">
                    {service.profileReferenceCode && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-muted-foreground">{service.profileReferenceCode}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyProfileCode(service.profileReferenceCode, service.name)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={service.isActive}
                        onCheckedChange={() => toggleActive(service)}
                        disabled={toggling === service.serviceId}
                        className="data-[state=checked]:bg-green-600"
                      />
                      <span className="text-xs text-muted-foreground">{service.isActive ? "Active" : "Disabled"}</span>
                    </div>
                    <div className="flex gap-1">
                      {service.latitude != null && service.longitude != null && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleNavigate(service.latitude!, service.longitude!, service.serviceId)}
                          disabled={gettingDirections === service.serviceId}
                          className="h-7 w-7 p-0"
                        >
                          {gettingDirections === service.serviceId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => onEdit(service.serviceId)} className="h-7 w-7 p-0">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(service.serviceId, service.name)}
                        className="text-destructive hover:text-destructive h-7 w-7 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="mt-3 pt-3 border-t border-border space-y-4">
                    {service.profileReferenceCode && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Profile QR Code</p>
                        <ProfileClassificationGroups
                          guestType={service.guestType}
                          accessLevel={service.accessLevel}
                        />
                        <ProfileQRCode
                          profileName={service.name}
                          profileCode={service.profileReferenceCode}
                          entityType="service"
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
