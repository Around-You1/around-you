"use client";

import React from "react";
const logoPrint = "/around-you-logo-print.png";

const colors = {
  primary: "#39FF14",
  primaryDark: "#2ECC10",
  accent: "#00FFD1",
  ink: "#1A1A1A",
  inkSoft: "#4A4A4A",
  border: "#E4E4E4",
};

// QR modules stay black-on-white regardless of brand color — colored or
// low-contrast QR codes fail to scan reliably at small print sizes (A6
// especially). Swap this for the `qrcode` npm package once this is wired
// up in Claude Code, so codes render without needing internet access.
function qrImageUrl(data, sizePx = 500) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${sizePx}x${sizePx}&data=${encodeURIComponent(data)}&margin=8`;
}

function PrintButton({ targetId, label }) {
  return (
    <>
      <button
        onClick={() => window.print()}
        className="no-print"
        style={{
          display: "block", margin: "16px auto 0", background: colors.primary, color: "#000",
          border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 800, fontSize: 14, cursor: "pointer",
        }}
      >
        {label}
      </button>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
      `}</style>
    </>
  );
}

// =========================================================
// A5 Table Talker — Accommodation / Guest QR
// Directs a scanning Guest to the landing page with the
// accommodation's Access Code pre-filled on the Sign In page.
// =========================================================
export function GuestTableTalkerA5({
  profileName = "Test Guesthouse Durbanville",
  accessCode = "A1B2C3D4E5F6",
  baseUrl = "https://aroundyou.co.za",
}) {
  const qrTarget = `${baseUrl}/?guest_access=${accessCode}`;

  return (
    <div style={{ background: "#f2f2f2", padding: 24, display: "flex", justifyContent: "center" }}>
      <div>
        <div
          id="talker-a5"
          style={{
            width: "148mm", height: "210mm", background: "#FFFFFF", boxSizing: "border-box",
            padding: "14mm 12mm", display: "flex", flexDirection: "column", alignItems: "center",
            textAlign: "center", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
            border: `1px solid ${colors.border}`,
          }}
        >
          <img
            src={logoPrint}
            alt="Around You — Connecting Guests to What Matters"
            style={{ width: 130, height: "auto", marginBottom: 10 }}
          />

          <h1 style={{ fontSize: 17, color: colors.ink, margin: "0 0 10px" }}>Welcome to Around You</h1>

          <p style={{ fontSize: 12.5, color: colors.ink, lineHeight: 1.6, margin: "0 0 10px" }}>
            <b>Thanks to {profileName}</b>
            <br />
            we are able to make it possible for you to see what is around you, all in one place.
          </p>

          <p style={{ fontSize: 12.5, color: colors.inkSoft, lineHeight: 1.6, margin: "0 0 16px" }}>
            Please scan the QR Code below, where you will be able to see all that this accommodation, where you
            have booked into, has to offer, along with local restaurants, services and attractions within a 150km
            radius of this accommodation.
          </p>

          <div style={{ border: `4px solid ${colors.primaryDark}`, borderRadius: 12, padding: 10 }}>
            <img src={qrImageUrl(qrTarget)} alt="Accommodation QR Code" style={{ width: 150, height: 150, display: "block" }} />
          </div>

          <div style={{ flex: 1 }} />

          <p style={{ fontSize: 10.5, color: colors.inkSoft, lineHeight: 1.5, margin: 0 }}>
            If you wish to connect your business to Around You, please do not hesitate to send us a mail{" "}
            <span style={{ color: colors.primaryDark }}>sales@aroundyou.co.za</span>
          </p>
        </div>

        <PrintButton label="Download / Print A5 Table Talker" />
      </div>
    </div>
  );
}

// =========================================================
// A6 Decal — Restaurant / Service / Attraction Partner QR
// Directs a scanning Guest or Local straight to that partner's
// own profile page (tier-gated, same as the "More" view).
// =========================================================
export function PartnerDecalA6({
  profileName = "Test Restaurant",
  editCode = "P9Q8R7S6T5U4",
  baseUrl = "https://aroundyou.co.za",
}) {
  // Scanning this opens the partner's public profile (read-only view,
  // same access level as the Access Code — the Edit Code login flow on
  // the Sign In page is separate and used only by the partner themself).
  const qrTarget = `${baseUrl}/partner/${editCode}`;

  return (
    <div style={{ background: "#f2f2f2", padding: 24, display: "flex", justifyContent: "center" }}>
      <div>
        <div
          id="decal-a6"
          style={{
            width: "105mm", height: "148mm", background: "#FFFFFF", boxSizing: "border-box",
            padding: "10mm 9mm", display: "flex", flexDirection: "column", alignItems: "center",
            textAlign: "center", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
            border: `1px solid ${colors.border}`,
          }}
        >
          <img
            src={logoPrint}
            alt="Around You — Connecting Guests to What Matters"
            style={{ width: 95, height: "auto", marginBottom: 8 }}
          />

          <h1 style={{ fontSize: 13, color: colors.ink, margin: "0 0 8px" }}>Welcome to Around You</h1>

          <p style={{ fontSize: 10, color: colors.inkSoft, lineHeight: 1.5, margin: "0 0 12px" }}>
            Please scan the QR Code below, where you will be able to see all that {profileName} has to offer.
          </p>

          <div style={{ border: `3px solid ${colors.primaryDark}`, borderRadius: 10, padding: 8 }}>
            <img src={qrImageUrl(qrTarget, 400)} alt={`${profileName} QR Code`} style={{ width: 110, height: 110, display: "block" }} />
          </div>

          <div style={{ flex: 1 }} />

          <p style={{ fontSize: 8.5, color: colors.inkSoft, lineHeight: 1.4, margin: 0 }}>
            If you wish to connect your business to Around You, please do not hesitate to send us a mail{" "}
            <span style={{ color: colors.primaryDark }}>sales@aroundyou.co.za</span>
          </p>
        </div>

        <PrintButton label="Download / Print A6 Decal" />
      </div>
    </div>
  );
}

// Demo — shows both, side by side, with sample data
export default function QRDesigns() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center", padding: 20, background: "#000" }}>
      <GuestTableTalkerA5 />
      <PartnerDecalA6 />
    </div>
  );
}
