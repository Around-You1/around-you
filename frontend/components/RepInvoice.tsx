"use client";

import { useState, useRef } from "react";

// RepInvoice is the invoice a rep issues TO Around You for their monthly
// commission. It renders the same layout as an Around You partner invoice, but
// pre-filled for the rep: their details, a persisted logo, a sequential number,
// and the prior-month billing period. Money in Rands (rep enters the amount).
//
// Persistence is per-device via localStorage keyed by rep code:
//   rep_invoice_logo_<repCode>  — the uploaded logo (data URL), reused on every invoice
//   rep_invoice_seq_<repCode>   — the last-used sequential number
interface RepInvoiceProps {
  repName: string;
  repCode: string;
  repEmail: string;
  onBack: () => void;
}

const MON_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const MON_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function fmtDate(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${MON_ABBR[d.getMonth()]}/${d.getFullYear()}`;
}
function money(n: number) {
  return `R${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

export default function RepInvoice({ repName, repCode, repEmail, onBack }: RepInvoiceProps) {
  const logoKey = `rep_invoice_logo_${repCode}`;
  const seqKey = `rep_invoice_seq_${repCode}`;

  // Rep number = the digits of the rep code, padded to 8 (Rep00000001 → 00000001).
  const repDigits = (repCode.match(/\d+/g) || []).join("") || "0";
  const repNum = repDigits.padStart(8, "0").slice(-8);

  // Sequential invoice number — consumed once per opened invoice.
  const [invoiceNo] = useState(() => {
    let next = 1;
    try {
      const cur = parseInt(localStorage.getItem(seqKey) || "0", 10) || 0;
      next = cur + 1;
      localStorage.setItem(seqKey, String(next));
    } catch {
      /* localStorage unavailable — fall back to 1 */
    }
    return `AY-${repNum}-${String(next).padStart(6, "0")}`;
  });

  const [logo, setLogo] = useState<string>(() => {
    try {
      return localStorage.getItem(logoKey) || "";
    } catch {
      return "";
    }
  });
  const fileRef = useRef<HTMLInputElement | null>(null);

  const acceptLogo = (file?: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setLogo(url);
      try {
        localStorage.setItem(logoKey, url);
      } catch {
        /* ignore quota errors */
      }
    };
    reader.readAsDataURL(file);
  };

  // Dates: today, due +3 days (matches the 3-day terms on Around You invoices).
  const today = new Date();
  const due = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Billing period = the PRIOR calendar month (the rep invoices in the month
  // AFTER the one they were paid for).
  const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const itemCode = `Rep${MON_SHORT[prev.getMonth()]}${String(prev.getFullYear()).slice(2)}`; // e.g. RepAug26
  const itemDesc = `Rep ${MON_FULL[prev.getMonth()]} ${prev.getFullYear()}`; // e.g. Rep August 2026

  const [residentialAddress, setResidentialAddress] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankHolder, setBankHolder] = useState("");

  const amount = parseFloat(unitCost) || 0;

  const label: React.CSSProperties = { color: "#6b7280", fontSize: 13 };
  const cell: React.CSSProperties = { padding: "8px 6px" };
  const inputStyle: React.CSSProperties = {
    border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 8px", fontSize: 14, width: "100%", color: "#111", background: "#fff",
  };

  return (
    <div>
      {/* Print rules: only the invoice sheet prints, on white. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #rep-invoice-sheet, #rep-invoice-sheet * { visibility: visible !important; }
          #rep-invoice-sheet { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
          .rep-invoice-no-print { display: none !important; }
        }
      `}</style>

      <div className="rep-invoice-no-print" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "1px solid #1F1F1F", color: "#A6B0A6", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>
          ← Back
        </button>
        <button onClick={() => window.print()} style={{ marginLeft: "auto", background: "linear-gradient(135deg, #39FF14, #2ECC10)", color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Print / Save as PDF
        </button>
      </div>

      {/* The printable invoice sheet — white, like an Around You invoice. */}
      <div id="rep-invoice-sheet" style={{ background: "#fff", color: "#111", borderRadius: 12, padding: 24, fontFamily: "Arial, Helvetica, sans-serif", lineHeight: 1.4 }}>
        {/* Header: logo box + rep details + residential address */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); acceptLogo(e.dataTransfer.files?.[0]); }}
            title="Upload your logo — it will be reused on every invoice"
            style={{
              width: 140, height: 110, flexShrink: 0, border: logo ? "1px solid #e5e7eb" : "1px dashed #9ca3af",
              borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
              color: "#6b7280", fontSize: 12, cursor: "pointer", overflow: "hidden", background: "#fff", padding: 4,
            }}
          >
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Your logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : (
              <span>Drag and Drop<br />your Logo</span>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => acceptLogo(e.target.files?.[0])} />

          <div style={{ minWidth: 200, fontSize: 15 }}>
            <div><span style={label}>Full Name:</span> <b>{repName}</b></div>
            <div><span style={label}>Email address:</span> {repEmail}</div>
            <div><span style={label}>Rep Code:</span> {repCode}</div>
          </div>

          <div style={{ marginLeft: "auto", minWidth: 220, maxWidth: 260 }}>
            <div style={label}>Residential Address:</div>
            <textarea
              className="rep-invoice-editable"
              value={residentialAddress}
              onChange={(e) => setResidentialAddress(e.target.value)}
              rows={2}
              placeholder="Your residential address"
              style={{ ...inputStyle, resize: "vertical", marginTop: 4 }}
            />
          </div>
        </div>

        <p style={{ color: "#2563eb", fontWeight: 800, fontSize: 15, marginTop: 22, marginBottom: 6 }}>TAX INVOICE</p>
        <div style={{ borderTop: "1px solid #e5e7eb", marginBottom: 14 }} />

        {/* Meta + bill-to */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "space-between" }}>
          <table style={{ fontSize: 14 }}>
            <tbody>
              <tr><td style={{ ...cell, ...label }}>Invoice Number</td><td style={cell}>{invoiceNo}</td></tr>
              <tr><td style={{ ...cell, ...label }}>Invoice Date</td><td style={cell}>{fmtDate(today)}</td></tr>
              <tr><td style={{ ...cell, ...label }}>Due Date</td><td style={cell}>{fmtDate(due)}</td></tr>
              <tr><td style={{ ...cell, ...label }}>Invoice Total</td><td style={cell}>{money(amount)}</td></tr>
              <tr><td style={{ ...cell, ...label }}>Balance Due</td><td style={cell}>{money(amount)}</td></tr>
            </tbody>
          </table>

          <div style={{ fontSize: 14 }}>
            <div style={{ fontWeight: 700 }}>Around You (Pty) Ltd</div>
            <div>Accounts</div>
            <div>accounts@aroundyou.co.za</div>
          </div>
        </div>

        {/* Line items */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 22, fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #d1d5db", textAlign: "left" }}>
              <th style={cell}>Item</th>
              <th style={cell}>Description</th>
              <th style={{ ...cell, textAlign: "right" }}>Unit Cost</th>
              <th style={{ ...cell, textAlign: "right" }}>Quantity</th>
              <th style={{ ...cell, textAlign: "right" }}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ ...cell, color: "#2563eb" }}>{itemCode}</td>
              <td style={cell}>{itemDesc}</td>
              <td style={{ ...cell, textAlign: "right" }}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="0.00"
                  style={{ ...inputStyle, width: 110, textAlign: "right" }}
                />
              </td>
              <td style={{ ...cell, textAlign: "right" }}>1</td>
              <td style={{ ...cell, textAlign: "right" }}>{money(amount)}</td>
            </tr>
          </tbody>
        </table>

        {/* Banking (rep's) + totals */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "space-between", marginTop: 26 }}>
          <div style={{ fontSize: 14, minWidth: 240 }}>
            <div style={{ ...label, marginBottom: 4 }}>Your banking details (for payment)</div>
            <div style={{ display: "grid", gap: 6, maxWidth: 260 }}>
              <input value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} placeholder="Account Holder" style={inputStyle} />
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank" style={inputStyle} />
              <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="Account Number" style={inputStyle} />
              <input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} placeholder="Branch Code" style={inputStyle} />
            </div>
          </div>

          <table style={{ fontSize: 14 }}>
            <tbody>
              <tr><td style={{ ...cell, ...label }}>Net</td><td style={{ ...cell, textAlign: "right", minWidth: 120 }}>{money(amount)}</td></tr>
              <tr><td style={{ ...cell, ...label }}>Subtotal</td><td style={{ ...cell, textAlign: "right" }}>{money(amount)}</td></tr>
              <tr><td style={{ ...cell, ...label }}>Total</td><td style={{ ...cell, textAlign: "right" }}>{money(amount)}</td></tr>
              <tr><td style={{ ...cell, ...label }}>Balance Due</td><td style={{ ...cell, textAlign: "right", fontWeight: 700 }}>{money(amount)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="rep-invoice-no-print" style={{ color: "#A6B0A6", fontSize: 11, marginTop: 12 }}>
        Enter the exact amount you were paid, upload your logo (kept for future invoices), then Print / Save as PDF and email it to accounts@aroundyou.co.za.
      </p>
    </div>
  );
}
