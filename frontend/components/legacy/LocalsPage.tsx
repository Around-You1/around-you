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

// Seed sample accounts — in production this list is populated by the real
// Local sign-in flow (email + OTP verification), not created here by hand.
// Manual "+ Add" below exists only so this screen has something to manage
// before that backend exists.
const SEED_LOCALS = [
  { id: 1, name: "T. Adams", email: "t.adams@example.co.za", province: "Western Cape", postalCode: "7550", signInsThisMonth: 4, superLocal: false },
  { id: 2, name: "N. Dlamini", email: "n.dlamini@example.co.za", province: "Western Cape", postalCode: "7530", signInsThisMonth: 5, superLocal: true },
  { id: 3, name: "R. Petersen", email: "r.petersen@example.co.za", province: "Gauteng", postalCode: "2196", signInsThisMonth: 2, superLocal: false },
];

interface LocalsPageProps {
  onBack?: () => void;
}

export default function LocalsPage({ onBack }: LocalsPageProps) {
  const [locals, setLocals] = useState(SEED_LOCALS);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", province: "", postalCode: "" });
  const [search, setSearch] = useState("");

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const submit = () => {
    if (!form.name.trim() || !form.email.trim()) {
      alert("Name and Email are required.");
      return;
    }
    setLocals((prev) => [
      ...prev,
      { id: Date.now(), ...form, signInsThisMonth: 0, superLocal: false },
    ]);
    setForm({ name: "", email: "", province: "", postalCode: "" });
    setCreating(false);
  };

  const toggleSuperLocal = (id) => {
    setLocals((prev) => prev.map((l) => (l.id === id ? { ...l, superLocal: !l.superLocal } : l)));
  };

  const filtered = locals.filter((l) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
  });

  return (
    <div style={{ minHeight: "100vh", background: colors.background, color: colors.textPrimary, fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 18px 60px" }}>
        <button
          onClick={onBack}
          style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.textSecondary, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", marginBottom: 16 }}
        >
          ← Back to Dashboard
        </button>

        <h1 style={{ color: colors.primary, fontSize: 21, marginBottom: 4 }}>Local Guests</h1>
        <p style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>
          Locals sign in up to 5 times a month by default. Awarding <b style={{ color: colors.accent }}>Super Local</b> status
          raises that to 10. The 3 accounts below are seed data — real accounts populate this list once the Local
          sign-in / OTP flow is wired to a real backend.
        </p>

        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            style={{ width: "100%", background: "transparent", border: `1.5px solid ${colors.primary}`, color: colors.primary, borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 20 }}
          >
            + Add Local Account
          </button>
        ) : (
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ color: colors.primary, margin: 0, fontSize: 15 }}>New Local Account</h3>
              <button onClick={() => setCreating(false)} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.textSecondary, borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>Cancel</button>
            </div>
            <TextField label="Name" value={form.name} onChange={set("name")} />
            <TextField label="Email Address" type="email" value={form.email} onChange={set("email")} />
            <TextField label="Province" value={form.province} onChange={set("province")} />
            <TextField label="Postal Code" value={form.postalCode} onChange={set("postalCode")} />
            <button
              onClick={submit}
              style={{ width: "100%", background: colors.primary, color: "#000", border: "none", borderRadius: 10, padding: 12, fontWeight: 800, fontSize: 14, cursor: "pointer" }}
            >
              Add Account
            </button>
          </div>
        )}

        <div style={{ color: colors.accent, fontWeight: 800, fontSize: 12.5, letterSpacing: 0.4, textTransform: "uppercase", margin: "10px 0" }}>
          All Local Guests ({filtered.length})
        </div>

        {filtered.length === 0 && <p style={{ color: colors.textSecondary, fontSize: 13 }}>No matching Local accounts.</p>}

        {filtered.map((l) => {
          const limit = l.superLocal ? 10 : 5;
          const overLimit = l.signInsThisMonth > limit;
          return (
            <div key={l.id} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: colors.textPrimary }}>{l.name}</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{l.email}</div>
                  <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                    {l.province}{l.province && l.postalCode ? " · " : ""}{l.postalCode}
                  </div>
                </div>
                {l.superLocal && (
                  <span style={{ fontSize: 10, color: "#000", background: colors.primary, borderRadius: 12, padding: "3px 8px", fontWeight: 800 }}>
                    SUPER LOCAL
                  </span>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <span style={{ fontSize: 12, color: overLimit ? colors.error : colors.textSecondary }}>
                  Sign-ins this month: {l.signInsThisMonth} / {limit}
                </span>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: l.superLocal ? colors.primary : colors.textSecondary, cursor: "pointer" }}>
                  <input type="checkbox" checked={l.superLocal} onChange={() => toggleSuperLocal(l.id)} style={{ accentColor: colors.primary }} />
                  Super Local (10/month)
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
