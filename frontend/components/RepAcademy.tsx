"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Rep Academy — the rep's home screen after sign-in. It holds the reference
// material a rep needs (the shareable application link, the blank onboarding
// PDFs and the rep guide) and a Sign In button that opens the public
// "Join Around You" application form, pre-filled with the rep's own code.
// This replaces the old tap-based onboarding app; reps now onboard partners
// through the same /apply form partners use.

const colors = {
  background: "#000000",
  surface: "#0A0A0A",
  primary: "#39FF14",
  accent: "#00FFD1",
  textPrimary: "#E6F7E6",
  textSecondary: "#A6B0A6",
  border: "#1F1F1F",
};

function getRepSession() {
  if (typeof window === "undefined") return { repName: "", repCode: "" };
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return { repName: user.fullName || "", repCode: user.repCode || "" };
  } catch {
    return { repName: "", repCode: "" };
  }
}

// Blank "what we need to onboard you" forms, one per partner type. Always the
// latest version (regenerated with the app and served from /public).
const ONBOARDING_PDF: Record<string, string> = {
  Accommodations: "/onboarding/accommodation-onboarding.pdf",
  Restaurants: "/onboarding/restaurant-onboarding.pdf",
  Services: "/onboarding/service-onboarding.pdf",
  Attractions: "/onboarding/attraction-onboarding.pdf",
  "Real Estate & Rentals": "/onboarding/real-estate-onboarding.pdf",
};
const typeLabel = (t: string) => (t === "Services" ? "Business/Services" : t);

export default function RepAcademy() {
  const router = useRouter();
  const rep = getRepSession();
  const [linkCopied, setLinkCopied] = useState(false);

  const applyUrl = () =>
    `${window.location.origin}/apply?rep=${encodeURIComponent(rep.repCode || "")}`;

  const copyApplyLink = () => {
    const url = applyUrl();
    try {
      navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      window.prompt("Copy this application link to send to a partner:", url);
    }
  };

  const startApplication = () =>
    router.push(`/apply?rep=${encodeURIComponent(rep.repCode || "")}`);

  return (
    <div style={{ minHeight: "100vh", background: colors.background, color: colors.textPrimary, padding: "24px 16px" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <h1 style={{ color: colors.primary, fontSize: 24, fontWeight: 800, margin: 0 }}>Rep Academy</h1>
        <p style={{ color: colors.textSecondary, fontSize: 13, margin: "4px 0 20px" }}>
          Rep: {rep.repName || "—"} · Code: {rep.repCode || "—"}
        </p>

        {/* Copy application link */}
        <button
          onClick={copyApplyLink}
          style={{
            width: "100%", padding: "16px 12px", borderRadius: 16,
            background: colors.surface, border: `2px solid ${colors.accent}`, color: colors.accent,
            fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}
        >
          {linkCopied ? "✓ Link copied — paste it into an email/WhatsApp" : "Copy application link to send to a partner"}
        </button>
        <p style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>
          Send this to a potential partner (even outside your area). They fill it in online and it comes back to you and Accounts.
        </p>

        {/* Onboarding PDFs */}
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary, margin: 0 }}>Onboarding forms (PDF)</p>
          <p style={{ fontSize: 11, color: colors.textSecondary, margin: 0 }}>
            Blank forms to email a prospective partner. Always the latest version.
          </p>
          {Object.entries(ONBOARDING_PDF).map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"
              style={{ color: colors.primary, fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
              ⬇ {typeLabel(label)}
            </a>
          ))}
          <a href="/onboarding/rep-guide.pdf" target="_blank" rel="noopener noreferrer"
            style={{ color: colors.accent, fontSize: 15, fontWeight: 700, textDecoration: "none", marginTop: 4 }}>
            📘 Rep guide — how to complete the forms (PDF)
          </a>
        </div>

        {/* Sign In -> Join Around You (pre-filled with the rep's code) */}
        <button
          onClick={startApplication}
          style={{
            marginTop: 32, width: "100%", padding: "18px 12px", borderRadius: 16,
            background: colors.primary, border: "none", color: "#000",
            fontWeight: 800, fontSize: 17, cursor: "pointer",
          }}
        >
          Sign In
        </button>
        <p style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>
          Opens the Join Around You application, pre-filled with your rep code.
        </p>
      </div>
    </div>
  );
}
