"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { getAuthenticatedBackend } from "@/lib/backend";
import LoadingScreen from "@/components/LoadingScreen";

// Landing / "About You" entry screen. Rendered client-only because the imported
// component relies on browser APIs (navigation, localStorage) that must not run
// during SSR. LoadingScreen (JHB/Table Mountain splash) covers the load, so no
// separate fallback UI is needed here.
const AboutYouPage = dynamic(() => import("@/components/AboutYouPage"), {
  ssr: false,
  loading: () => null,
});

export default function Page() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  // Warmed independently of next/dynamic so we know the real moment the
  // landing page's code has actually finished downloading.
  const [chunkLoaded, setChunkLoaded] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  // On a fast connection, the session check + chunk load can both finish in
  // well under a second — too fast to actually see the skylines/car. This
  // guarantees the loading screen stays up long enough to be seen, no matter
  // how quickly everything else finishes.
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    let active = true;
    import("@/components/AboutYouPage").then(() => {
      if (active) setChunkLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 3200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;

    // Only a FRESH auth return (e.g. a Local Guest completing a magic link,
    // which arrives with tokens in the URL hash) should skip the landing and go
    // straight to /portal. A plain visit to aroundyou.co.za — even with a
    // lingering session — must show the Landing page.
    const authReturn =
      typeof window !== "undefined" &&
      (window.location.hash.includes("access_token") || window.location.hash.includes("type="));

    // QR-scan tracking: a scanned QR opens the app with ?code=… in the URL.
    // Record it (best-effort, anonymous) so scans can be reported per partner.
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        const role = params.get("role");
        getAuthenticatedBackend()
          .events.record({
            eventType: "qr_scan",
            actorType: "anon",
            code,
            entityType: role === "partner" ? "" : "accommodation",
          })
          .catch(() => {});
      }
    } catch {
      // analytics must never break the landing page
    }

    // Magic Link (free tier) always returns to "/". The session arrives in the
    // URL; detectSessionInUrl (set in lib/supabase.ts) parses it, then
    // getSession() returns it.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session && authReturn) {
        router.replace("/portal"); // fresh magic-link login -> access-code entry
      } else {
        setChecking(false); // otherwise always show the Landing page
      }
    });

    // The Magic Link session can land a moment after mount while the URL hash is
    // still being parsed; catch that case too — but only for a fresh auth return.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session && authReturn) router.replace("/portal");
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  // Genuinely ready only once the session check has resolved (and we're not
  // about to redirect away to /portal), the landing page's code has actually
  // finished loading, AND the minimum display time has passed — never before.
  const ready = !checking && chunkLoaded && minTimeElapsed;

  if (showLoader) {
    return <LoadingScreen ready={ready} onFinished={() => setShowLoader(false)} />;
  }

  return <AboutYouPage />;
}