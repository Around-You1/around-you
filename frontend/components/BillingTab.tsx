import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ImageUpload from "../components/ImageUpload";
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

interface RepStatement {
  repCode: string;
  ownCents: number;
  overrideCents: number;
  totalCents: number;
  paidCents: number;
  accruedCents: number;
}

const rand = (cents: number) => `R${(cents / 100).toFixed(2)}`;

const planLabel = (s: Subscription) =>
  s.plan === "booking" ? "Booking" : `Tier ${s.tier}`;

function InvoiceSettingsCard() {
  const [s, setS] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const r = await backend.billing.getInvoiceSettings();
        setS(((r as any).settings || {}) as Record<string, string>);
      } catch {
        // ignore — form starts blank
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const set = (k: string, v: string) => setS((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const backend = getAuthenticatedBackend();
      await backend.billing.setInvoiceSettings(s);
      toast({ title: "Invoice settings saved", description: "They'll appear on every invoice." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const preview = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const r = await backend.billing.invoicePreview();
      const html = ((r as any).html || "") as string;
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      } else {
        toast({ title: "Popup blocked", description: "Allow popups for this site to preview the invoice.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Couldn't preview", description: error?.message || "Please try again.", variant: "destructive" });
    }
  };

  const field = (key: string, label: string, placeholder?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={s[key] || ""} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">These details appear on every invoice sent to your partners.</p>
        {!loaded ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <ImageUpload
              label="Logo"
              imageUrl={s.logoUrl || ""}
              onImageUploaded={(url) => set("logoUrl", url)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field("businessName", "Business name")}
              {field("address", "Address")}
              {field("contactEmail", "Contact email")}
              {field("contactPhone", "Contact phone")}
              {field("regNumber", "Company reg number")}
              {field("vatNumber", "VAT number (when registered)")}
            </div>
            <p className="text-xs font-medium text-muted-foreground pt-2">Banking — how partners pay you</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field("bankName", "Bank")}
              {field("accountName", "Account name")}
              {field("accountNumber", "Account number")}
              {field("branchCode", "Branch code")}
              {field("paymentReference", "Payment reference (blank = invoice number)")}
              {field("paymentTerms", "Payment terms")}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={save} disabled={saving} className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black">
                {saving ? "Saving…" : "Save invoice settings"}
              </Button>
              <Button onClick={preview} variant="outline">Preview invoice</Button>
              <span className="text-xs text-muted-foreground">Preview opens in a new tab, using your last saved settings.</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function BillingTab() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [statements, setStatements] = useState<RepStatement[]>([]);
  const [paying, setPaying] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const [s, i, c, st] = await Promise.all([
          backend.billing.listSubscriptions(),
          backend.billing.listInvoices(),
          backend.billing.listCommissions(),
          backend.billing.statement({ period }),
        ]);
        setSubs(s.subscriptions || []);
        setInvoices(i.invoices || []);
        setCommissions(c.commissions || []);
        setStatements(st.statements || []);
      } catch (error) {
        console.error("Failed to load billing:", error);
        toast({ title: "Error", description: "Failed to load billing data", variant: "destructive" });
      }
    })();
  }, [toast]);

  const loadStatements = async (p: string) => {
    try {
      const backend = getAuthenticatedBackend();
      const r = await backend.billing.statement({ period: p });
      setStatements(r.statements || []);
    } catch (error) {
      console.error("Failed to load statements:", error);
    }
  };

  const handleMarkPaid = async () => {
    setPaying(true);
    try {
      const backend = getAuthenticatedBackend();
      const r = await backend.billing.markPeriodPaid({ period });
      toast({ title: "Payout recorded", description: `${r.updated} entries marked Paid for ${period}` });
      loadStatements(period);
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to mark paid", variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  const handleSetStatus = async (id: number, status: string) => {
    try {
      const backend = getAuthenticatedBackend();
      await backend.billing.setSubscriptionStatus({ id, status });
      const s = await backend.billing.listSubscriptions();
      setSubs(s.subscriptions || []);
      toast({ title: "Subscription updated", description: `Set to ${status}` });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to update subscription", variant: "destructive" });
    }
  };

  const handleEmailStatements = async () => {
    setEmailing(true);
    try {
      const backend = getAuthenticatedBackend();
      const r = await backend.billing.emailStatements({ period });
      toast({ title: "Statements emailed", description: `${r.sent} rep(s) emailed for ${period}` });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to email statements", variant: "destructive" });
    } finally {
      setEmailing(false);
    }
  };

  const mrrCents = subs
    .filter((s) => s.status === "Active")
    .reduce((sum, s) => sum + s.monthlyCents, 0);

  return (
    <div className="space-y-6">
      <InvoiceSettingsCard />
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
                      <td className="py-2 pr-3">
                        <select
                          className="h-8 rounded-md border border-border bg-background px-1 text-xs"
                          value={s.status}
                          onChange={(e) => handleSetStatus(s.id, e.target.value)}
                        >
                          <option value="Active">Active</option>
                          <option value="Paused">Paused</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
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

      <Card>
        <CardHeader>
          <CardTitle>Monthly Statements &amp; Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Month</label>
              <input
                type="month"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  loadStatements(e.target.value);
                }}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={handleMarkPaid}
              disabled={paying}
              className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black"
            >
              {paying ? "Recording…" : "Mark month's Accrued as Paid"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleEmailStatements} disabled={emailing}>
              {emailing ? "Emailing…" : "Email statements to reps"}
            </Button>
          </div>
          {statements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commissions for {period}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Rep</th>
                    <th className="py-2 pr-3">Own 30%</th>
                    <th className="py-2 pr-3">Override 10%</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Accrued</th>
                    <th className="py-2 pr-3">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {statements.map((s) => (
                    <tr key={s.repCode} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-mono">{s.repCode}</td>
                      <td className="py-2 pr-3">{rand(s.ownCents)}</td>
                      <td className="py-2 pr-3">{rand(s.overrideCents)}</td>
                      <td className="py-2 pr-3 font-semibold">{rand(s.totalCents)}</td>
                      <td className="py-2 pr-3">{rand(s.accruedCents)}</td>
                      <td className="py-2 pr-3">{rand(s.paidCents)}</td>
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
