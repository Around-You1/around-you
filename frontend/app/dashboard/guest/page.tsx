"use client";

import dynamic from "next/dynamic";

const GuestDashboard = dynamic(() => import("@/components/GuestDashboard"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

export default function GuestDashboardPage() {
  return <GuestDashboard />;
}
