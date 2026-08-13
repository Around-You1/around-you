"use client";

import { useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ArrowLeft } from "lucide-react";
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

interface MonthPoint {
  month: string;
  newPartners: number;
  churned: number;
  invoicedCents: number;
  invoices: number;
}

interface BusinessMetrics {
  mrrCents: number;
  activePartners: number;
  arpuCents: number;
  newThisMonth: number;
  churnedThisMonth: number;
  churnRatePct: number;
  ltvCents: number;
  activeReps: number;
  teamLeaders: number;
  bookingGmvCentsMonth: number;
  bookingRevenueCentsMonth: number;
  tierMix: Record<string, number>;
  months: MonthPoint[];
}

interface EventMonth {
  month: string;
  count: number;
}

interface EventsSummary {
  byTypeThisMonth: Record<string, number>;
  qrScanMonths: EventMonth[];
}

const TIER_ORDER = ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "N/A"];

const rand = (cents: number) => `R${(cents / 100).toFixed(2)}`;

// Collapsible section — click the header to expand/collapse, matching the
// dropdown pattern used elsewhere in the app.
function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <span className="text-lg font-semibold">{title}</span>
        <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

export default function AnalyticsDashboard() {
  const router = useRouter();
  const [reps, setReps] = useState<RepActivity[]>([]);
  const [repStats, setRepStats] = useState<RepsAnalytics | null>(null);
  const [bizStats, setBizStats] = useState<BusinessMetrics | null>(null);
  const [events, setEvents] = useState<EventsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const backend = getAuthenticatedBackend();
      const [activity, stats, biz, ev] = await Promise.all([
        backend.analytics.repActivity(),
        backend.analytics.reps(),
        backend.analytics.business(),
        backend.analytics.events(),
      ]);
      setReps(activity.reps);
      setRepStats(stats);
      setBizStats(biz);
      setEvents(ev);
    } catch (error) {
      console.error("Failed to load analytics:", error);
      toast({ title: "Error", description: "Failed to load analytics", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <Button variant="outline" size="sm" onClick={() => router.push("/admin-dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin Dashboard
          </Button>
        </div>

        <h1 className="text-4xl font-bold text-foreground">Analytics Dashboard</h1>

        {bizStats && (
          <Section title="Business Metrics" defaultOpen>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {([
                ["Monthly Recurring (MRR)", rand(bizStats.mrrCents)],
                ["Active Partners", String(bizStats.activePartners)],
                ["ARPU / partner", rand(bizStats.arpuCents)],
                ["Est. LTV / partner", bizStats.ltvCents ? rand(bizStats.ltvCents) : "—"],
                ["New this month", String(bizStats.newThisMonth)],
                ["Churned this month", String(bizStats.churnedThisMonth)],
                ["Monthly churn", `${bizStats.churnRatePct.toFixed(1)}%`],
                ["Booking GMV (this month)", rand(bizStats.bookingGmvCentsMonth)],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
              ))}
            </div>

            <div className="mb-6">
              <p className="text-xs font-medium text-muted-foreground mb-2">Active partners by plan</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(bizStats.tierMix).map(([k, v]) => (
                  <span key={k} className="text-xs px-2 py-1 rounded border bg-muted/40 border-border">
                    {k}: <span className="font-semibold">{v}</span>
                  </span>
                ))}
              </div>
            </div>

            <p className="text-xs font-medium text-muted-foreground mb-2">Last 12 months</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Month</th>
                    <th className="py-2 pr-3">New</th>
                    <th className="py-2 pr-3">Churned</th>
                    <th className="py-2 pr-3">Invoiced revenue</th>
                    <th className="py-2 pr-3">Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {bizStats.months.map((m) => (
                    <tr key={m.month} className="border-b border-border/50">
                      <td className="py-2 pr-3">{m.month}</td>
                      <td className="py-2 pr-3">{m.newPartners}</td>
                      <td className="py-2 pr-3">{m.churned}</td>
                      <td className="py-2 pr-3">{rand(m.invoicedCents)}</td>
                      <td className="py-2 pr-3">{m.invoices}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {events && (
          <Section title="Engagement — QR Scans & Activity">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {Object.entries(events.byTypeThisMonth).length === 0 ? (
                <p className="text-sm text-muted-foreground col-span-full">
                  No events recorded this month yet — QR scans will appear here as people scan partner codes.
                </p>
              ) : (
                Object.entries(events.byTypeThisMonth).map(([type, count]) => (
                  <div key={type} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">{type.replace(/_/g, " ")} (this month)</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                ))
              )}
            </div>

            <p className="text-xs font-medium text-muted-foreground mb-2">QR scans — last 12 months</p>
            <div className="flex items-end gap-1 h-24 overflow-x-auto pb-1">
              {(() => {
                const max = Math.max(1, ...events.qrScanMonths.map((x) => x.count));
                return events.qrScanMonths.map((m) => (
                  <div
                    key={m.month}
                    className="flex flex-col items-center justify-end shrink-0"
                    style={{ width: 40 }}
                    title={`${m.month}: ${m.count}`}
                  >
                    <span className="text-[10px] mb-1">{m.count}</span>
                    <div className="w-full rounded-t bg-[#AEECE4]" style={{ height: `${Math.max(6, (m.count / max) * 100)}%` }} />
                    <span className="text-[9px] text-muted-foreground mt-1">{m.month.slice(2)}</span>
                  </div>
                ));
              })()}
            </div>
          </Section>
        )}

        {repStats && (
          <Section title="Reps — Performance & Commissions">
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
          </Section>
        )}

        <Section title="Rep Onboarding Activity">
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
        </Section>
      </div>
    </div>
  );
}
