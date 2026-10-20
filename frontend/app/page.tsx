"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { getAuthenticatedBackend } from "@/lib/backend";
import LoadingScreen from "@/components/LoadingScreen";
import TutorialIntro from "@/components/tutorial/TutorialIntro";
import { useTutorial } from "@/components/tutorial/TutorialProvider";

// Landing / "About You" entry screen. Rendered client-only because the imported
// component relies on browser APIs (navigation, localStorage) that must not run
// during SSR. LoadingScreen (JHB/Table Mountain splash) covers the load, so no
// separate fallback UI is needed here.
const LoginPage = dynamic(() => import("@/components/LoginPage"), {
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
  // The guided-tutorial intro screen (logo + sound check) shows first; the rest
  // of the landing flow waits until the user taps Start or Skip.
  const [introDone, setIntroDone] = useState(false);
  const tutorial = useTutorial();

  useEffect(() => {
    let active = true;
    import("@/components/LoginPage").then(() => {
      if (active) setChunkLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Skip the tutorial intro for scanned-QR / access-code / magic-link entries —
  // those users came in to do something specific, not to watch the walkthrough.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const hash = window.location.hash || "";
    const authReturn = hash.includes("access_token") || hash.includes("type=");
    if (p.get("code") || p.get("accessCode") || authReturn) setIntroDone(true);
  }, []);

  // The minimum loading-screen display time only starts once the intro is done,
  // so the car/skyline (and VO1) are actually seen after the user taps Start.
  useEffect(() => {
    if (!introDone) return;
    const timer = setTimeout(() => setMinTimeElapsed(true), 3200);
    return () => clearTimeout(timer);
  }, [introDone]);

  // First voice-over ("Welcome to Around You") plays over the loading screen.
  useEffect(() => {
    if (introDone && showLoader) tutorial?.play("VO1");
  }, [introDone, showLoader, tutorial]);

  // A QR/link that carries ?accessCode=XXXXXXXXXXXX (12 chars) deep-links
  // straight to the auto-login route (kept from the old landing page).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ac = new URLSearchParams(window.location.search).get("accessCode");
    if (ac && ac.length === 12) router.replace(`/${ac}`);
  }, [router]);

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

  if (!introDone) {
    return <TutorialIntro onDone={() => setIntroDone(true)} />;
  }

  if (showLoader) {
    return <LoadingScreen ready={ready} onFinished={() => setShowLoader(false)} />;
  }

  return <LoginPage />;
}