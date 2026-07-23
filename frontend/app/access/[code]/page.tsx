"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import backend from "@/backend/client";
import { getSession } from "@/lib/session";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, AlertCircle } from "lucide-react";

// Authorization + routing layer (rebuilt clean).
//
// Runs AFTER Supabase OTP has established identity. It exchanges the access code
// for a Go authorization token + resolved user, stores both, and routes to the
// correct dashboard. If there is no Supabase session yet, it bounces to /login
// and carries the code so the flow resumes automatically after verification.
export default function AccessCodePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const [status, setStatus] = useState<"resolving" | "error">("resolving");
  const [errorMessage, setErrorMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const code = (rawCode || "").replace(/[^A-Za-z0-9]/g, "");
      if (!code) {
        setStatus("error");
        setErrorMessage("No access code provided.");
        return;
      }

      // Identity gate.
      const session = await getSession();
      if (!session) {
        router.replace(`/login?code=${encodeURIComponent(code)}`);
        return;
      }

      try {
        const response: any = await backend.auth.accessCodeLogin({ accessCode: code });

        localStorage.setItem("token", response.token);
        localStorage.setItem("user", JSON.stringify(response.user));

        toast({ title: "Welcome!", description: `Access granted for ${response.user?.email ?? "your profile"}` });

        const { profileType, role } = response.user ?? {};
        if (profileType === "accommodation" || role === "Guest") {
          router.replace("/dashboard/guest");
        } else if (
          profileType === "restaurant" ||
          profileType === "service" ||
          profileType === "attraction" ||
          role === "Partner"
        ) {
          router.replace("/dashboard/partner");
        } else if (role === "SuperAdmin" || role === "Admin") {
          router.replace("/dashboard/admin");
        } else {
          router.replace("/portal");
        }
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(err?.message || "Invalid or expired access code.");
        toast({
          title: "Access failed",
          description: err?.message || "Invalid or expired access code.",
          variant: "destructive",
        });
      }
    })();
  }, [rawCode, router, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/20 to-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold">Around You</CardTitle>
          <p className="text-muted-foreground">
            {status === "resolving" ? "Verifying your access code…" : "Access denied"}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          {status === "resolving" ? (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-[#AEECE4]" />
              <p className="text-xs font-mono text-muted-foreground/70">{rawCode}</p>
            </>
          ) : (
            <>
              <AlertCircle className="h-16 w-16 text-destructive" />
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
                <Button
                  onClick={() => router.replace("/portal")}
                  className="w-full bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black font-semibold"
                >
                  Enter a different code
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
