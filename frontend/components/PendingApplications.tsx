import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";

interface Application {
  id: number;
  category: string;
  repCode: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactNumber: string;
  province: string;
  fields: Record<string, string>;
  status: string;
  createdAt: string;
}

const CAT_LABEL: Record<string, string> = {
  restaurant: "Restaurant", service: "Service", attraction: "Attraction",
  accommodation: "Accommodation", estate: "Real Estate & Rentals",
};

// Self-service partner applications submitted via /apply. `category` scopes the
// list to one partner type; omit it to show every category (e.g. in Accounts).
export default function PendingApplications({ category }: { category?: string }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const data: any = await backend.partnerApp.list({ category: category || "", status: "Pending" });
      setApps(data.applications || []);
    } catch (error) {
      console.error("Failed to load applications:", error);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const toggle = (id: number) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const setStatus = async (app: Application, status: string) => {
    if (status === "Declined" && !window.confirm(`Decline the application from ${app.businessName}?`)) return;
    setBusyId(app.id);
    try {
      const backend = getAuthenticatedBackend();
      await backend.partnerApp.setStatus({ id: app.id, status });
      toast({
        title: status === "Onboarded" ? "Onboarded" : "Declined",
        description: status === "Onboarded"
          ? `${app.businessName} added as Inactive — open it in the list to set the map location and activate.`
          : app.businessName,
      });
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      // Let the Admin Dashboard refresh its pending badges without a reload.
      if (typeof window !== "undefined") window.dispatchEvent(new Event("pending-apps-changed"));
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to update", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Pending Applications{category ? "" : " (all categories)"} ({apps.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending applications.</p>
        ) : (
          <div className="space-y-3">
            {apps.map((app) => {
              const isOpen = openIds.has(app.id);
              return (
                <div key={app.id} className="rounded-lg border border-border">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggle(app.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(app.id); } }}
                    className="flex items-center justify-between gap-3 p-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{app.businessName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {(category ? "" : (CAT_LABEL[app.category] || app.category) + " · ")}
                          {app.province || "—"}{app.repCode ? ` · Rep ${app.repCode}` : ""} · {app.createdAt}
                        </p>
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-2 space-y-3 border-t border-border">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div><span className="text-muted-foreground">Contact: </span>{app.contactName || "—"}</div>
                        <div><span className="text-muted-foreground">Email: </span>{app.contactEmail || "—"}</div>
                        <div><span className="text-muted-foreground">Phone: </span>{app.contactNumber || "—"}</div>
                        <div><span className="text-muted-foreground">Referring rep: </span>{app.repCode || "—"}</div>
                      </div>
                      {Object.keys(app.fields || {}).length > 0 && (
                        <div className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
                          {Object.entries(app.fields).map(([k, v]) => (
                            <div key={k}><span className="text-muted-foreground">{k}: </span>{v}</div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                          disabled={busyId === app.id} onClick={() => setStatus(app, "Declined")}>
                          Decline
                        </Button>
                        <Button size="sm" className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black"
                          disabled={busyId === app.id} onClick={() => setStatus(app, "Onboarded")}>
                          {busyId === app.id ? "Onboarding…" : "Onboard"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
