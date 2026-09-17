"use client";

// -----------------------------------------------------------------------------
// Admin › Real Estate tab — under redevelopment.
//
// The previous agency/agent/property management UI and its criteria have been
// removed ahead of a full redesign. The tab itself is kept in the Admin
// Dashboard; it now shows a "coming soon" placeholder. The estate.* backend
// endpoints and the EstateAgencyForm / EstateAgentForm shells remain in place
// as scaffolding for the rebuild.
// -----------------------------------------------------------------------------

import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function EstateTab() {
  return (
    <Card className="border-[#AEECE4]/40">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#AEECE4]/20">
          <Building2 className="h-6 w-6 text-[#00C7BE]" />
        </div>
        <p className="text-lg font-semibold">Real Estate is being redeveloped</p>
        <p className="max-w-md text-sm text-muted-foreground">
          The Real Estate platform is being rebuilt. Agency, agent and property
          management will return here once the new design is ready.
        </p>
      </CardContent>
    </Card>
  );
}
