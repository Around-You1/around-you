"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import backend from "~backend/client";
import AppLogo from "../components/AppLogo";

const LUMO = "#39FF14";
const LUMO_DARK = "#2dd10f";

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(57,255,20,0.2)",
  color: "#fff",
  borderRadius: 8,
  padding: "10px 14px",
  width: "100%",
  fontSize: "0.9rem",
  outline: "none",
};
const labelCls = "text-xs font-semibold uppercase tracking-wider";
const labelStyle = { color: "#a0a0a0" } as React.CSSProperties;

const emptyApp = {
  fullName: "", idNumber: "", dateOfBirth: "", phone: "", email: "",
  residentialAddress: "", postalAddress: "", taxNumber: "", vatNumber: "",
  bankAccountName: "", bankName: "", bankAccountNumber: "", bankBranchCode: "", bankAccountType: "",
  uplineRepCode: "", popiaConsent: false, agreementConsent: false, signatureName: "",
};

export default function RepLoginPage() {
  const router = useRouter();
  const navigate = (to: string) => router.push(to);
  const { toast, dismiss } = useToast();

  const [mode, setMode] = useState<"signin" | "apply">("signin");
  const [fullName, setFullName] = useState("");
  const [repCode, setRepCode] = useState("");
  const [loading, setLoading] = useState(false);

  const [app, setApp] = useState({ ...emptyApp });
  const [submitting, setSubmitting] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const setA = (k: keyof typeof emptyApp) => (v: any) => setApp((s) => ({ ...s, [k]: v }));

  async function handleRepLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !repCode.trim()) {
      toast({ title: "Validation Error", description: "Full name and rep code are required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await backend.auth.repLogin({ fullName: fullName.trim(), repCode: repCode.trim() });
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      dismiss();
      toast({ title: "Welcome!", description: `Signed in as ${res.user.fullName}` });
      navigate("/rep-onboarding");
    } catch (err: any) {
      toast({ title: "Login Failed", description: err?.message || "Invalid full name or rep code", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!app.fullName.trim()) { toast({ title: "Validation Error", description: "Full name is required", variant: "destructive" }); return; }
    if (!app.popiaConsent || !app.agreementConsent) {
      toast({ title: "Consent required", description: "Please accept the POPIA consent and the commission agreement.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await backend.auth.repApplication(app);
      setNewCode(res.repCode);
      // pre-fill the sign-in form for convenience
      setFullName(res.fullName || app.fullName);
      setRepCode(res.repCode);
    } catch (err: any) {
      toast({ title: "Application failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // ---- success screen after applying ----
  if (newCode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0a0a0a" }}>
        <div className="w-full max-w-sm">
          <div className="mb-6 pt-4"><AppLogo /></div>
          <div className="rounded-2xl p-6 space-y-4 text-center" style={{ background: "#111", border: "1px solid rgba(57,255,20,0.18)", boxShadow: "0 0 40px rgba(57,255,20,0.06)" }}>
            <div style={{ fontSize: 38 }}>✅</div>
            <p className="text-sm" style={{ color: "#cdd" }}>Your application has been submitted. Here is your new Rep Code — please write it down:</p>
            <div style={{ background: "rgba(57,255,20,0.08)", border: `1px solid ${LUMO}`, borderRadius: 10, padding: "14px" }}>
              <div className="text-xs uppercase tracking-widest" style={{ color: "#888" }}>Rep Code</div>
              <div style={{ color: LUMO, fontWeight: 800, fontSize: 22, letterSpacing: "0.04em" }}>{newCode}</div>
            </div>
            <p className="text-xs" style={{ color: "#f0c040" }}>Your application is <b>pending approval</b>. Once it's activated you'll be able to sign in with your full name and this Rep Code.</p>
            <button
              onClick={() => { setNewCode(null); setApp({ ...emptyApp }); setMode("signin"); }}
              style={{ background: `linear-gradient(135deg, ${LUMO}, ${LUMO_DARK})`, color: "#000", border: "none", borderRadius: 10, padding: "14px 0", width: "100%", fontWeight: 700, fontSize: "1rem", cursor: "pointer", minHeight: 48 }}
            >
              Continue to Rep Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0a0a0a" }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 pt-4"><AppLogo /></div>

        <div className="rounded-2xl p-6 space-y-3" style={{ background: "#111111", border: "1px solid rgba(57,255,20,0.18)", boxShadow: "0 0 40px rgba(57,255,20,0.06)" }}>

          {/* mode switch */}
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            {(["signin", "apply"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                style={{ flex: 1, borderRadius: 8, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em",
                  background: mode === m ? `linear-gradient(135deg, ${LUMO}, ${LUMO_DARK})` : "transparent",
                  color: mode === m ? "#000" : "#888", border: `1px solid ${mode === m ? LUMO : "rgba(255,255,255,0.12)"}` }}>
                {m === "signin" ? "Rep Sign In" : "New Rep Application"}
              </button>
            ))}
          </div>

          {mode === "signin" ? (
            <form id="rep-login-form" onSubmit={handleRepLogin} className="space-y-4" aria-label="Rep login form">
              <div className="space-y-1.5">
                <label htmlFor="rep-full-name" className={labelCls} style={labelStyle}>Full Name</label>
                <input id="rep-full-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" autoFocus style={inputStyle} className="transition-all focus:border-[#39FF14] placeholder-gray-600" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="rep-code" className={labelCls} style={labelStyle}>Rep Code</label>
                <input id="rep-code" type="text" value={repCode} onChange={(e) => setRepCode(e.target.value)} placeholder="e.g. Rep00000001" autoComplete="off" style={inputStyle} className="transition-all focus:border-[#39FF14] placeholder-gray-600" />
              </div>
              <button id="rep-login-btn" type="submit" disabled={loading}
                style={{ background: loading ? "#1a3a0a" : `linear-gradient(135deg, ${LUMO}, ${LUMO_DARK})`, color: "#000", border: "none", borderRadius: 10, padding: "14px 0", width: "100%", fontWeight: 700, fontSize: "1rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, minHeight: 48, marginTop: 8 }}
                className="touch-manipulation">
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleApply} className="space-y-3" aria-label="Rep application form">
              <p className="text-xs" style={{ color: "#888" }}>Commission-only, self-employed sales agent — individuals only. Your details are kept on file; you'll receive a Rep Code to sign in with.</p>

              <Field label="Full Legal Name *" value={app.fullName} onChange={setA("fullName")} />
              <div style={{ display: "flex", gap: 8 }}>
                <Field label="SA ID / Passport No." value={app.idNumber} onChange={setA("idNumber")} />
                <Field label="Date of Birth" type="date" value={app.dateOfBirth} onChange={setA("dateOfBirth")} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Field label="Mobile" value={app.phone} onChange={setA("phone")} />
                <Field label="Email" value={app.email} onChange={setA("email")} />
              </div>
              <Field label="Residential Address" value={app.residentialAddress} onChange={setA("residentialAddress")} />
              <Field label="Postal Address" value={app.postalAddress} onChange={setA("postalAddress")} />
              <div style={{ display: "flex", gap: 8 }}>
                <Field label="SARS Tax Number" value={app.taxNumber} onChange={setA("taxNumber")} />
                <Field label="VAT No. (if any)" value={app.vatNumber} onChange={setA("vatNumber")} />
              </div>

              <p className={labelCls} style={{ ...labelStyle, marginTop: 6 }}>Banking (for commission payouts)</p>
              <Field label="Account Holder" value={app.bankAccountName} onChange={setA("bankAccountName")} />
              <div style={{ display: "flex", gap: 8 }}>
                <Field label="Bank" value={app.bankName} onChange={setA("bankName")} />
                <div style={{ flex: 1 }}>
                  <label className={labelCls} style={labelStyle}>Account Type</label>
                  <select value={app.bankAccountType} onChange={(e) => setA("bankAccountType")(e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>
                    <option value="">Select…</option>
                    <option>Cheque / Current</option>
                    <option>Savings</option>
                    <option>Transmission</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Field label="Account Number" value={app.bankAccountNumber} onChange={setA("bankAccountNumber")} />
                <Field label="Branch Code" value={app.bankBranchCode} onChange={setA("bankBranchCode")} />
              </div>

              <Field label="The Rep Code of the rep (Team Leader) who recruited you" value={app.uplineRepCode} onChange={setA("uplineRepCode")} placeholder="e.g. Rep00000001" />

              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#bcd", cursor: "pointer" }}>
                <input type="checkbox" checked={app.popiaConsent} onChange={(e) => setA("popiaConsent")(e.target.checked)} style={{ accentColor: LUMO, marginTop: 2 }} />
                I consent to Around You processing my personal information in line with POPIA for onboarding, commission and payout purposes.
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#bcd", cursor: "pointer" }}>
                <input type="checkbox" checked={app.agreementConsent} onChange={(e) => setA("agreementConsent")(e.target.checked)} style={{ accentColor: LUMO, marginTop: 2 }} />
                I confirm I am applying as an independent, self-employed commission-only agent (not an employee) and the information above is true.
              </label>

              <Field label="Signature (type your full name)" value={app.signatureName} onChange={setA("signatureName")} />

              <button type="submit" disabled={submitting}
                style={{ background: submitting ? "#1a3a0a" : `linear-gradient(135deg, ${LUMO}, ${LUMO_DARK})`, color: "#000", border: "none", borderRadius: 10, padding: "14px 0", width: "100%", fontWeight: 700, fontSize: "1rem", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.5 : 1, minHeight: 48, marginTop: 4 }}>
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
            </form>
          )}

          <div className="pt-2 text-center">
            <button type="button" onClick={() => navigate("/portal")} className="text-sm transition-colors hover:underline underline-offset-4" style={{ color: "#444" }}>
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5" style={{ flex: 1 }}>
      <label className={labelCls} style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} className="transition-all focus:border-[#39FF14] placeholder-gray-600" />
    </div>
  );
}
