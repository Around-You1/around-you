"use client";

import { useState } from "react";
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
          : "This is the standing monthly fee. The November launch promo (50%) still applies on top for Nov–Jan, November pro-rata.",
      });
      if (clear) setRands("");
    } catch (e: any) {
      toast({ title: "Couldn't update price", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Custom Monthly Price</p>
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
        correct. The promo still applies on top.
      </p>
    </div>
  );
}
