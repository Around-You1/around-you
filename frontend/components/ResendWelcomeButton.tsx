"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2 } from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";

// Admin-only button that re-sends a partner's welcome email (Access Code,
// Partner Edit Code and the branded QR decal). Renders nothing for non-admins.
export default function ResendWelcomeButton({
  partnerType,
  partnerId,
  partnerName,
}: {
  partnerType: string;
  partnerId: number;
  partnerName: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  let role = "";
  try {
    role = JSON.parse(localStorage.getItem("user") || "{}").role || "";
  } catch {
    role = "";
  }
  if (role !== "SuperAdmin") return null;

  const resend = async () => {
    setBusy(true);
    try {
      const backend = getAuthenticatedBackend();
      const res: any = await backend.billing.resendWelcome({ partnerType, partnerId });
      if (res?.sent) {
        toast({ title: "Welcome email sent", description: `Sign-in codes + QR decal re-sent for ${partnerName}.` });
      } else {
        toast({ title: "Not sent", description: res?.error || "No email address on file for this partner.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to resend welcome email", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={resend} disabled={busy} className="mt-3">
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
      Resend welcome email + QR decal
    </Button>
  );
}
