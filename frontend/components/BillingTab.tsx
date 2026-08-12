import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";

interface Subscription {
  id: number;
  partnerType: string;
  partnerId: number;
  plan: string;
  tier: number;
  audience: string;
  monthlyCents: number;
  repCode: string;
  status: string;
  nextBillDate: string;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  partnerType: string;
  partnerId: number;
  billName: string;
  repCode: string;
  periodStart: string;
  periodEnd: string;
  totalCents: number;
  status: string;
  issuedAt: string;
}

interface Commission {
  id: number;
  repCode: string;
  type: string;
  sourceRepCode: string;
  partnerType: string;
  partnerId: number;
  invoiceId: number;
  periodStart: string;
  amountCents: number;
  status: string;
}

const rand = (cents: number) => `R${(cents / 100).toFixed(2)}`;

const planLabel = (s: Subscription) =>
  s.plan === "booking" ? "Booking" : `Tier ${s.tier}`;

export default function BillingTab() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const [s, i, c] = await Promise.all([
          backend.billing.listSubscriptions(),
          backend.billing.listInvoices(),
          backend.billing.listCommissions(),
        ]);
        setSubs(s.subscriptions || []);
        setInvoices(i.invoices || []);
        setCommissions(c.commissions || []);
      } catch (error) {
        console.error("Failed to load billing:", error);
        toast({ title: "Error", description: "Failed to load billing data", variant: "destructive" });
      }
    })();
  }, [toast]);

  const mrrCents = subs
    .filter((s) => s.status === "Active")
    .reduce((sum, s) => sum + s.monthlyCents, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            Subscriptions ({subs.length}) · Monthly recurring {rand(mrrCents)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No subscriptions yet — onboard a partner (any category) and one is created automatically.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Partner</th>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">Audience</th>
                    <th className="py-2 pr-3">Monthly</th>
                    <th className="py-2 pr-3">Rep</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Next bill</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id} className="border-b border-border/50">
                      <td className="py-2 pr-3">{s.partnerType} #{s.partnerId}</td>
                      <td className="py-2 pr-3">{planLabel(s)}</td>
                      <td className="py-2 pr-3">{s.audience || "—"}</td>
                      <td className="py-2 pr-3">{rand(s.monthlyCents)}</td>
                      <td className="py-2 pr-3 font-mono">{s.repCode || "—"}</td>
                      <td className="py-2 pr-3">{s.status}</td>
                      <td className="py-2 pr-3">{s.nextBillDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices ({invoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Invoice</th>
                    <th className="py-2 pr-3">Partner</th>
                    <th className="py-2 pr-3">Period</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Rep</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((v) => (
                    <tr key={v.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-mono">{v.invoiceNumber}</td>
                      <td className="py-2 pr-3">{v.billName || `${v.partnerType} #${v.partnerId}`}</td>
                      <td className="py-2 pr-3">{v.periodStart}</td>
                      <td className="py-2 pr-3">{rand(v.totalCents)}</td>
                      <td className="py-2 pr-3 font-mono">{v.repCode || "—"}</td>
                      <td className="py-2 pr-3">{v.status}</td>
                      <td className="py-2 pr-3">{v.issuedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Commissions ({commissions.length}) · Accrued{" "}
            {rand(commissions.reduce((sum, c) => sum + c.amountCents, 0))}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No commissions yet — they accrue automatically when an invoice is issued.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Rep</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">From rep</th>
                    <th className="py-2 pr-3">Partner</th>
                    <th className="py-2 pr-3">Period</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-mono">{c.repCode}</td>
                      <td className="py-2 pr-3">{c.type === "override" ? "Override (10%)" : "Own (30%)"}</td>
                      <td className="py-2 pr-3 font-mono">{c.sourceRepCode || "—"}</td>
                      <td className="py-2 pr-3">{c.partnerType} #{c.partnerId}</td>
                      <td className="py-2 pr-3">{c.periodStart || "—"}</td>
                      <td className="py-2 pr-3">{rand(c.amountCents)}</td>
                      <td className="py-2 pr-3">{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
