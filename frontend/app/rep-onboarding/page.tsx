"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const RepOnboardingApp = dynamic(() => import("@/components/RepOnboardingApp"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

// Reached after Rep sign-in (RepLoginPage.tsx) — full name + rep code, no
// Supabase session at all, same reasoning as admin-dashboard/page.tsx.
// Deliberately outside app/dashboard/ for the same reason.
export default function RepOnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;

    let role: string | undefined;
    try {
      role = userRaw ? JSON.parse(userRaw).role : undefined;
    } catch {
      role = undefined;
    }

    if (!token || role !== "Rep") {
      router.replace("/rep-login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <RepOnboardingApp />;
}
