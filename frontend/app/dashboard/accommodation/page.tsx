"use client";

import dynamic from "next/dynamic";

const AccommodationTab = dynamic(() => import("@/components/AccommodationTab"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

export default function AccommodationPage() {
  return (
    <div className="p-4 md:p-6">
      <AccommodationTab onUpdate={() => {}} />
    </div>
  );
}
