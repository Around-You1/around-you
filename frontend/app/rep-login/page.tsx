"use client";

import dynamic from "next/dynamic";

const RepLoginPage = dynamic(() => import("@/components/RepLoginPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

export default function RepLoginRoute() {
  return <RepLoginPage />;
}
