"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import backend from "@/backend/client";

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
// guest straight back to the sign-in screen the moment they landed here.
export default function GuestDashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;

      let role: string | undefined;
      try {
        role = userRaw ? JSON.parse(userRaw).role : undefined;
      } catch {
        role = undefined;
      }

      // Both Holiday Guests ("Guest") and Local Guests ("LocalGuest") use this
      // dashboard — GuestDashboard switches to a local view when
      // role === "LocalGuest".
      if (token && (role === "Guest" || role === "LocalGuest")) {
        if (active) setReady(true);
        return;
      }

      // No usable backend token. A Local Guest signs in with a Supabase email
      // session, which survives a page refresh — so silently re-issue their
      // backend token from that session (using the province + postal code saved
      // at sign-in). This keeps a local signed in across a refresh instead of
      // bouncing them out to a sign-in screen.
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const email = session?.user?.email;
        let info: { province?: string; postalCode?: string } | null = null;
        try {
          info = JSON.parse(localStorage.getItem("localGuestInfo") || "null");
        } catch {
          info = null;
        }
        if (email && info?.province && info?.postalCode) {
          const res = await backend.auth.localGuestLogin({
            email,
            province: info.province,
            postalCode: info.postalCode,
          });
          localStorage.setItem("token", res.token);
          localStorage.setItem("user", JSON.stringify(res.user));
          if (active) setReady(true);
          return;
        }
      } catch {
        /* fall through to the sign-in screen */
      }

      router.replace("/portal");
    })();

    return () => {
      active = false;
    };
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
