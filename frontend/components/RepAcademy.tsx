"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthenticatedBackend } from "../lib/backend";

// Rep Academy — the rep's home screen after sign-in. It holds the reference
// material a rep needs (the shareable application link, the blank onboarding
// PDFs and the rep guide), a postal-code partner finder, and a Sign In button
// that opens the public "Join Around You" application form, pre-filled with the
// rep's own code. This replaces the old tap-based onboarding app.

const colors = {
  background: "#000000",
  surface: "#0A0A0A",
  surface2: "#121212",
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

// Live print routes — each opens a blank form generated from the shared schema
// (lib/onboardingSchema.ts) and pops the browser's Save-as-PDF dialog, so the
// printed form is always the latest version. No static PDFs to keep in sync.
const ONBOARDING_PDF: Record<string, string> = {
  Accommodations: "/onboarding/print/accommodation",
  Restaurants: "/onboarding/print/restaurant",
  Services: "/onboarding/print/service",
  Attractions: "/onboarding/print/attraction",
  "Real Estate & Rentals": "/onboarding/print/real-estate",
};
const typeLabel = (t: string) => (t === "Services" ? "Business/Services" : t === "Attractions" ? "Attractions/Activities" : t);

interface NearResults {
  accommodations: string[];
  restaurants: string[];
  services: string[];
  attractions: string[];
  realEstate: string[];
}

export default function RepAcademy() {
  const router = useRouter();
  const rep = getRepSession();
  const [linkCopied, setLinkCopied] = useState(false);

  const [postal, setPostal] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NearResults | null>(null);
  const [searchErr, setSearchErr] = useState("");

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

  const findPartners = async () => {
    const code = postal.trim();
    if (!code) {
      setSearchErr("Please enter a postal code.");
      return;
    }
    setSearchErr("");
    setSearching(true);
    setResults(null);
    try {
      const backend = getAuthenticatedBackend();
      const res = await backend.rep.partnersNear({ postalCode: code });
      setResults(res as NearResults);
    } catch (e: any) {
      setSearchErr(e?.message || "Could not load partners — please try again.");
    } finally {
      setSearching(false);
    }
  };

  const GROUPS: { heading: string; key: keyof NearResults }[] = [
    { heading: "Accommodations", key: "accommodations" },
    { heading: "Restaurants/Takeaways", key: "restaurants" },
    { heading: "Business/Services", key: "services" },
    { heading: "Attractions/Activities", key: "attractions" },
    { heading: "Real Estate", key: "realEstate" },
  ];

  const totalFound = results
    ? GROUPS.reduce((sum, g) => sum + (results[g.key]?.length || 0), 0)
    : 0;

  return (
    <div style={{ minHeight: "100vh", background: colors.background, color: colors.textPrimary, padding: "24px 16px" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <h1 style={{ color: colors.primary, fontSize: 24, fontWeight: 800, margin: 0 }}>Rep Academy</h1>
        <p style={{ color: colors.textSecondary, fontSize: 13, margin: "4px 0 20px" }}>
          Rep: {rep.repName || "—"} · Code: {rep.repCode || "—"}
        </p>

        {/* Open the application form yourself — prominent, top of page */}
        <div
          style={{
            background: colors.surface,
            border: `2px solid ${colors.primary}`,
            borderRadius: 16,
            padding: 16,
            marginBottom: 18,
            boxShadow: "0 0 24px rgba(57,255,20,0.12)",
          }}
        >
          <p style={{ color: colors.primary, fontSize: 16, fontWeight: 800, margin: 0 }}>
            Sign a partner up now
          </p>
          <p style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 1.55, margin: "6px 0 14px" }}>
            Open the <b style={{ color: colors.textPrimary }}>Join Around You</b> application and complete a new
            partner&apos;s listing with them on the spot — choose{" "}
            <b style={{ color: colors.textPrimary }}>Accommodation</b>,{" "}
            <b style={{ color: colors.textPrimary }}>Restaurant/Takeaway</b>,{" "}
            <b style={{ color: colors.textPrimary }}>Business/Service</b>,{" "}
            <b style={{ color: colors.textPrimary }}>Attraction/Activity</b> or{" "}
            <b style={{ color: colors.textPrimary }}>Real Estate &amp; Rentals</b>. It opens pre-filled with your rep
            code ({rep.repCode || "—"}), so the sign-up — and its commission — is credited to you automatically.
          </p>
          <button
            onClick={startApplication}
            style={{
              width: "100%",
              padding: "16px 12px",
              borderRadius: 14,
              background: colors.primary,
              color: "#000",
              border: "none",
              fontWeight: 800,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            ➕ Onboard a New Partner
          </button>
        </div>

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
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: colors.primary, color: "#000", fontSize: 15, fontWeight: 800,
                textDecoration: "none", padding: "12px 16px", borderRadius: 12, textAlign: "center",
              }}>
              ⬇ Download {typeLabel(label)} form
            </a>
          ))}
          <a href="/onboarding/rep-guide.pdf" download
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: "transparent", color: colors.accent, fontSize: 15, fontWeight: 800,
              textDecoration: "none", padding: "12px 16px", borderRadius: 12, marginTop: 4,
              border: `1px solid ${colors.accent}`, textAlign: "center",
            }}>
            📘 Download Rep guide (PDF)
          </a>
        </div>

        {/* Partner finder by postal code (5km radius) */}
        <div style={{ marginTop: 28, padding: 16, borderRadius: 16, background: colors.surface, border: `1px solid ${colors.border}` }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: colors.primary, margin: 0 }}>Find partners near a postal code</p>
          <p style={{ fontSize: 11, color: colors.textSecondary, margin: "4px 0 12px" }}>
            See which partners are already on Around You within about 5km of a postal code.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={postal}
              onChange={(e) => setPostal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") findPartners(); }}
              placeholder="Postal code"
              inputMode="numeric"
              style={{
                flex: 1, minWidth: 0, padding: "12px", borderRadius: 10,
                background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.textPrimary, fontSize: 15,
              }}
            />
            <button
              onClick={findPartners}
              disabled={searching}
              style={{
                padding: "12px 16px", borderRadius: 10, background: colors.primary, border: "none",
                color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: searching ? 0.6 : 1,
              }}
            >
              {searching ? "…" : "Search"}
            </button>
          </div>
          {searchErr ? <p style={{ color: "#FF6B6B", fontSize: 12, marginTop: 8 }}>{searchErr}</p> : null}

          {results && (
            <div style={{ marginTop: 16 }}>
              {totalFound === 0 ? (
                <p style={{ fontSize: 13, color: colors.textSecondary }}>
                  No partners found within 5km of that postal code.
                </p>
              ) : (
                GROUPS.map((g) => (
                  <div key={g.key} style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: colors.accent, margin: "0 0 4px" }}>
                      {g.heading} ({results[g.key]?.length || 0})
                    </p>
                    {results[g.key] && results[g.key].length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {results[g.key].map((name) => (
                          <li key={name} style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 1.6 }}>{name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ fontSize: 12, color: colors.textSecondary, margin: 0 }}>None</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Training videos */}
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary, margin: 0 }}>Videos</p>
          <a href="https://youtu.be/G8k-ILOYOos" target="_blank" rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: colors.surface, color: colors.primary, fontSize: 15, fontWeight: 800,
              textDecoration: "none", padding: "12px 16px", borderRadius: 12,
              border: `1px solid ${colors.primary}`, textAlign: "center",
            }}>
            ▶ Why Accommodation should join
          </a>
          <a href="https://youtu.be/rKTS1obzq_o" target="_blank" rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: colors.surface, color: colors.primary, fontSize: 15, fontWeight: 800,
              textDecoration: "none", padding: "12px 16px", borderRadius: 12,
              border: `1px solid ${colors.primary}`, textAlign: "center",
            }}>
            ▶ Why Partner with us
          </a>
          <p style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.55, margin: "4px 0 0" }}>
            In order to send a video to a prospective Partner, right click on the video and then select
            &ldquo;copy link address&rdquo;. Then send the link.
          </p>
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
