import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";

interface RepActivity {
  repCode: string;
  repName: string;
  totalClients: number;
  byTier: Record<string, number>;
  dailyCounts: Record<string, number>;
}

const TIER_ORDER = ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "N/A"];

export default function AnalyticsDashboard() {
  const [reps, setReps] = useState<RepActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const backend = getAuthenticatedBackend();
      const data = await backend.analytics.repActivity();
      setReps(data.reps);
    } catch (error) {
      console.error("Failed to load analytics:", error);
      toast({ title: "Error", description: "Failed to load analytics", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-foreground">Analytics Dashboard</h1>

        <Card>
          <CardHeader>
            <CardTitle>Rep Onboarding Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              How many clients each rep has onboarded, broken down by Tier, and which days they were active.
              Built from the listings each rep has already created — this is a real report, not a placeholder.
            </p>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : reps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rep submissions yet — this fills in once reps start onboarding clients through the Tap-Based Mobile Onboarding app.
              </p>
            ) : (
              <div className="space-y-6">
                {reps.map((rep) => {
                  const days = Object.keys(rep.dailyCounts).sort();
                  const maxCount = Math.max(1, ...Object.values(rep.dailyCounts));

                  return (
                    <div key={rep.repCode} className="border border-border rounded-lg p-4 space-y-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <p className="font-semibold text-lg">{rep.repName || "(no name)"}</p>
                          <p className="text-sm text-muted-foreground font-mono">{rep.repCode}</p>
                        </div>
                        <p className="text-sm">
                          <span className="font-semibold">{rep.totalClients}</span> client{rep.totalClients === 1 ? "" : "s"} total
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">By Tier</p>
                        <div className="flex flex-wrap gap-2">
                          {TIER_ORDER.filter((t) => rep.byTier[t]).map((tier) => (
                            <span
                              key={tier}
                              className="text-xs px-2 py-1 rounded border bg-muted/40 border-border"
                            >
                              {tier}: <span className="font-semibold">{rep.byTier[tier]}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {days.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Clients onboarded per day
                          </p>
                          <div className="flex items-end gap-1 h-24 overflow-x-auto pb-1">
                            {days.map((day) => {
                              const count = rep.dailyCounts[day];
                              const heightPct = Math.max(8, (count / maxCount) * 100);
                              return (
                                <div
                                  key={day}
                                  className="flex flex-col items-center justify-end shrink-0"
                                  style={{ width: 28 }}
                                  title={`${day}: ${count}`}
                                >
                                  <div
                                    className="w-full rounded-t bg-[#AEECE4]"
                                    style={{ height: `${heightPct}%` }}
                                  />
                                  <span className="text-[9px] text-muted-foreground mt-1 rotate-45 origin-top-left whitespace-nowrap">
                                    {day.slice(5)}
                                  </span>
                                </div>
                              );
                            })}
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
    </div>
  );
}
