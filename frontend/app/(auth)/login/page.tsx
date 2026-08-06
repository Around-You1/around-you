"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithOtp } from "@/lib/auth";
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
import { Loader2, Mail } from "lucide-react";
import AppLogo from "@/components/AppLogo";

// Login is split by audience:
//   - Guests / Partners arrive with ?code=XYZ. They NEVER see the Supabase email
//     screen — we bounce straight to /portal?code=XYZ (access-code auth only).
//   - Locals arrive with no code. They see the Supabase email login UI.
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const code = searchParams.get("code") ?? searchParams.get("accessCode") ?? "";
  const role = searchParams.get("role") ?? "";
  const next = searchParams.get("next") ?? "";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Guest/Partner flow: an access code in the URL skips Supabase entirely.
  useEffect(() => {
    if (code) {
      const params = new URLSearchParams({ code });
      if (role) params.set("role", role);
      router.replace(`/portal?${params.toString()}`);
    }
  }, [code, role, router]);

  // While redirecting (or if a code is present), never render the email UI.
  if (code) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Local flow: email one-time passcode via Supabase.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await signInWithOtp(email);
      toast({ title: "Check your email", description: `We sent a code to ${email}` });
      const params = new URLSearchParams({ email: email.trim().toLowerCase() });
      if (next) params.set("next", next);
      router.push(`/verify?${params.toString()}`);
    } catch (err: any) {
      toast({
        title: "Could not send code",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/20 to-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <AppLogo src="/logo-dark.png" />
          </div>
          <CardTitle className="text-3xl font-bold">Around You</CardTitle>
          <p className="text-muted-foreground">Locals — sign in with your email</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black font-semibold"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" /> Send code
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
