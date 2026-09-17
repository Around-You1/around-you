"use client";

// -----------------------------------------------------------------------------
// Real Estate — under redevelopment.
//
// The previous public Real Estate experience (property/agency/agent browsing
// with all its search criteria and filters) has been removed ahead of a full
// redesign. This file is kept as scaffolding: every export the rest of the app
// depends on still exists, but each public view now renders a simple
// "coming soon" placeholder. Rebuild the real views here when the new design
// is ready. The estate.* backend endpoints are untouched.
// -----------------------------------------------------------------------------

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2 } from "lucide-react";

// Kept so any remaining importers keep compiling.
export function formatPrice(cents: number, listingType: string) {
  const rand = Math.round((cents || 0) / 100);
  const s = "R " + rand.toLocaleString("en-ZA").replace(/,/g, " ");
  return listingType === "rent" ? `${s} / month` : s;
}

// Display-card helpers retained as no-op stubs during the redevelopment.
export function PropertyCard(_: { p: any }) {
  return null;
}

export function AgentCard(_: { a: any }) {
  return null;
}

// Shared placeholder shown wherever Real Estate content used to appear.
function ComingSoon() {
  return (
    <Card className="border-[#AEECE4]/40">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#AEECE4]/20">
          <Building2 className="h-6 w-6 text-[#00C7BE]" />
        </div>
        <p className="text-lg font-semibold">Real Estate is coming soon</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Our Real Estate section is being redeveloped. Please check back shortly.
        </p>
      </CardContent>
    </Card>
  );
}

// Full-page placeholder (used by the /estate/* routes) with a Back button.
function ComingSoonPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/10 to-background">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Button variant="outline" size="sm" className="mb-6" onClick={() => router.back()}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <ComingSoon />
      </div>
    </div>
  );
}

// Embedded in the Guest dashboard's "Real Estate" tab.
export function EstateAgenciesBrowse() {
  return <ComingSoon />;
}

// Public detail routes: /estate/agency/[code], /estate/agent/[code], /estate/property/[id]
export function EstateAgencyView(_: { code: string }) {
  return <ComingSoonPage />;
}

export function EstateAgentView(_: { code: string }) {
  return <ComingSoonPage />;
}

export function EstatePropertyView(_: { id: number }) {
  return <ComingSoonPage />;
}
