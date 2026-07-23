"use client";

import dynamic from "next/dynamic";

// Authorization entry: the original access-code / secondary / local-guest login
// UI (LoginPage.tsx), untouched. Reached after Supabase OTP so the two layers
// compose: OTP proves identity, this resolves which data the user may access.
// Client-only to avoid SSR touching localStorage/window.
const LoginPage = dynamic(() => import("@/components/LoginPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

export default function PortalPage() {
  return <LoginPage />;
}
