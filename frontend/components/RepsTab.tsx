import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { UserPlus, Copy } from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";

interface Rep {
  id: number;
  fullName: string;
  repCode: string;
}

export default function RepsTab() {
  const [reps, setReps] = useState<Rep[]>([]);
  const [fullName, setFullName] = useState("");
  const [creating, setCreating] = useState(false);
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
      toast({
        title: "Error",
        description: "Failed to load reps",
        variant: "destructive",
      });
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
      toast({
        title: "Rep created",
        description: `${result.fullName} — code: ${result.repCode}`,
      });
      setFullName("");
      loadReps();
    } catch (error: any) {
      console.error("Failed to create rep:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create rep",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied", description: `${code} copied to clipboard` });
  };

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
          <CardTitle>Existing Reps ({reps.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {reps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reps yet — add one above.</p>
          ) : (
            <div className="space-y-2">
              {reps.map((rep) => (
                <div
                  key={rep.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div>
                    <p className="font-medium">{rep.fullName}</p>
                    <p className="text-sm text-muted-foreground font-mono">{rep.repCode}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyCode(rep.repCode)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Code
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
