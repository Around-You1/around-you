"use client";

import dynamic from "next/dynamic";

const AccLoginPage = dynamic(() => import("@/components/AccLoginPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

export default function AccLoginRoute() {
  return <AccLoginPage />;
}
