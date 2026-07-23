"use client";
export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyOtp, signInWithOtp } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

// Identity layer, step 2: verify the emailed code. On success a Supabase session
// exists, and we hand off to the authorization layer:
//   - if a pending access code was carried through -> /access/<code> resolver
//   - otherwise -> /portal (manual access-code / secondary / local-guest entry)
export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}

function VerifyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const email = searchParams.get("email") ?? "";
  const pendingCode = searchParams.get("code") ?? "";
  const next = searchParams.get("next") ?? "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Missing email", description: "Start again from the login page.", variant: "destructive" });
      router.replace("/login");
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(email, code);
      toast({ title: "Verified", description: "You're signed in." });
      if (pendingCode) router.replace(`/access/${encodeURIComponent(pendingCode)}`);
      else if (next) router.replace(next);
      else router.replace("/portal");
    } catch (err: any) {
      toast({
        title: "Verification failed",
        description: err?.message || "Invalid or expired code.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await signInWithOtp(email);
      toast({ title: "Code resent", description: `New code sent to ${email}` });
    } catch (err: any) {
      toast({ title: "Could not resend", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/20 to-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold">Enter your code</CardTitle>
          <p className="text-muted-foreground">
            We sent a 6-digit code to {email || "your email"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black font-semibold"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & continue"}
            </Button>
            <button
              type="button"
              onClick={resend}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Didn't get it? Resend code
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
