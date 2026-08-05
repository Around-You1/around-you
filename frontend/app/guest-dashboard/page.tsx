"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const GuestDashboard = dynamic(() => import("@/components/GuestDashboard"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

// Reached after Holiday Guest access-code login (LoginPage.tsx's
// handleHolidayLogin), which is Go-backend-token-only — no Supabase session
// at all. Deliberately NOT under app/dashboard/, since that folder's
// layout.tsx requires a Supabase session and was bouncing every access-code
// guest straight back to /login the moment they landed here. Same fix
// already applied for SuperAdmin (admin-dashboard/page.tsx) and Rep
// (rep-onboarding/page.tsx).
export default function GuestDashboardPage() {
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

    // Both Holiday Guests ("Guest") and Local Guests ("LocalGuest") use this
    // dashboard — GuestDashboard switches to a local view (no accommodation)
    // when role === "LocalGuest". Previously only "Guest" was allowed, which
    // bounced every local straight back to /login (the phantom second sign-in).
    if (!token || (role !== "Guest" && role !== "LocalGuest")) {
      router.replace("/login");
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

  return <GuestDashboard />;
}
