"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut } from "lucide-react";
import AppLogo from "../components/AppLogo";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";

interface Invoice {
  id: number;
  invoiceNumber: string;
  partnerType: string;
  partnerId: number;
  billName: string;
  totalCents: number;
  status: string;
  issuedAt: string;
  dueAt: string;
  paidAt: string;
}

interface Summary {
  invoiceCount: number;
  totalInvoicedCents: number;
  totalPaidCents: number;
  outstandingCents: number;
  overdueCount: number;
  overdueCents: number;
}

interface RepStatement {
  repCode: string;
  ownCents: number;
  overrideCents: number;
  totalCents: number;
  paidCents: number;
  accruedCents: number;
}

interface CommissionRollup {
  totalCents: number;
  totalPaidCents: number;
  totalAccruedCents: number;
  byRep: RepStatement[];
}

interface BookingRow {
  id: number;
  entityType: string;
  entityName: string;
  customerName: string;
  bookingDate: string;
  totalCents: number;
  commissionCents: number;
  status: string;
  createdAt: string;
}

interface BookingLedger {
  rows: BookingRow[];
  count: number;
  totalValueCents: number;
  totalCommissionCents: number;
}

const rand = (c: number) => `R${(c / 100).toFixed(2)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

function StatCard({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${danger ? "text-red-600" : ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AccDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<CommissionRollup | null>(null);
  const [ledger, setLedger] = useState<BookingLedger | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const backend = getAuthenticatedBackend();
      const [inv, sum, com, bk] = await Promise.all([
        backend.accounts.invoices(),
        backend.accounts.summary(),
        backend.accounts.commissions(),
        backend.accounts.bookings(),
      ]);
      setInvoices(((inv as any).invoices || []) as Invoice[]);
      setSummary(((sum as any).summary || null) as Summary | null);
      setCommissions(((com as any).rollup || null) as CommissionRollup | null);
      setLedger(((bk as any).ledger || null) as BookingLedger | null);
    } catch (error: any) {
      toast({ title: "Couldn't load accounts", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (id: number, status: string) => {
    try {
      const backend = getAuthenticatedBackend();
      await backend.accounts.setInvoiceStatus({ id, status });
      setInvoices((prev) =>
        prev.map((v) => (v.id === id ? { ...v, status, paidAt: status === "Paid" ? todayStr() : "" } : v))
      );
      const sum = await backend.accounts.summary();
      setSummary(((sum as any).summary || null) as Summary | null);
      toast({ title: "Invoice updated", description: `Marked ${status}.` });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to update", variant: "destructive" });
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.replace("/");
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? invoices.filter((v) => v.billName.toLowerCase().includes(q) || v.invoiceNumber.toLowerCase().includes(q))
    : invoices;

  const isOverdue = (v: Invoice) =>
    v.status !== "Paid" && v.status !== "Void" && v.dueAt !== "" && v.dueAt < todayStr();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/20 to-background p-6">
      <div className="max-w-6xl mx-auto space-y-8 py-8">
        <div className="relative text-center">
          <div className="flex justify-center mb-2"><AppLogo src="/logo-dark.png" /></div>
          <h1 className="text-4xl font-bold text-foreground">Accountant Portal</h1>
          <p className="text-lg text-muted-foreground mt-2">Invoices &amp; payments</p>
          <Button variant="ghost" onClick={logout} className="absolute top-0 right-0 flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total invoiced" value={rand(summary.totalInvoicedCents)} sub={`${summary.invoiceCount} invoices`} />
            <StatCard label="Paid" value={rand(summary.totalPaidCents)} />
            <StatCard label="Outstanding" value={rand(summary.outstandingCents)} />
            <StatCard
              label="Overdue"
              value={rand(summary.overdueCents)}
              sub={`${summary.overdueCount} invoice${summary.overdueCount === 1 ? "" : "s"}`}
              danger
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by company name or invoice number…"
            />
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {invoices.length === 0 ? "No invoices yet." : "No invoices match your search."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3">Invoice</th>
                      <th className="py-2 pr-3">Company</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Issued</th>
                      <th className="py-2 pr-3">Due</th>
                      <th className="py-2 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((v) => (
                      <tr key={v.id} className={`border-b border-border/50 ${isOverdue(v) ? "bg-red-500/10" : ""}`}>
                        <td className="py-2 pr-3 font-mono">{v.invoiceNumber}</td>
                        <td className="py-2 pr-3">{v.billName || `${v.partnerType} #${v.partnerId}`}</td>
                        <td className="py-2 pr-3">{rand(v.totalCents)}</td>
                        <td className="py-2 pr-3">{v.issuedAt}</td>
                        <td className={`py-2 pr-3 ${isOverdue(v) ? "text-red-600 font-medium" : ""}`}>{v.dueAt || "—"}</td>
                        <td className="py-2 pr-3">
                          <select
                            className="h-8 rounded-md border border-border bg-background px-1 text-xs"
                            value={v.status}
                            onChange={(e) => setStatus(v.id, e.target.value)}
                          >
                            <option value="Issued">Issued</option>
                            <option value="Paid">Paid</option>
                            <option value="Overdue">Overdue</option>
                            <option value="Void">Void</option>
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

        {commissions && (
          <Card>
            <CardHeader>
              <CardTitle>
                Rep Commissions · Total {rand(commissions.totalCents)} · Paid {rand(commissions.totalPaidCents)} · Owed {rand(commissions.totalAccruedCents)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {commissions.byRep.length === 0 ? (
                <p className="text-sm text-muted-foreground">No commissions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="py-2 pr-3">Rep</th>
                        <th className="py-2 pr-3">Own</th>
                        <th className="py-2 pr-3">Override</th>
                        <th className="py-2 pr-3">Total</th>
                        <th className="py-2 pr-3">Paid</th>
                        <th className="py-2 pr-3">Owed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissions.byRep.map((r) => (
                        <tr key={r.repCode} className="border-b border-border/50">
                          <td className="py-2 pr-3 font-mono">{r.repCode}</td>
                          <td className="py-2 pr-3">{rand(r.ownCents)}</td>
                          <td className="py-2 pr-3">{rand(r.overrideCents)}</td>
                          <td className="py-2 pr-3 font-semibold">{rand(r.totalCents)}</td>
                          <td className="py-2 pr-3">{rand(r.paidCents)}</td>
                          <td className="py-2 pr-3">{rand(r.accruedCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {ledger && (
          <Card>
            <CardHeader>
              <CardTitle>
                Bookings Ledger ({ledger.count}) · Value {rand(ledger.totalValueCents)} · Commission {rand(ledger.totalCommissionCents)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ledger.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Partner</th>
                        <th className="py-2 pr-3">Customer</th>
                        <th className="py-2 pr-3">Value</th>
                        <th className="py-2 pr-3">Commission</th>
                        <th className="py-2 pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.rows.map((b) => (
                        <tr key={b.id} className={`border-b border-border/50 ${b.status === "cancelled" ? "opacity-60" : ""}`}>
                          <td className="py-2 pr-3">{b.bookingDate || b.createdAt}</td>
                          <td className="py-2 pr-3">{b.entityName || `${b.entityType} #${b.id}`}</td>
                          <td className="py-2 pr-3">{b.customerName}</td>
                          <td className="py-2 pr-3">{rand(b.totalCents)}</td>
                          <td className="py-2 pr-3">{rand(b.commissionCents)}</td>
                          <td className="py-2 pr-3">{b.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
