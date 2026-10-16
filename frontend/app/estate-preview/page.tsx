"use client";

// Public, no-login preview of the Real Estate section. Shareable with estate
// agents and prospects before go-live. Reads the same live data as the in-app
// Real Estate tab via the public /estate/public/* endpoints (no auth required).
import dynamic from "next/dynamic";

const EstatePreviewApp = dynamic(
  () => import("@/components/EstatePublic").then((m) => m.EstatePreviewApp),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    ),
  },
);

export default function EstatePreviewPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/10 to-background">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">Around You — Real Estate</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A preview of our Real Estate section — browse agencies, agents and show houses.
          </p>
        </div>
        <EstatePreviewApp />
      </div>
    </div>
  );
}
