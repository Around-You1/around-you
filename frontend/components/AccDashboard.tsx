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

const rand = (c: number) => `R${(c / 100).toFixed(2)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AccDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const backend = getAuthenticatedBackend();
      const inv = await backend.accounts.invoices();
      setInvoices(((inv as any).invoices || []) as Invoice[]);
    } catch (error: any) {
      toast({ title: "Couldn't load invoices", description: error?.message || "Please try again.", variant: "destructive" });
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
      <div className="max-w-5xl mx-auto space-y-8 py-8">
        <div className="relative text-center">
          <div className="flex justify-center mb-2"><AppLogo src="/logo-dark.png" /></div>
          <h1 className="text-4xl font-bold text-foreground">Accountant Portal</h1>
          <p className="text-lg text-muted-foreground mt-2">Invoices &amp; payments</p>
          <Button variant="ghost" onClick={logout} className="absolute top-0 right-0 flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Mark each invoice Paid once payment is received. Overdue invoices (past their due date and not paid) are highlighted.
            </p>
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
      </div>
    </div>
  );
}
