"use client";

import dynamic from "next/dynamic";

const PartnerApplyForm = dynamic(() => import("@/components/PartnerApplyForm"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

export default function ApplyRoute() {
  return <PartnerApplyForm />;
}
