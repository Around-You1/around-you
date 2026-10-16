"use client";

import React from "react";

// Gold "We support <org>" badge with a lumo-green halo, shown beside a partner
// that was onboarded by a Team Leader organisation (or one of its reps). The
// org name comes from the backend (supportOrgName); renders nothing when empty.
export default function SupportBadge({ orgName }: { orgName?: string | null }) {
  const name = (orgName || "").trim();
  if (!name) return null;
  return (
    <span
      title={`We support ${name}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px 3px 8px",
        borderRadius: 999,
        background: "linear-gradient(180deg,#FFEFB0 0%,#F6CF63 45%,#E0A32C 100%)",
        border: "1px solid rgba(255,255,255,0.55)",
        color: "#2c2000",
        lineHeight: 1,
        maxWidth: "100%",
        boxShadow:
          "0 0 0 1.5px rgba(57,255,20,0.95), 0 0 9px 1px rgba(57,255,20,0.55), 0 0 20px 3px rgba(57,255,20,0.30), inset 0 1px 0 rgba(255,255,255,0.75), inset 0 -2px 4px rgba(150,96,0,0.25)",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" style={{ flex: "none", display: "block" }} aria-hidden="true">
        <path
          d="M12 20.5C12 20.5 3.5 15.4 3.5 9.3c0-2.5 2-4.3 4.2-4.3 1.7 0 3.1 1 3.8 2.4C12.2 6 13.6 5 15.3 5c2.2 0 4.2 1.8 4.2 4.3 0 6.1-7.5 11.2-7.5 11.2Z"
          fill="#1f7a2e"
          stroke="#0e5a1f"
          strokeWidth="1"
        />
      </svg>
      <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.6px", textTransform: "uppercase", opacity: 0.72 }}>
          We support
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
      </span>
    </span>
  );
}
