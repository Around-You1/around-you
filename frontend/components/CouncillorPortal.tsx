"use client";

import { useState } from "react";
import backend from "~backend/client";
import AppLogo from "../components/AppLogo";

// Public ward-councillor portal (served at /councillor).
//
//  1. Register   — Full Name, ID Number, optional Municipality staff number and
//                  the postal codes they cover. This lands in the SuperAdmin
//                  pending queue; it only goes live once a SuperAdmin approves it
//                  and issues an Access Code.
//  2. Post an alert — a councillor pastes their Access Code, which confirms the
//                  wards assigned to them, and posts an alert that reaches every
//                  Local and Accommodation in those postal codes.

const LUMO = "#39FF14";

function parseCodes(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of raw.split(/[^0-9A-Za-z]+/)) {
    const t = c.trim();
    if (t && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
}

export default function CouncillorPortal() {
  const [tab, setTab] = useState<"register" | "post">("register");

  // --- registration ---
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [staffNumber, setStaffNumber] = useState("");
  const [ward, setWard] = useState("");
  const [codesRaw, setCodesRaw] = useState("");
  const [regBusy, setRegBusy] = useState(false);
  const [regDone, setRegDone] = useState(false);
  const [regErr, setRegErr] = useState("");

  async function submitRegister() {
    setRegErr("");
    const name = fullName.trim();
    const codes = parseCodes(codesRaw);
    if (!name) { setRegErr("Please enter your full name."); return; }
    if (!ward.trim()) { setRegErr("Please enter your ward number."); return; }
    if (!codes.length) { setRegErr("Please enter at least one ward postal code."); return; }
    setRegBusy(true);
    try {
      await backend.councillor.register({ fullName: name, idNumber: idNumber.trim(), staffNumber: staffNumber.trim(), ward: ward.trim(), postalCodes: codes });
      setRegDone(true);
    } catch (e: any) {
      setRegErr(e?.message || "Could not submit your registration. Please try again.");
    } finally {
      setRegBusy(false);
    }
  }

  // --- access-code sign in + post ---
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState<{ fullName: string; ward: string; postalCodes: string[] } | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeErr, setCodeErr] = useState("");

  async function confirmCode() {
    setCodeErr("");
    const c = code.trim();
    if (!c) { setCodeErr("Please enter your access code."); return; }
    setCodeBusy(true);
    try {
      const me: any = await backend.councillor.me({ accessCode: c });
      setConfirmed({ fullName: me.fullName, ward: me.ward || "", postalCodes: me.postalCodes || [] });
    } catch (e: any) {
      setCodeErr(e?.message || "That access code was not recognised or is not active yet.");
    } finally {
      setCodeBusy(false);
    }
  }

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [postBusy, setPostBusy] = useState(false);
  const [postMsg, setPostMsg] = useState("");
  const [postErr, setPostErr] = useState("");

  async function sendAlert() {
    setPostErr(""); setPostMsg("");
    if (!title.trim()) { setPostErr("Please enter a title for the alert."); return; }
    setPostBusy(true);
    try {
      let finalBody = body.trim();
      let endsIso = "";
      if (endsAt) {
        const dt = new Date(endsAt);
        endsIso = dt.toISOString();
        const human = dt.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
        finalBody = (finalBody ? finalBody + "\n\n" : "") + `Expected completion: ${human}`;
      }
      const res: any = await backend.councillor.alert({ accessCode: code.trim(), title: title.trim(), body: finalBody, endsAt: endsIso });
      const n = res?.sent ?? 0;
      setPostMsg(`Alert posted. It's now being delivered to ${n} device${n === 1 ? "" : "s"} in your wards, and already shows in their app inbox.`);
      setTitle(""); setBody(""); setEndsAt("");
    } catch (e: any) {
      setPostErr(e?.message || "Could not send the alert. Please try again.");
    } finally {
      setPostBusy(false);
    }
  }

  const tabBtn = (key: "register" | "post", label: string): React.CSSProperties => ({
    flex: 1, padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14,
    border: `1px solid ${tab === key ? LUMO : "rgba(57,255,20,0.25)"}`,
    background: tab === key ? "rgba(57,255,20,0.12)" : "transparent",
    color: tab === key ? LUMO : "#9aa39a",
  });

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><AppLogo /></div>
        <h1 style={{ color: LUMO, fontSize: 22, textAlign: "center", margin: "0 0 2px" }}>Ward Councillor Portal</h1>
        <p style={{ color: "#a0a0a0", fontSize: 13, textAlign: "center", marginTop: 0 }}>
          Post local alerts to residents and accommodations in your wards.
        </p>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => setTab("register")} style={tabBtn("register", "Register")}>Register</button>
          <button onClick={() => setTab("post")} style={tabBtn("post", "Post an alert")}>Post an alert</button>
        </div>

        {tab === "register" && (
          regDone ? (
            <div style={{ textAlign: "center", marginTop: 22 }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <h2 style={{ color: LUMO, margin: "8px 0" }}>Registration received</h2>
              <p style={{ color: "#a0a0a0", fontSize: 14 }}>
                A Super Admin will review your details. Once approved, you’ll be issued an Access Code —
                come back to the “Post an alert” tab and enter it to start posting.
              </p>
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              <div style={{ marginTop: 4 }}>
                <label style={labelSt}>Full name *</label>
                <input style={input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={labelSt}>ID number</label>
                <input style={input} inputMode="numeric" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={labelSt}>Municipality staff number <span style={{ color: "#8a8f96", fontWeight: 400 }}>(optional)</span></label>
                <input style={input} value={staffNumber} onChange={(e) => setStaffNumber(e.target.value)} />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={labelSt}>Ward number *</label>
                <input style={input} inputMode="numeric" placeholder="e.g. 3" value={ward} onChange={(e) => setWard(e.target.value)} />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={labelSt}>Ward Postal Codes *</label>
                <input style={input} inputMode="numeric" placeholder="e.g. 7395, 7390, 7380" value={codesRaw} onChange={(e) => setCodesRaw(e.target.value)} />
                <p style={{ color: "#7f857f", fontSize: 11, marginTop: 4 }}>Separate multiple postal codes with a comma or a space.</p>
                {parseCodes(codesRaw).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {parseCodes(codesRaw).map((c) => (
                      <span key={c} style={{ fontSize: 12, fontWeight: 700, color: LUMO, border: `1px solid rgba(57,255,20,0.3)`, borderRadius: 999, padding: "3px 10px" }}>{c}</span>
                    ))}
                  </div>
                )}
              </div>
              {regErr && <p style={{ color: "#f0a0a0", fontSize: 13, marginTop: 12 }}>{regErr}</p>}
              <button disabled={regBusy} onClick={submitRegister}
                style={{ ...primaryBtn, marginTop: 18, opacity: regBusy ? 0.6 : 1 }}>
                {regBusy ? "Submitting…" : "Submit registration"}
              </button>
              <p style={{ color: "#7f857f", fontSize: 11, marginTop: 10, textAlign: "center" }}>
                Your registration must be approved by a Super Admin before it goes live.
              </p>
            </div>
          )
        )}

        {tab === "post" && (
          !confirmed ? (
            <div style={{ marginTop: 18 }}>
              <label style={labelSt}>Access code</label>
              <input style={{ ...input, letterSpacing: "0.08em", fontWeight: 700 }} placeholder="WC-XXXXXXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              {codeErr && <p style={{ color: "#f0a0a0", fontSize: 13, marginTop: 12 }}>{codeErr}</p>}
              <button disabled={codeBusy} onClick={confirmCode} style={{ ...primaryBtn, marginTop: 16, opacity: codeBusy ? 0.6 : 1 }}>
                {codeBusy ? "Checking…" : "Continue"}
              </button>
              <p style={{ color: "#7f857f", fontSize: 11, marginTop: 10, textAlign: "center" }}>
                Not registered yet? Use the “Register” tab — a Super Admin will issue your code once approved.
              </p>
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              <div style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid rgba(57,255,20,0.25)`, background: "rgba(57,255,20,0.06)", marginBottom: 14 }}>
                <div style={{ color: LUMO, fontWeight: 800, fontSize: 14 }}>{confirmed.fullName}{confirmed.ward ? ` — Ward ${confirmed.ward}` : ""}</div>
                <div style={{ color: "#9aa39a", fontSize: 12, marginTop: 2 }}>
                  Posting to postal codes: {confirmed.postalCodes.length ? confirmed.postalCodes.join(", ") : "—"}
                </div>
              </div>
              <div>
                <label style={labelSt}>Heading *</label>
                <input style={input} placeholder="e.g. Alert: Electricity Interruption" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={labelSt}>Message</label>
                <textarea style={{ ...input, minHeight: 120, resize: "vertical" }} placeholder="e.g. ESKOM will be switching off the electricity supply at the Saint Helena Views 2 transformer to do repair work. Expect an interruption to your electricity supply." value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={labelSt}>Expected completion <span style={{ color: "#8a8f96", fontWeight: 400 }}>(optional — date &amp; time the interruption should be over)</span></label>
                <input style={input} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
              {postErr && <p style={{ color: "#f0a0a0", fontSize: 13, marginTop: 12 }}>{postErr}</p>}
              {postMsg && <p style={{ color: LUMO, fontSize: 13, marginTop: 12 }}>{postMsg}</p>}
              <button disabled={postBusy} onClick={sendAlert} style={{ ...primaryBtn, marginTop: 18, opacity: postBusy ? 0.6 : 1 }}>
                {postBusy ? "Sending…" : "Send alert"}
              </button>
              <button onClick={() => { setConfirmed(null); setCode(""); setPostMsg(""); setPostErr(""); }}
                style={{ background: "transparent", border: "none", color: "#9aa39a", fontSize: 12, cursor: "pointer", padding: 0, marginTop: 14, display: "block", marginLeft: "auto", marginRight: "auto" }}>
                Sign out
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#0a0a0a", padding: "24px 12px" };
const card: React.CSSProperties = { maxWidth: 560, margin: "0 auto", background: "#111111", color: "#d5d8d5", borderRadius: 14, padding: "24px 22px", border: "1px solid rgba(57,255,20,0.18)", boxShadow: "0 0 40px rgba(57,255,20,0.06)" };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid rgba(57,255,20,0.25)", background: "rgba(255,255,255,0.04)", color: "#fff", borderRadius: 8, fontSize: 16, marginTop: 4, boxSizing: "border-box" };
const labelSt: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#cfd3cf" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "12px", borderRadius: 10, border: "none", background: LUMO, color: "#001b00", fontWeight: 800, fontSize: 15, cursor: "pointer" };
