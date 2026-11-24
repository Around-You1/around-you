"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";

// Admin-only control to set or clear a partner's custom monthly price. The price
// is the standing monthly fee stored on the subscription; it survives the
// partner editing their own profile, and invoice-time promos (e.g. the November
// launch 50%) still apply on top. Set this BEFORE Accepting a partner so their
// first invoice is correct.
export default function MonthlyPriceEditor({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: number;
}) {
  const { toast } = useToast();
  const [rands, setRands] = useState("");
  const [saving, setSaving] = useState(false);
  // Current stored price, loaded on mount so the admin sees what's set.
  const [current, setCurrent] = useState<{ rands: number; isOverride: boolean } | null>(null);
  const [promo, setPromo] = useState<"auto" | "on" | "off">("auto");
  const [promoSaving, setPromoSaving] = useState(false);

  const changePromo = async (mode: "auto" | "on" | "off") => {
    setPromo(mode);
    setPromoSaving(true);
    try {
      await getAuthenticatedBackend().admin.setPromoHalf({ entityType, entityId, mode });
      toast({
        title: mode === "on" ? "November 50% promo: ON" : mode === "off" ? "November 50% promo: OFF" : "Promo: automatic",
        description:
          mode === "on"
            ? "This partner gets 50% off their monthly fee for Nov\u2013Jan."
            : mode === "off"
            ? "This partner is billed the full monthly fee \u2014 no promo."
            : "Uses the sign-up-date rule: only partners who joined before 22 Nov get the 50%.",
      });
    } catch (e: any) {
      toast({ title: "Couldn't update promo", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setPromoSaving(false);
    }
  };

  const load = async () => {
    try {
      const res: any = await getAuthenticatedBackend().admin.getMonthlyPrice({ entityType, entityId });
      const r = Math.round((res?.monthlyCents ?? 0) / 100);
      const isOverride = !!res?.isOverride;
      setCurrent({ rands: r, isOverride });
      // Pre-fill the input with the custom price when one is set.
      if (isOverride && r > 0) setRands(String(r));
      setPromo(res?.promoHalf === "on" || res?.promoHalf === "off" ? res.promoHalf : "auto");
    } catch {
      /* best-effort — leave the field blank */
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  const save = async (clear = false) => {
    const value = clear ? 0 : parseInt(rands, 10);
    if (!clear && (!Number.isFinite(value) || value <= 0)) {
      toast({ title: "Enter a monthly price in Rand", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res: any = await getAuthenticatedBackend().admin.setMonthlyPrice({
        entityType,
        entityId,
        rands: clear ? 0 : value,
      });
      const r = Math.round((res?.monthlyCents ?? 0) / 100);
      toast({
        title: clear ? "Reverted to standard pricing" : `Monthly price set to R${r}`,
        description: clear
          ? "This partner now bills at the standard computed price."
          : "This is the standing monthly fee. The November 50% promo is controlled separately, below.",
      });
      if (clear) setRands("");
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't update price", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Custom Monthly Price</p>
      {current && (
        <p className="text-xs text-muted-foreground mb-2">
          {current.isOverride
            ? `Currently set to a custom R${current.rands}/month.`
            : `Currently on standard pricing (R${current.rands}/month).`}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">R</span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={rands}
          onChange={(e) => setRands(e.target.value)}
          placeholder="e.g. 200"
          className="h-8 w-28"
        />
        <Button
          size="sm"
          className="h-8 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold"
          disabled={saving}
          onClick={() => save(false)}
        >
          {saving ? "Saving…" : "Set price"}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={saving} onClick={() => save(true)}>
          Reset to standard
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Overrides this partner&apos;s standard monthly price only. Set this before Accepting so the first invoice is
        correct. The November 50% promo is controlled separately, below.
      </p>

      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">November 50% promo</p>
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          value={promo}
          disabled={promoSaving}
          onChange={(e) => changePromo(e.target.value as "auto" | "on" | "off")}
        >
          <option value="auto">Automatic (by sign-up date)</option>
          <option value="on">Apply 50% (force on)</option>
          <option value="off">No promo (force off)</option>
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          <strong>Automatic</strong> gives 50% only to partners who joined before 22 Nov. Use <strong>Apply 50%</strong> to
          give a specific partner the promo, or <strong>No promo</strong> to always bill the full fee.
        </p>
      </div>
    </div>
  );
}
