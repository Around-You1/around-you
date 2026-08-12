import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { UserPlus, Copy, Save } from "lucide-react";
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
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const { toast } = useToast();

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
      const result = await backend.auth.createRep({ fullName: fullName.trim() });
      toast({ title: "Rep created", description: `${result.fullName} — code: ${result.repCode}` });
      setFullName("");
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
              {reps.map((rep) => (
                <div key={rep.id} className="p-3 rounded-lg border border-border space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {rep.fullName}
                        {rep.isTeamLeader && (
                          <span className="ml-2 text-xs rounded px-1.5 py-0.5 bg-[#AEECE4] text-black align-middle">
                            Team Leader
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground font-mono">{rep.repCode}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyCode(rep.repCode)}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Code
                    </Button>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
