import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { UserPlus, Copy, Save, ChevronDown } from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";

interface Accountant {
  id: number;
  fullName: string;
  email: string;
  status: string;
  accessCode?: string;
}

const selectClass =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm";

// Per-accountant accounts: register here, a SuperAdmin activates each one, and
// activation emails the accountant a welcome with their 12-char access code.
// The single shared "Accountant Access Code" card above still works as a
// fallback for anyone who hasn't been moved to a personal account yet.
export default function AccountantsCard() {
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const toggleOpen = (id: number) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const data = await backend.auth.listAccountants();
      setAccountants(data.accountants || []);
    } catch (error) {
      console.error("Failed to load accountants:", error);
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
      const result = await backend.auth.createAccountant({ fullName: fullName.trim(), email: email.trim() });
      toast({ title: "Accountant added", description: `${result.fullName} — code: ${result.accessCode}` });
      setFullName("");
      setEmail("");
      load();
    } catch (error: any) {
      console.error("Failed to create accountant:", error);
      toast({ title: "Error", description: error?.message || "Failed to create accountant", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const setField = (id: number, patch: Partial<Accountant>) =>
    setAccountants((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const handleSave = async (acc: Accountant) => {
    setSavingId(acc.id);
    try {
      const backend = getAuthenticatedBackend();
      await backend.auth.updateAccountant({
        id: acc.id,
        fullName: acc.fullName || "",
        email: acc.email || "",
        status: acc.status || "Active",
      });
      toast({
        title: "Accountant updated",
        description:
          acc.status === "Active"
            ? `${acc.fullName} saved — if newly activated, a welcome email with their code was sent.`
            : `${acc.fullName} saved`,
      });
      load();
    } catch (error: any) {
      console.error("Failed to update accountant:", error);
      toast({ title: "Error", description: error?.message || "Failed to update accountant", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const copyCode = (code?: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast({ title: "Copied", description: `${code} copied to clipboard` });
  };

  const activeCount = accountants.filter((a) => a.status === "Active").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Accountants ({accountants.length}) · Active ({activeCount})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Register individual accountants here. Each gets their own 12-character access code, generated
          automatically. New accountants start <b>Inactive</b> — set them to <b>Active</b> and Save to send a
          welcome email containing their access code. They sign in on the Accountant button using just that code.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="acc-full-name-input">Full Name</Label>
            <Input
              id="acc-full-name-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Sam Ndlovu"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="acc-email-input">Email (for the welcome code)</Label>
            <Input
              id="acc-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. sam@example.com"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <Button onClick={handleCreate} disabled={creating} className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black">
            <UserPlus className="w-4 h-4 mr-2" />
            {creating ? "Adding…" : "Add Accountant"}
          </Button>
        </div>

        {accountants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accountant accounts yet — add one above.</p>
        ) : (
          <div className="space-y-3">
            {accountants.map((acc) => {
              const isOpen = openIds.has(acc.id);
              return (
                <div key={acc.id} className="rounded-lg border border-border">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleOpen(acc.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleOpen(acc.id);
                      }
                    }}
                    className="flex items-center justify-between gap-3 p-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {acc.fullName}
                          {acc.status !== "Active" && (
                            <span className="ml-2 text-xs rounded px-1.5 py-0.5 bg-yellow-100 text-yellow-800 align-middle">
                              Pending / Inactive
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">{acc.email || "—"}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); copyCode(acc.accessCode); }}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Code
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-3 space-y-3 border-t border-border">
                      <div className="rounded-md bg-muted/40 p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                        {acc.accessCode && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Access Code:</span>
                            <span className="font-mono text-foreground">{acc.accessCode}</span>
                            <Button variant="outline" size="sm" className="h-6 px-2" onClick={() => copyCode(acc.accessCode)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Full legal name</Label>
                          <Input value={acc.fullName || ""} onChange={(e) => setField(acc.id, { fullName: e.target.value })} placeholder="Full name" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Email</Label>
                          <Input type="email" value={acc.email || ""} onChange={(e) => setField(acc.id, { email: e.target.value })} placeholder="accountant@example.com" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Status</Label>
                          <select
                            className={selectClass}
                            value={acc.status || "Active"}
                            onChange={(e) => setField(acc.id, { status: e.target.value })}
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleSave(acc)}
                          disabled={savingId === acc.id}
                          className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {savingId === acc.id ? "Saving…" : "Save"}
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
