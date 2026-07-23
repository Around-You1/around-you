"use client";

import React, { useState, useEffect } from "react";

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
};

const ROLES = ["Guest", "Local", "Partner", "Rep", "Admin"];

const inputStyle = {
  width: "100%",
  background: colors.surface2,
  border: `1px solid ${colors.border}`,
  color: colors.textPrimary,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  marginBottom: 10,
  boxSizing: "border-box",
};

const labelStyle = {
  fontSize: 12,
  color: colors.textSecondary,
  marginBottom: 4,
  display: "block",
};

const primaryBtn = {
  width: "100%",
  background: colors.primary,
  color: "#000000",
  border: "none",
  borderRadius: 10,
  padding: "12px",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  marginTop: 6,
};

const secondaryBtn = {
  width: "100%",
  background: "transparent",
  color: colors.primary,
  border: `1.5px solid ${colors.primary}`,
  borderRadius: 10,
  padding: "12px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  marginTop: 6,
};

function Field({ label, ...props }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} {...props} />
    </div>
  );
}

function Divider({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", margin: "16px 0" }}>
      <div style={{ flex: 1, height: 1, background: colors.border }} />
      <span
        style={{
          color: colors.textSecondary,
          fontSize: 11,
          padding: "0 10px",
        }}
      >
        {text}
      </span>
      <div style={{ flex: 1, height: 1, background: colors.border }} />
    </div>
  );
}

// ---------------- GUEST ----------------
function GuestPanel({ status, setStatus, prefillAccessCode }) {
  const [mode, setMode] = useState("code"); // "code" | "details"
  const [accessCode, setAccessCode] = useState(prefillAccessCode || "");
  const [accom, setAccom] = useState({
    name: "",
    address: "",
    country: "",
    province: "",
    postalCode: "",
  });

  useEffect(() => {
    if (prefillAccessCode) {
      setAccessCode(prefillAccessCode);
      setMode("code");
      setStatus(`Access Code auto-filled from QR Code (${prefillAccessCode}). Tap Sign In.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillAccessCode]);

  const simulateQrScan = () => {
    // In production: QR payload decodes to the 12-char Access Code
    const scanned = "A1B2C3D4E5F6";
    setAccessCode(scanned);
    setMode("code");
    setStatus(`QR scanned → Access Code auto-populated (${scanned}). Tap Sign In.`);
  };

  const submit = () => {
    if (mode === "code") {
      if (accessCode.trim().length !== 12) {
        setStatus("Access Code must be 12 characters.");
        return;
      }
      setStatus(`[Wire up]: Verify Access Code "${accessCode}" → load Accommodation profile.`);
    } else {
      const { name, address, country, province, postalCode } = accom;
      if (!name || !address || !country || !province || !postalCode) {
        setStatus("Please complete all accommodation fields.");
        return;
      }
      setStatus("[Wire up]: Match accommodation record → load Accommodation profile.");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            padding: "8px",
            borderRadius: 8,
            border: `1px solid ${colors.primary}`,
            color: colors.primary,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Holiday
        </div>
      </div>

      <button style={secondaryBtn} onClick={simulateQrScan}>
        Scan QR Code
      </button>

      <Divider text="OR" />

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setMode("code")}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: `1px solid ${mode === "code" ? colors.primary : colors.border}`,
            background: "transparent",
            color: mode === "code" ? colors.primary : colors.textSecondary,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Access Code
        </button>
        <button
          onClick={() => setMode("details")}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: `1px solid ${mode === "details" ? colors.primary : colors.border}`,
            background: "transparent",
            color: mode === "details" ? colors.primary : colors.textSecondary,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Accommodation Details
        </button>
      </div>

      {mode === "code" ? (
        <Field
          label="12-Character Access Code"
          value={accessCode}
          maxLength={12}
          onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
          placeholder="e.g. A1B2C3D4E5F6"
        />
      ) : (
        <>
          <Field
            label="Accommodation Name"
            value={accom.name}
            onChange={(e) => setAccom({ ...accom, name: e.target.value })}
          />
          <Field
            label="Address"
            value={accom.address}
            onChange={(e) => setAccom({ ...accom, address: e.target.value })}
          />
          <Field
            label="Country"
            value={accom.country}
            onChange={(e) => setAccom({ ...accom, country: e.target.value })}
          />
          <Field
            label="Province"
            value={accom.province}
            onChange={(e) => setAccom({ ...accom, province: e.target.value })}
          />
          <Field
            label="Postal Code"
            value={accom.postalCode}
            onChange={(e) => setAccom({ ...accom, postalCode: e.target.value })}
          />
        </>
      )}

      <button style={primaryBtn} onClick={submit}>
        Sign In
      </button>
    </div>
  );
}

// ---------------- LOCAL ----------------
function LocalPanel({ status, setStatus }) {
  const [otpStage, setOtpStage] = useState(false);
  const [otp, setOtp] = useState("");
  const [form, setForm] = useState({
    email: "",
    country: "",
    province: "",
    postalCode: "",
  });

  const submit = () => {
    const { email, country, province, postalCode } = form;
    if (!email || !country || !province || !postalCode) {
      setStatus("Please complete all fields.");
      return;
    }
    // [Wire up]: backend decides first-time vs returning, and monthly
    // sign-in count (5/month, or 10/month if flagged Super Local).
    setOtpStage(true);
    setStatus("First-time sign-in detected → OTP sent to email.");
  };

  const verifyOtp = () => {
    if (otp.trim().length < 4) {
      setStatus("Enter the OTP sent to your email.");
      return;
    }
    setStatus("[Wire up]: Verify OTP → create Local session, start monthly sign-in counter.");
  };

  return (
    <div>
      {!otpStage ? (
        <>
          <Field
            label="Email Address"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Field
            label="Country"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
          <Field
            label="Province"
            value={form.province}
            onChange={(e) => setForm({ ...form, province: e.target.value })}
          />
          <Field
            label="Postal Code"
            value={form.postalCode}
            onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
          />
          <button style={primaryBtn} onClick={submit}>
            Sign In
          </button>
          <p style={{ fontSize: 11, color: colors.textSecondary, marginTop: 10 }}>
            First sign-in each account requires an OTP. After that: up to 5
            sign-ins per month, or 10/month with Super Local status.
          </p>
        </>
      ) : (
        <>
          <Field
            label="Enter OTP sent to your email"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
          />
          <button style={primaryBtn} onClick={verifyOtp}>
            Verify OTP
          </button>
        </>
      )}
    </div>
  );
}

// ---------------- PARTNER ----------------
function PartnerPanel({ status, setStatus }) {
  const [mode, setMode] = useState("edit"); // "edit" | "qr"
  const [editCode, setEditCode] = useState("");

  const simulateQrScan = () => {
    const scanned = "P9Q8R7S6T5U4";
    setEditCode(scanned);
    setStatus(`QR scanned → viewing profile (read-only via Access Code logic).`);
  };

  const submit = () => {
    if (editCode.trim().length !== 12) {
      setStatus("Edit Code must be 12 characters.");
      return;
    }
    setStatus(`[Wire up]: Verify Edit Code "${editCode}" → open Partner profile (view/edit).`);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setMode("edit")}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: `1px solid ${mode === "edit" ? colors.primary : colors.border}`,
            background: "transparent",
            color: mode === "edit" ? colors.primary : colors.textSecondary,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Edit Code
        </button>
        <button
          onClick={() => setMode("qr")}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: `1px solid ${mode === "qr" ? colors.primary : colors.border}`,
            background: "transparent",
            color: mode === "qr" ? colors.primary : colors.textSecondary,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          QR Code
        </button>
      </div>

      {mode === "edit" ? (
        <>
          <Field
            label="12-Character Edit Code"
            value={editCode}
            maxLength={12}
            onChange={(e) => setEditCode(e.target.value.toUpperCase())}
            placeholder="e.g. P9Q8R7S6T5U4"
          />
          <button style={primaryBtn} onClick={submit}>
            Sign In
          </button>
        </>
      ) : (
        <button style={primaryBtn} onClick={simulateQrScan}>
          Scan QR Code
        </button>
      )}
    </div>
  );
}

// ---------------- REP ----------------
function RepPanel({ status, setStatus }) {
  const [form, setForm] = useState({ email: "", repCode: "" });

  const submit = () => {
    if (!form.email || !form.repCode) {
      setStatus("Enter email and Rep Code.");
      return;
    }
    setStatus(
      "[Wire up]: Verify email + Rep Code (issued by Super Admin) → open Admin Dashboard (Add/Edit only)."
    );
  };

  return (
    <div>
      <Field
        label="Email Address"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <Field
        label="Rep Code"
        value={form.repCode}
        onChange={(e) => setForm({ ...form, repCode: e.target.value })}
      />
      <button style={primaryBtn} onClick={submit}>
        Sign In
      </button>
      <p style={{ fontSize: 11, color: colors.textSecondary, marginTop: 10 }}>
        No Rep Code? Ask Super Admin to create your Rep Code and Rep Profile.
      </p>
    </div>
  );
}

// ---------------- ADMIN ----------------
function AdminPanel({ status, setStatus }) {
  const [form, setForm] = useState({ email: "", password: "" });

  const submit = () => {
    // NOTE: this is a client-side placeholder only. Real credential
    // checking must happen on the server, with the password hashed —
    // never compared in front-end code like this in production.
    if (!form.email || !form.password) {
      setStatus("Enter email and password.");
      return;
    }
    setStatus("[Wire up]: Verify credentials server-side → open Super Admin Dashboard (Add/Edit/Delete).");
  };

  return (
    <div>
      <Field
        label="Email Address"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <Field
        label="Password"
        type="password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <button style={primaryBtn} onClick={submit}>
        Sign In
      </button>
    </div>
  );
}

export default function SignInPages({ prefillAccessCode }) {
  const [activeRole, setActiveRole] = useState("Guest");
  const [status, setStatus] = useState("");

  const panels = {
    Guest: <GuestPanel status={status} setStatus={setStatus} prefillAccessCode={prefillAccessCode} />,
    Local: <LocalPanel status={status} setStatus={setStatus} />,
    Partner: <PartnerPanel status={status} setStatus={setStatus} />,
    Rep: <RepPanel status={status} setStatus={setStatus} />,
    Admin: <AdminPanel status={status} setStatus={setStatus} />,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.background,
        color: colors.textPrimary,
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440, padding: "28px 20px 60px" }}>
        <h1
          style={{
            textAlign: "center",
            fontSize: 22,
            color: colors.primary,
            marginBottom: 4,
          }}
        >
          Sign In
        </h1>
        <p
          style={{
            textAlign: "center",
            color: colors.textSecondary,
            fontSize: 12,
            marginBottom: 20,
          }}
        >
          Choose your role to continue
        </p>

        {/* Role tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 6,
            marginBottom: 20,
          }}
        >
          {ROLES.map((role) => (
            <button
              key={role}
              onClick={() => {
                setActiveRole(role);
                setStatus("");
              }}
              style={{
                background:
                  activeRole === role ? colors.primary : "transparent",
                color: activeRole === role ? "#000000" : colors.textSecondary,
                border: `1px solid ${
                  activeRole === role ? colors.primary : colors.border
                }`,
                borderRadius: 8,
                padding: "8px 2px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {role}
            </button>
          ))}
        </div>

        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 14,
            padding: 18,
          }}
        >
          {panels[activeRole]}
        </div>

        {status && (
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: colors.accent,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
