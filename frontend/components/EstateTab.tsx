"use client";

// -----------------------------------------------------------------------------
// Admin › Real Estate tab.
//
// Phase 1 of the Real Estate redesign: the tab hosts the Estate Agent property
// criteria form (10-image carousel, Show House, Code, Price, Bedrooms,
// Bathrooms, Garages, URL). Backend persistence and the public
// Agencies → Agent → property pages are the next phases.
// -----------------------------------------------------------------------------

import EstatePropertyForm from "./EstatePropertyForm";

export default function EstateTab() {
  return (
    <div className="space-y-6">
      <EstatePropertyForm />
    </div>
  );
}
