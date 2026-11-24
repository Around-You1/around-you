"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import backend from "@/backend/client";
import BrandLoading from "@/components/BrandLoading";

const GuestDashboard = dynamic(() => import("@/components/GuestDashboard"), {
  ssr: false,
  loading: () => <BrandLoading />,
});

// Local Guests' dashboard URL (/local-dashboard). It renders the same
// GuestDashboard in local mode (role === "LocalGuest"); Holiday Guests use
// /guest-dashboard. Both accept a Local or Guest session here. Deliberately NOT under app/dashboard/, since that folder's
// layout.tsx requires a Supabase session and was bouncing every access-code
// guest straight back to the sign-in screen the moment they landed here.
// A tapped push lands on /local-dashboard?notifications=1. Mirrors LoginPage's
// per-device Local identity so we can silently sign the device in.
function getLocalDeviceEmail(): string {
  try {
    let id = localStorage.getItem("aroundYouLocalDeviceId");
    if (!id) {
      id = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("aroundYouLocalDeviceId", id);
    }
    return `device-${id}@local.aroundyou.co.za`;
  } catch {
    return `device-${Date.now()}@local.aroundyou.co.za`;
  }
}

export default function LocalDashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      // A tapped push arrives with ?notifications=1. Silently sign this device
      // in as a Local using its stored identity — this records the sign-in
      // "click" in analytics and lands the user on the Local page with the
      // message — then show the dashboard. No "stay signed in" needed.
      const notifTap =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("notifications") === "1";
      if (notifTap) {
        try {
          const email = getLocalDeviceEmail();
          let postalCode = "";
          try { postalCode = JSON.parse(localStorage.getItem("localGuestInfo") || "{}").postalCode || ""; } catch { /* ignore */ }
          const res = await backend.auth.localGuestLogin({ email, postalCode });
          localStorage.setItem("token", res.token);
          localStorage.setItem("user", JSON.stringify(res.user));
          try { localStorage.setItem("localGuestInfo", JSON.stringify({ ...JSON.parse(localStorage.getItem("localGuestInfo") || "{}"), email, postalCode })); } catch { /* ignore */ }
          if (active) setReady(true);
          return;
        } catch {
          /* fall through to the normal auth checks below */
        }
      }

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
    return <BrandLoading />;
  }

  return <GuestDashboard />;
}
