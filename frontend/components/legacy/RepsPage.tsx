"use client";

import React, { useState } from "react";

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

function generateRepCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "REP-";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const inputStyle = {
  width: "100%", background: colors.surface2, border: `1px solid ${colors.border}`,
  color: colors.textPrimary, borderRadius: 8, padding: "9px 12px", fontSize: 13,
  marginBottom: 10, boxSizing: "border-box",
};
const labelStyle = { fontSize: 12, color: colors.textSecondary, marginBottom: 4, display: "block" };

function TextField({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} style={inputStyle} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

interface RepsPageProps {
  reps?: any[];
  onCreateRep?: (rep: any) => void;
  onDeleteRep?: (id: any) => void;
  onBack?: () => void;
  profileCountForRep?: (rep: any) => number;
}

export default function RepsPage({
  reps,
  onCreateRep,
  onDeleteRep,
  onBack,
  profileCountForRep,
}: RepsPageProps) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ repName: "", email: "", phone: "" });

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const submit = () => {
    if (!form.repName.trim() || !form.email.trim()) {
      alert("Rep Name and Email are required.");
      return;
    }
    onCreateRep({
      id: Date.now(),
      repName: form.repName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      repCode: generateRepCode(),
      createdAt: Date.now(),
    });
    setForm({ repName: "", email: "", phone: "" });
    setCreating(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: colors.background, color: colors.textPrimary, fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 18px 60px" }}>
        <button
          onClick={onBack}
          style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.textSecondary, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", marginBottom: 16 }}
        >
          ← Back to Dashboard
        </button>

        <h1 style={{ color: colors.primary, fontSize: 21, marginBottom: 4 }}>Reps</h1>
        <p style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>
          Super Admin creates each Rep's Rep Code and Rep Profile here. The Rep then uses their email + this Rep
          Code to sign in to the Tap Based Mobile Onboarding app.
        </p>

        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            style={{ width: "100%", background: "transparent", border: `1.5px solid ${colors.primary}`, color: colors.primary, borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 20 }}
          >
            + New Rep Profile
          </button>
        ) : (
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ color: colors.primary, margin: 0, fontSize: 15 }}>New Rep Profile</h3>
              <button onClick={() => setCreating(false)} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.textSecondary, borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>Cancel</button>
            </div>
            <TextField label="Rep Name" value={form.repName} onChange={set("repName")} />
            <TextField label="Email Address" type="email" value={form.email} onChange={set("email")} />
            <TextField label="Phone Number" value={form.phone} onChange={set("phone")} />
            <p style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 10 }}>
              A 12-character Rep Code is generated automatically on submit — the Rep uses it alongside their email
              to sign in.
            </p>
            <button
              onClick={submit}
              style={{ width: "100%", background: colors.primary, color: "#000", border: "none", borderRadius: 10, padding: 12, fontWeight: 800, fontSize: 14, cursor: "pointer" }}
            >
              Create Rep Profile
            </button>
          </div>
        )}

        <div style={{ color: colors.accent, fontWeight: 800, fontSize: 12.5, letterSpacing: 0.4, textTransform: "uppercase", margin: "10px 0" }}>
          All Reps ({reps.length})
        </div>

        {reps.length === 0 && <p style={{ color: colors.textSecondary, fontSize: 13 }}>No Reps created yet.</p>}

        {reps.map((rep) => (
          <div key={rep.id} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: colors.textPrimary }}>{rep.repName}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{rep.email}{rep.phone ? ` · ${rep.phone}` : ""}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                  Rep Code: <span style={{ color: colors.accent, fontWeight: 700 }}>{rep.repCode}</span>
                </div>
                <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                  {profileCountForRep ? profileCountForRep(rep.repName) : 0} profile(s) sold
                </div>
              </div>
              <button
                onClick={() => {
                  if (window.confirm(`Remove ${rep.repName}? Their existing profiles keep their Rep Name for commission history, but their Rep Code stops working.`)) {
                    onDeleteRep(rep.id);
                  }
                }}
                style={{ background: "transparent", border: `1px solid ${colors.error}`, color: colors.error, borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
