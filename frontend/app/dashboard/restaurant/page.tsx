"use client";

import dynamic from "next/dynamic";

const RestaurantTab = dynamic(() => import("@/components/RestaurantTab"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

export default function RestaurantPage() {
  return (
    <div className="p-4 md:p-6">
      <RestaurantTab onUpdate={() => {}} />
    </div>
  );
}
