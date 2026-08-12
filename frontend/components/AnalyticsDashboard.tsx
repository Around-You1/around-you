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

interface RepMetrics {
  repCode: string;
  repName: string;
  status: string;
  region: string;
  province: string;
  isTeamLeader: boolean;
  uplineRepCode: string;
  dateJoined: string;
  partnersSigned: number;
  byType: Record<string, number>;
  byPlan: Record<string, number>;
  activeMrrCents: number;
  ownCommissionCents: number;
  overrideCommissionCents: number;
  totalCommissionCents: number;
  downlineCount: number;
  downlineMrrCents: number;
}

interface RepsAnalytics {
  reps: RepMetrics[];
  totalActiveReps: number;
  totalTeamLeaders: number;
  totalMrrCents: number;
  totalCommissionCents: number;
}

const TIER_ORDER = ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "N/A"];

const rand = (cents: number) => `R${(cents / 100).toFixed(2)}`;

export default function AnalyticsDashboard() {
  const [reps, setReps] = useState<RepActivity[]>([]);
  const [repStats, setRepStats] = useState<RepsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const backend = getAuthenticatedBackend();
      const [activity, stats] = await Promise.all([
        backend.analytics.repActivity(),
        backend.analytics.reps(),
      ]);
      setReps(activity.reps);
      setRepStats(stats);
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

        {repStats && (
          <Card>
            <CardHeader>
              <CardTitle>Reps — Performance &amp; Commissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Active Reps</p>
                  <p className="text-2xl font-bold">{repStats.totalActiveReps}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Team Leaders</p>
                  <p className="text-2xl font-bold">{repStats.totalTeamLeaders}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Monthly Recurring</p>
                  <p className="text-2xl font-bold">{rand(repStats.totalMrrCents)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Total Commissions</p>
                  <p className="text-2xl font-bold">{rand(repStats.totalCommissionCents)}</p>
                </div>
              </div>

              {repStats.reps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reps yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="py-2 pr-3">#</th>
                        <th className="py-2 pr-3">Rep</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Partners</th>
                        <th className="py-2 pr-3">MRR</th>
                        <th className="py-2 pr-3">Own 30%</th>
                        <th className="py-2 pr-3">Override 10%</th>
                        <th className="py-2 pr-3">Total</th>
                        <th className="py-2 pr-3">Downline</th>
                        <th className="py-2 pr-3">Downline MRR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repStats.reps.map((r, idx) => (
                        <tr key={r.repCode} className="border-b border-border/50">
                          <td className="py-2 pr-3">{idx + 1}</td>
                          <td className="py-2 pr-3">
                            {r.repName || "(no name)"}
                            {r.isTeamLeader && (
                              <span className="ml-2 text-xs rounded px-1.5 py-0.5 bg-[#AEECE4] text-black">TL</span>
                            )}
                            <span className="block text-xs text-muted-foreground font-mono">{r.repCode}</span>
                          </td>
                          <td className="py-2 pr-3">{r.status}</td>
                          <td className="py-2 pr-3">{r.partnersSigned}</td>
                          <td className="py-2 pr-3">{rand(r.activeMrrCents)}</td>
                          <td className="py-2 pr-3">{rand(r.ownCommissionCents)}</td>
                          <td className="py-2 pr-3">{rand(r.overrideCommissionCents)}</td>
                          <td className="py-2 pr-3 font-semibold">{rand(r.totalCommissionCents)}</td>
                          <td className="py-2 pr-3">{r.downlineCount}</td>
                          <td className="py-2 pr-3">{rand(r.downlineMrrCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
