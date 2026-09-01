import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { UserPlus, Copy, Save, ChevronDown, Trash2 } from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";

interface Rep {
  id: number;
  fullName: string;
  repCode: string;
  uplineRepCode: string;
  isTeamLeader: boolean;
  region: string;
  province: string;
  status: string;
  email: string;
  accessCode?: string;
  idNumber?: string;
  phone?: string;
  residentialAddress?: string;
  postalCode?: string;
}

const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];

const selectClass =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm";

export default function RepsTab() {
  const [reps, setReps] = useState<Rep[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const toggleOpen = (id: number) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  useEffect(() => {
    loadReps();
  }, []);

  const loadReps = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const data = await backend.auth.listReps();
      setReps(data.reps);
    } catch (error) {
      console.error("Failed to load reps:", error);
      toast({ title: "Error", description: "Failed to load reps", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!fullName.trim()) {
      toast({ title: "Validation Error", description: "Full name is required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const backend = getAuthenticatedBackend();
      const result = await backend.auth.createRep({ fullName: fullName.trim(), email: email.trim() });
      toast({ title: "Rep created", description: `${result.fullName} — code: ${result.repCode}` });
      setFullName("");
      setEmail("");
      loadReps();
    } catch (error: any) {
      console.error("Failed to create rep:", error);
      toast({ title: "Error", description: error?.message || "Failed to create rep", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // Update one rep's field in local state (inputs are controlled off `reps`).
  const setRepField = (id: number, patch: Partial<Rep>) =>
    setReps((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const handleSaveRep = async (rep: Rep) => {
    setSavingId(rep.id);
    try {
      const backend = getAuthenticatedBackend();
      await backend.auth.updateRep({
        repCode: rep.repCode,
        uplineRepCode: rep.uplineRepCode || "",
        isTeamLeader: rep.isTeamLeader,
        region: rep.region || "",
        province: rep.province || "",
        status: rep.status || "Active",
        email: rep.email || "",
        idNumber: rep.idNumber || "",
        phone: rep.phone || "",
        residentialAddress: rep.residentialAddress || "",
        postalCode: rep.postalCode || "",
      });
      toast({ title: "Rep updated", description: `${rep.fullName} saved` });
      loadReps(); // reflect auto Team-Leader promotion of the chosen upline
    } catch (error: any) {
      console.error("Failed to update rep:", error);
      toast({ title: "Error", description: error?.message || "Failed to update rep", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteRep = async (rep: Rep) => {
    if (!window.confirm(`Delete ${rep.fullName || rep.repCode} (${rep.repCode})? This permanently removes the application and can't be undone.`)) {
      return;
    }
    setDeletingId(rep.id);
    try {
      const backend = getAuthenticatedBackend();
      await backend.auth.deleteRep({ repCode: rep.repCode });
      toast({ title: "Rep deleted", description: `${rep.fullName || rep.repCode} removed` });
      loadReps();
    } catch (error: any) {
      console.error("Failed to delete rep:", error);
      toast({ title: "Couldn't delete", description: error?.message || "Failed to delete rep", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied", description: `${code} copied to clipboard` });
  };

  const teamLeaderCount = reps.filter((r) => r.isTeamLeader).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Rep</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="rep-full-name-input">Full Name</Label>
              <Input
                id="rep-full-name-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Adams"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="rep-email-input">Email (optional)</Label>
              <Input
                id="rep-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. jane@example.com"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <Button onClick={handleCreate} disabled={creating} className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black">
              <UserPlus className="w-4 h-4 mr-2" />
              {creating ? "Adding…" : "Add Rep"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            A rep code (e.g. Rep00000001) is generated automatically — give the rep both their full name and this code so they can sign in.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Existing Reps ({reps.length}) · Team Leaders ({teamLeaderCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reps yet — add one above.</p>
          ) : (
            <div className="space-y-3">
              {reps.map((rep) => {
                const isOpen = openIds.has(rep.id);
                return (
                <div key={rep.id} className="rounded-lg border border-border">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleOpen(rep.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleOpen(rep.id); } }}
                    className="flex items-center justify-between gap-3 p-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {rep.fullName}
                          {rep.isTeamLeader && (
                            <span className="ml-2 text-xs rounded px-1.5 py-0.5 bg-[#AEECE4] text-black align-middle">
                              Team Leader
                            </span>
                          )}
                          {rep.status === "Inactive" && (
                            <span className="ml-2 text-xs rounded px-1.5 py-0.5 bg-yellow-100 text-yellow-800 align-middle">
                              Pending / Inactive
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground font-mono">{rep.repCode}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); copyCode(rep.repCode); }}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Code
                    </Button>
                  </div>

                  {isOpen && (
                  <div className="px-3 pb-3 pt-3 space-y-3 border-t border-border">
                  <div className="rounded-md bg-muted/40 p-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                      <div><span className="text-muted-foreground">Full legal name: </span><span className="font-medium">{rep.fullName || "—"}</span></div>
                      {rep.accessCode && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Access Code:</span>
                          <span className="font-mono text-foreground">{rep.accessCode}</span>
                          <Button variant="outline" size="sm" className="h-6 px-2" onClick={() => copyCode(rep.accessCode)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">SA ID / Passport Number</Label>
                        <Input value={rep.idNumber || ""} onChange={(e) => setRepField(rep.id, { idNumber: e.target.value })} placeholder="ID / Passport" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Mobile</Label>
                        <Input value={rep.phone || ""} onChange={(e) => setRepField(rep.id, { phone: e.target.value })} placeholder="Mobile number" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Residential Address</Label>
                        <Input value={rep.residentialAddress || ""} onChange={(e) => setRepField(rep.id, { residentialAddress: e.target.value })} placeholder="Residential address" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Postal Code</Label>
                        <Input value={rep.postalCode || ""} onChange={(e) => setRepField(rep.id, { postalCode: e.target.value })} placeholder="Postal code" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Upline (Team Leader)</Label>
                      <select
                        className={selectClass}
                        value={rep.uplineRepCode}
                        onChange={(e) => setRepField(rep.id, { uplineRepCode: e.target.value })}
                      >
                        <option value="">— None —</option>
                        {reps
                          .filter((o) => o.repCode !== rep.repCode)
                          .map((o) => (
                            <option key={o.id} value={o.repCode}>
                              {o.fullName} ({o.repCode})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Province</Label>
                      <select
                        className={selectClass}
                        value={rep.province}
                        onChange={(e) => setRepField(rep.id, { province: e.target.value })}
                      >
                        <option value="">— None —</option>
                        {PROVINCES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Region</Label>
                      <Input
                        value={rep.region}
                        onChange={(e) => setRepField(rep.id, { region: e.target.value })}
                        placeholder="e.g. Garden Route"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <select
                        className={selectClass}
                        value={rep.status || "Active"}
                        onChange={(e) => setRepField(rep.id, { status: e.target.value })}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        value={rep.email}
                        onChange={(e) => setRepField(rep.id, { email: e.target.value })}
                        placeholder="rep@example.com"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={rep.isTeamLeader}
                        onChange={(e) => setRepField(rep.id, { isTeamLeader: e.target.checked })}
                      />
                      Team Leader
                    </label>
                    <div className="flex items-center gap-2">
                      {rep.status === "Inactive" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteRep(rep)}
                          disabled={deletingId === rep.id}
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {deletingId === rep.id ? "Deleting…" : "Delete"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleSaveRep(rep)}
                        disabled={savingId === rep.id}
                        className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {savingId === rep.id ? "Saving…" : "Save"}
                      </Button>
                    </div>
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
    </div>
  );
}
