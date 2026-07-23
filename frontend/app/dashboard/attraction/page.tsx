"use client";

import dynamic from "next/dynamic";

const AttractionTab = dynamic(() => import("@/components/AttractionTab"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

export default function AttractionPage() {
  return (
    <div className="p-4 md:p-6">
      <AttractionTab onUpdate={() => {}} />
    </div>
  );
}
