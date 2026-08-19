"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";

interface Flag {
  id: number;
  source: string;
  entityType: string;
  entityId: number;
  subject: string;
  field: string;
  category: string;
  matchedTerm: string;
  snippet: string;
  actor: string;
  status: string;
  reviewedBy: string;
  reviewedAt: string;
  createdAt: string;
}

const sourceLabel = (s: string) =>
  s === "rep_onboarding" ? "Rep onboarding" : s === "duplicate" ? "Duplicate check" : "Partner profile";

const baseCat = (c: string) => c.replace(/^ai:/, "");
const isAI = (c: string) => c.startsWith("ai:");

const catClass = (cat: string) => {
  const b = baseCat(cat);
  if (b === "discrimination" || b === "abuse") return "text-red-600 font-semibold";
  if (cat === "duplicate") return "text-blue-600 font-medium";
  return "text-amber-600 font-medium";
};

const catLabel = (cat: string) => (isAI(cat) ? "AI · " : "") + baseCat(cat);

export default function ModerationTab({
  onCountChange,
}: {
  onCountChange?: (openCount: number) => void;
}) {
  const { toast } = useToast();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const backend = getAuthenticatedBackend();
      const res = await backend.moderation.flags();
      setFlags(((res as any).flags || []) as Flag[]);
      onCountChange?.(Number((res as any).openCount || 0));
    } catch (error: any) {
      toast({ title: "Couldn't load flags", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: number, status: string) => {
    try {
      const backend = getAuthenticatedBackend();
      await backend.moderation.setFlagStatus({ id, status });
      setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
      onCountChange?.(
        flags.filter((f) => (f.id === id ? status : f.status) === "open").length
      );
      toast({ title: "Flag updated", description: `Marked ${status}.` });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to update", variant: "destructive" });
    }
  };

  const visible = showResolved ? flags : flags.filter((f) => f.status === "open");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Moderation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Flagged submissions and duplicate profiles are listed here for review. Hate speech and
          threats are hard-blocked at submission; profanity, AI-detected nuance, and duplicates are
          saved and flagged. Mark each one <strong>reviewed</strong> (checked/fixed) or
          <strong> dismissed</strong> (not a real problem). Duplicates are kept until you remove them —
          the original always stays. Fixing content and re-saving clears its open flags automatically.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show reviewed / dismissed too
        </label>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {flags.length === 0 ? "No flagged content." : "No open flags — all clear."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Subject</th>
                  <th className="py-2 pr-3">Where</th>
                  <th className="py-2 pr-3">Field</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Term</th>
                  <th className="py-2 pr-3">Snippet</th>
                  <th className="py-2 pr-3">Submitted by</th>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((f) => (
                  <tr
                    key={f.id}
                    className={`border-b border-border/50 ${f.status === "open" ? "bg-red-500/5" : "opacity-60"}`}
                  >
                    <td className="py-2 pr-3">{f.subject || "—"}</td>
                    <td className="py-2 pr-3">
                      {sourceLabel(f.source)}
                      {f.entityType ? <span className="text-muted-foreground"> · {f.entityType}</span> : null}
                    </td>
                    <td className="py-2 pr-3">{f.field}</td>
                    <td className={`py-2 pr-3 capitalize ${catClass(f.category)}`}>{catLabel(f.category)}</td>
                    <td className="py-2 pr-3 font-mono">{f.matchedTerm}</td>
                    <td className="py-2 pr-3 max-w-[240px] truncate" title={f.snippet}>{f.snippet}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{f.actor || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{f.createdAt}</td>
                    <td className="py-2 pr-3">
                      <select
                        className="h-8 rounded-md border border-border bg-background px-1 text-xs"
                        value={f.status}
                        onChange={(e) => setStatus(f.id, e.target.value)}
                      >
                        <option value="open">Open</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="dismissed">Dismissed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
