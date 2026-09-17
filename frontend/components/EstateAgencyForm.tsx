"use client";

// -----------------------------------------------------------------------------
// EstateAgencyForm — criteria removed, kept as scaffolding.
//
// All of the previous agency / property / agent input fields have been removed
// ahead of the Real Estate redesign. The component keeps its original props so
// it can be wired back in, but for now it only renders a short placeholder.
// Rebuild the form fields here when the new design is ready.
// -----------------------------------------------------------------------------

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EstateAgencyForm({
  agencyId,
  onClose,
}: {
  agencyId?: number;
  onClose: () => void;
  onSaved: () => void;
  defaultRepCode?: string;
  defaultRepName?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{agencyId ? "Edit Estate Agency" : "Add Estate Agency"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The Real Estate platform is being redeveloped. This form will return
          once the new design is ready.
        </p>
        <Button variant="outline" onClick={onClose}>Back</Button>
      </CardContent>
    </Card>
  );
}
