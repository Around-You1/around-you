"use client";

import dynamic from "next/dynamic";

const ServiceTab = dynamic(() => import("@/components/ServiceTab"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

export default function ServicePage() {
  return (
    <div className="p-4 md:p-6">
      <ServiceTab onUpdate={() => {}} />
    </div>
  );
}
