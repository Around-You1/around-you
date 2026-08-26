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

interface AccCodeStatus {
  isSet: boolean;
  source: string; // "in-app" | "fly-secret" | "none"
  updatedAt: string;
  updatedBy: string;
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
  const [commRollup, setCommRollup] = useState<CommissionRollup | null>(null);
  const [bookingLedger, setBookingLedger] = useState<BookingLedger | null>(null);
  const [emailLog, setEmailLog] = useState<any[]>([]);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [accStatus, setAccStatus] = useState<AccCodeStatus | null>(null);
  const [newAccCode, setNewAccCode] = useState("");
  const [savingAcc, setSavingAcc] = useState(false);
  const { toast } = useToast();

  const loadAccStatus = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const st = await backend.auth.accCodeStatus();
      setAccStatus(st as AccCodeStatus);
    } catch {
      // ignore — admin-only extra
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const [cr, bl] = await Promise.all([backend.accounts.commissions(), backend.accounts.bookings()]);
        setCommRollup(((cr as any).rollup || null) as CommissionRollup | null);
        setBookingLedger(((bl as any).ledger || null) as BookingLedger | null);
      } catch {
        // ignore — these are admin-only extras
      }
    })();
    loadAccStatus();
  }, []);

  const generateAccCode = () => {
    // 32 hex chars from the browser's CSPRNG — no ambiguous characters, easy to copy.
    const bytes = new Uint8Array(16);
    (window.crypto || (window as any).msCrypto).getRandomValues(bytes);
    const code = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    setNewAccCode(code);
  };

  const saveAccCode = async () => {
    const code = newAccCode.trim();
    if (code.length < 12) {
      toast({ title: "Code too short", description: "Use at least 12 characters.", variant: "destructive" });
      return;
    }
    setSavingAcc(true);
    try {
      const backend = getAuthenticatedBackend();
      await backend.auth.setAccCode({ code });
      toast({
        title: "Accountant code saved",
        description: "Copy it now — it's stored hashed and can't be shown again.",
      });
      setNewAccCode("");
      await loadAccStatus();
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to save code", variant: "destructive" });
    } finally {
      setSavingAcc(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const [s, i, c, st, el] = await Promise.all([
          backend.billing.listSubscriptions(),
          backend.billing.listInvoices(),
          backend.billing.listCommissions(),
          backend.billing.statement({ period }),
          backend.billing.emailLog().catch(() => ({ entries: [] })),
        ]);
        setSubs(s.subscriptions || []);
        setInvoices(i.invoices || []);
        setCommissions(c.commissions || []);
        setStatements(st.statements || []);
        setEmailLog((el as any).entries || []);
      } catch (error) {
        console.error("Failed to load billing:", error);
        toast({ title: "Error", description: "Failed to load billing data", variant: "destructive" });
      }
    })();
  }, [toast]);

  const handleResend = async (invoiceId: number) => {
    setResendingId(invoiceId);
    try {
      const backend = getAuthenticatedBackend();
      await backend.billing.resendInvoice({ invoiceId });
      toast({ title: "Invoice re-sent", description: "See the Email Delivery panel above for the result." });
      const el: any = await backend.billing.emailLog().catch(() => ({ entries: [] }));
      setEmailLog(el.entries || []);
    } catch (e: any) {
      toast({ title: "Resend failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

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
      <Card>
        <CardHeader>
          <CardTitle>Accountant Access Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This is the code your accountant types to sign in to the Accountant Portal. Set or
            rotate it here — it&apos;s stored hashed (never shown again), so copy it before you leave
            this page and hand it to your accountant privately.
          </p>
          <div className="text-sm">
            {!accStatus ? (
              <span className="text-muted-foreground">Checking status…</span>
            ) : accStatus.source === "in-app" ? (
              <span className="text-green-600">
                A code is set (in-app){accStatus.updatedAt ? ` — last changed ${accStatus.updatedAt}` : ""}
                {accStatus.updatedBy ? ` by ${accStatus.updatedBy}` : ""}.
              </span>
            ) : accStatus.source === "fly-secret" ? (
              <span className="text-amber-600">
                Using the Fly secret (ACC_ACCESS_CODE). Set a code here to manage it in-app instead.
              </span>
            ) : (
              <span className="text-red-600">No accountant code is configured yet.</span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newAccCode}
              onChange={(e) => setNewAccCode(e.target.value)}
              placeholder="Enter or generate a code (min 12 characters)"
              className="font-mono"
            />
            <Button type="button" variant="outline" onClick={generateAccCode}>
              Generate
            </Button>
            <Button type="button" onClick={saveAccCode} disabled={savingAcc}>
              {savingAcc ? "Saving…" : "Save code"}
            </Button>
          </div>
          {newAccCode && (
            <p className="text-xs text-muted-foreground">
              Copy this code now — after you save it, it can&apos;t be displayed again (only replaced).
            </p>
          )}
        </CardContent>
      </Card>
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
          <CardTitle>Email Delivery ({emailLog.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {emailLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No email attempts logged yet. Invoices, codes and statements will appear here once they're sent.</p>
          ) : (
            <div className="space-y-1.5">
              {emailLog.filter((e) => e.status !== "sent").length > 0 && (
                <p className="text-sm text-red-600">
                  {emailLog.filter((e) => e.status !== "sent").length} of the last {emailLog.length} emails did not send. Check the recipient's Official Use → Email and your Resend sender domain.
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3">When</th>
                      <th className="py-2 pr-3">To</th>
                      <th className="py-2 pr-3">Subject</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailLog.map((e, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{e.createdAt ? new Date(e.createdAt).toLocaleString() : "—"}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{e.toAddr || "—"}</td>
                        <td className="py-2 pr-3 max-w-[220px] truncate">{e.subject}</td>
                        <td className="py-2 pr-3">
                          <span className={e.status === "sent" ? "text-green-600" : e.status === "skipped" ? "text-amber-600" : "text-red-600"}>
                            {e.status}
                          </span>
                        </td>
                        <td className="py-2 pr-3 max-w-[280px] truncate text-muted-foreground" title={e.detail}>{e.detail || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                    <th className="py-2 pr-3"></th>
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
                      <td className="py-2 pr-3">
                        <Button variant="outline" size="sm" disabled={resendingId === v.id}
                          onClick={() => handleResend(v.id)}>
                          {resendingId === v.id ? "Sending…" : "Resend"}
                        </Button>
                      </td>
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

      <Card>
        <CardHeader>
          <CardTitle>Rep Commissions (roll-up)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!commRollup ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Total commission</p>
                  <p className="text-lg font-semibold">{rand(commRollup.totalCents)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Paid out</p>
                  <p className="text-lg font-semibold">{rand(commRollup.totalPaidCents)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Accrued (owed)</p>
                  <p className="text-lg font-semibold">{rand(commRollup.totalAccruedCents)}</p>
                </div>
              </div>
              {commRollup.byRep.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rep commissions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="py-2 pr-3">Rep</th>
                        <th className="py-2 pr-3">Own (30%)</th>
                        <th className="py-2 pr-3">Override (10%)</th>
                        <th className="py-2 pr-3">Total</th>
                        <th className="py-2 pr-3">Paid</th>
                        <th className="py-2 pr-3">Accrued</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commRollup.byRep.map((r) => (
                        <tr key={r.repCode} className="border-b border-border/50">
                          <td className="py-2 pr-3 font-mono">{r.repCode}</td>
                          <td className="py-2 pr-3">{rand(r.ownCents)}</td>
                          <td className="py-2 pr-3">{rand(r.overrideCents)}</td>
                          <td className="py-2 pr-3 font-medium">{rand(r.totalCents)}</td>
                          <td className="py-2 pr-3">{rand(r.paidCents)}</td>
                          <td className="py-2 pr-3">{rand(r.accruedCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bookings Ledger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!bookingLedger ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Bookings</p>
                  <p className="text-lg font-semibold">{bookingLedger.count}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Total value</p>
                  <p className="text-lg font-semibold">{rand(bookingLedger.totalValueCents)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Total commission</p>
                  <p className="text-lg font-semibold">{rand(bookingLedger.totalCommissionCents)}</p>
                </div>
              </div>
              {bookingLedger.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="py-2 pr-3">Partner</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Customer</th>
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Value</th>
                        <th className="py-2 pr-3">Commission</th>
                        <th className="py-2 pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookingLedger.rows.map((b) => (
                        <tr key={b.id} className="border-b border-border/50">
                          <td className="py-2 pr-3">{b.entityName}</td>
                          <td className="py-2 pr-3">{b.entityType}</td>
                          <td className="py-2 pr-3">{b.customerName}</td>
                          <td className="py-2 pr-3">{b.bookingDate}</td>
                          <td className="py-2 pr-3">{rand(b.totalCents)}</td>
                          <td className="py-2 pr-3">{rand(b.commissionCents)}</td>
                          <td className="py-2 pr-3">{b.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
