"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";

// Landing / "About You" entry screen. Rendered client-only because the imported
// component relies on browser APIs (navigation, localStorage) that must not run
// during SSR.
const AboutYouPage = dynamic(() => import("@/components/AboutYouPage"), {
  ssr: false,
  loading: () => <FullscreenLoader />,
});

function FullscreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    // Magic Link (free tier) always returns to "/". The session arrives in the
    // URL; detectSessionInUrl (set in lib/supabase.ts) parses it, then
    // getSession() returns it.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        router.replace("/portal"); // session found -> go to access-code entry
      } else {
        setChecking(false); // no session -> show the landing page
      }
    });

    // The Magic Link session can land a moment after mount while the URL hash is
    // still being parsed; catch that case too.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) router.replace("/portal");
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (checking) return <FullscreenLoader />;

  return <AboutYouPage />;
}
