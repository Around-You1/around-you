"use client";

import dynamic from "next/dynamic";

const PartnerDashboard = dynamic(() => import("@/components/PartnerDashboard"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

export default function PartnerDashboardPage() {
  return <PartnerDashboard />;
}
