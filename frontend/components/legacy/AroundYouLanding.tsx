"use client";

import React, { useState } from "react";
const logo = "/logo.png";

// ---- Color tokens (exact values from spec) ----
const colors = {
  background: "#000000",
  surface: "#0A0A0A",
  surface2: "#121212",
  primary: "#39FF14",
  primaryDark: "#2ECC10",
  accent: "#00FFD1",
  textPrimary: "#E6F7E6",
  textSecondary: "#A6B0A6",
  border: "#1F1F1F",
  error: "#FF4D4F",
  overlay: "rgba(0,0,0,0.6)",
};

const infoButtons = [
  {
    key: "about",
    label: "About Us",
    body:
      "Around You welcomes guests with instant access to verified accommodation info, curated local partners, and exclusive perks.\n\nAs a Holiday Guest or Local, log in with the information that the accommodation would have sent to you or the credentials required so as to unlock seamless navigation, trusted recommendations, and meaningful savings when you search for restaurants, services, and attractions Around You.\n\nEverything you need - where to go, what to enjoy, and how to get there is just one tap away.\n\nIt's hospitality, elevated.",
  },
  {
    key: "values",
    label: "Our Values",
    body:
      "Hospitality with Heart -\nWe believe hospitality should go beyond the stay. That's why Around You partners with Trinity CSR, a social impact initiative committed to giving back.\n\nThrough this collaboration, a portion of all platform sales supports causes that matter—like vulnerable communities, animal welfare, and grassroots organizations.",
  },
  {
    key: "how",
    label: "How It Works",
    body:
      "How to Use Around You - Around You is designed to elevate guests' experience. It's a smart, seamless way to view all the accommodation information, connect you with trusted local partners, and offer meaningful extras that help make your stay unforgettable.\n\nBy using Around You, you unlock a powerful hospitality tool that helps you feel welcomed, informed, and connected from the moment you arrive at your accommodation.\n\nYour accommodation would have issued you a unique \"Access Code\" or \"QR Code.\"\n\nClick the \"Log In\" button below, select the \"Guest\" tab, then select the \"Holiday\" tab, and either enter the accommodation name, address, province, and municipality, or enter the access code they may have sent you into the login portal. Then click the \"Sign In\" button.\n\nOr scan the QR Code the accommodation may have sent you. Make sure that on the Sign In page, the access code auto populates, then click the \"Sign In\" button.\n\nWhen logged in, guests instantly access:\n• Verified information about their accommodation\n\nGuests and Locals will access:\n• A curated selection of nearby restaurants, wellness venues, essential services, and local attractions\n• Exclusive discounts from select venues (redeemable via digital codes)\n• One click navigation to partner venues and points of interest",
  },
  {
    key: "partner",
    label: "Partner with Us",
    body:
      "Join the Around You Partner Family - Become part of the Around You Partner Family and choose the package that suits you best. Each package gives you access to our tools, marketing support, and exclusive partner benefits, so you can grow your reach and earnings.\n\nContact us at partners@aroundyou.co.za, where we will assist you in selecting a plan, completing a questionnaire for onboarding purposes, and starting to promote right away.",
    email: "partners@aroundyou.co.za",
  },
  {
    key: "reseller",
    label: "Become a Reseller",
    body:
      "Join our Sales Family - Become part of our sales family and earn 20% commission on all sales every month.\n\nYour sales carry forward and compound: what you sell in Month 1 is added to your Month 2 total; Month 1 + Month 2 are added to Month 3, and so on. This means consistent selling builds larger monthly totals and bigger payouts over time.\n\nCommissions are calculated and paid monthly, so you can track your progress and rewards each pay cycle.\n\nContact us at sales@aroundyou.co.za.",
    email: "sales@aroundyou.co.za",
  },
];

function InfoModal({ item, onClose }) {
  if (!item) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: colors.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 14,
          maxWidth: 420,
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          padding: 24,
          boxShadow: `0 0 24px ${colors.primary}33`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h2 style={{ color: colors.primary, fontSize: 18, margin: 0 }}>
            {item.label}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: `1px solid ${colors.border}`,
              color: colors.textSecondary,
              borderRadius: 8,
              width: 28,
              height: 28,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
        <p
          style={{
            color: colors.textPrimary,
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: "pre-line",
          }}
        >
          {item.body}
        </p>
        {item.email && (
          <a
            href={`mailto:${item.email}`}
            style={{
              display: "inline-block",
              marginTop: 12,
              color: colors.accent,
              textDecoration: "underline",
              fontSize: 14,
            }}
          >
            {item.email}
          </a>
        )}
      </div>
    </div>
  );
}

interface AroundYouLandingProps {
  onGuestSignIn?: () => void;
}

export default function AroundYouLanding({ onGuestSignIn }: AroundYouLandingProps) {
  const [openInfo, setOpenInfo] = useState(null);
  const [roleMessage, setRoleMessage] = useState("");

  // A scanned Guest QR Code (table talker) lands here as:
  // https://aroundyou.co.za/?guest_access=ACCESSCODE
  const [qrAccessCode] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("guest_access");
  });

  const roleButtons = [
    { key: "holiday", label: "Holiday Guest" },
    { key: "local", label: "Local Guest" },
    { key: "partner", label: "Partner" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.background,
        color: colors.textPrimary,
        fontFamily:
          "'Segoe UI', system-ui, -apple-system, sans-serif",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, padding: "28px 20px 60px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img
            src={logo}
            alt="Around You — Connecting Guests to What Matters"
            style={{ width: 220, height: "auto", margin: "0 auto", display: "block", filter: `drop-shadow(0 0 16px ${colors.primary}55)` }}
          />
        </div>

        <div
          style={{
            borderTop: `1px solid ${colors.border}`,
            marginBottom: 20,
          }}
        />

        {/* Info button grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginBottom: 22,
          }}
        >
          {infoButtons.map((item) => (
            <button
              key={item.key}
              onClick={() => setOpenInfo(item)}
              style={{
                background: colors.background,
                border: `1.5px solid ${colors.primary}`,
                color: colors.primary,
                borderRadius: 12,
                padding: "16px 6px",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                minHeight: 64,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = colors.primaryDark;
                e.currentTarget.style.boxShadow = `0 0 10px ${colors.primary}55`;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = colors.primary;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {item.label}
            </button>
          ))}
          {/* Contact Support - special case, mailto link styled as button */}
          <a
            href="mailto:support@aroundyou.co.za"
            style={{
              background: colors.background,
              border: `1.5px solid ${colors.primary}`,
              color: colors.primary,
              borderRadius: 12,
              padding: "16px 6px",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              minHeight: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            Contact
            <br />
            Support
          </a>
        </div>

        {/* Sign in section */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <span
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              letterSpacing: 1.5,
              fontWeight: 600,
            }}
          >
            SIGN IN AS A ...
          </span>
        </div>

        {qrAccessCode && (
          <div
            style={{
              background: "rgba(57,255,20,0.08)", border: `1px solid ${colors.primary}`, borderRadius: 10,
              padding: "10px 14px", fontSize: 12, color: colors.textSecondary, marginBottom: 14, textAlign: "center",
            }}
          >
            QR Code scanned — this accommodation's Access Code is ready. Tap <b style={{ color: colors.primary }}>Holiday Guest</b> to continue.
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginBottom: 20,
          }}
        >
          {roleButtons.map((role) => {
            // When entering via a scanned Guest QR Code, only Holiday Guest
            // stays active — Local Guest and Partner are greyed out but
            // still visible, per spec.
            const disabled = qrAccessCode && role.key !== "holiday";
            return (
              <button
                key={role.key}
                disabled={disabled}
                onClick={() => {
                  if (role.key === "holiday" && qrAccessCode) {
                    if (onGuestSignIn) onGuestSignIn(qrAccessCode);
                    else setRoleMessage(`[Wire up]: → Sign In → Guest → Holiday, Access Code auto-filled: ${qrAccessCode} → tap Sign In → accommodation page`);
                    return;
                  }
                  setRoleMessage(
                    `[Wire up]: ${role.label} → Sign In page (see spec for each role's auth flow)`
                  );
                }}
                style={{
                  background: colors.background,
                  border: `1.5px solid ${disabled ? colors.border : colors.primary}`,
                  color: disabled ? colors.textSecondary : colors.primary,
                  borderRadius: 12,
                  padding: "14px 6px",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: disabled ? "not-allowed" : "pointer",
                  minHeight: 56,
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                {role.label}
              </button>
            );
          })}
        </div>

        {roleMessage && (
          <div
            style={{
              fontSize: 12,
              color: colors.accent,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            {roleMessage}
          </div>
        )}

        {/* Radius / footer blurb */}
        <p
          style={{
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 1.6,
            textAlign: "left",
            marginBottom: 20,
          }}
        >
          We list Service Partners in and around your accommodation's
          location. Use the Radius slider to expand your search up to 150 km.
          To request inclusion of a service provider, submit full provider
          details to{" "}
          <a
            href="mailto:sales@aroundyou.co.za"
            style={{ color: colors.accent }}
          >
            sales@aroundyou.co.za
          </a>
          .
        </p>

        {/* Rep + Admin small links */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
          }}
        >
          <button
            disabled={!!qrAccessCode}
            onClick={() =>
              setRoleMessage("[Wire up]: Rep → email + Rep Code → Admin Dashboard (Add/Edit only)")
            }
            style={{
              background: "transparent",
              border: "none",
              color: colors.textSecondary,
              fontSize: 13,
              cursor: qrAccessCode ? "not-allowed" : "pointer",
              opacity: qrAccessCode ? 0.4 : 1,
            }}
          >
            Rep
          </button>
          <button
            disabled={!!qrAccessCode}
            onClick={() =>
              setRoleMessage("[Wire up]: Admin → email + password → Super Admin Dashboard")
            }
            style={{
              background: "transparent",
              border: "none",
              color: colors.textSecondary,
              fontSize: 13,
              cursor: qrAccessCode ? "not-allowed" : "pointer",
              opacity: qrAccessCode ? 0.4 : 1,
            }}
          >
            Admin
          </button>
        </div>
      </div>

      <InfoModal item={openInfo} onClose={() => setOpenInfo(null)} />
    </div>
  );
}
