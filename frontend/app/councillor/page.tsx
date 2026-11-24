"use client";

import dynamic from "next/dynamic";

const CouncillorPortal = dynamic(() => import("@/components/CouncillorPortal"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

export default function CouncillorRoute() {
  return <CouncillorPortal />;
}
