"use client";

// Printable BLANK onboarding form, rendered live from the shared schema
// (lib/onboardingSchema.ts). Because it reads the same field definitions the
// app uses, the printed form can never fall out of date. The rep taps a button
// on the Rep Academy page, this opens, and the browser's Save-as-PDF dialog
// appears automatically.

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { getCategorySchema, type Field, type Section } from "@/lib/onboardingSchema";

const GREEN = "#0FB89B";

// Printed-form pricing (blank onboarding forms only — does not affect the online form).
const ACCOMMODATION_PRICE = "R400 per month";
const SHOWN_TO_PRICE: Record<string, string> = {
  "Guest Only": "R300 per month",
  "Local": "R300 per month",
  "Both": "R400 per month",
};

function WriteLine() {
  return <div style={{ borderBottom: "1px solid #999", height: 22, marginTop: 2 }} />;
}

function WriteBox({ lines = 3 }: { lines?: number }) {
  return <div style={{ border: "1px solid #999", borderRadius: 4, minHeight: lines * 20 + 8, marginTop: 2 }} />;
}

function Tick({ round = false }: { round?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block", width: 12, height: 12, border: "1.5px solid #333",
        borderRadius: round ? "50%" : 2, marginRight: 6, flexShrink: 0,
      }}
    />
  );
}

function OptionList({ options, round }: { options: string[]; round?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", marginTop: 4 }}>
      {options.map((o) => (
        <span key={o} style={{ display: "inline-flex", alignItems: "center", fontSize: 12, width: "45%", minWidth: 150 }}>
          <Tick round={round} />
          {o}
        </span>
      ))}
    </div>
  );
}

function FieldView({ field }: { field: Field }) {
  const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "#222" };
  const noteStyle: React.CSSProperties = { fontSize: 10.5, color: "#666", fontStyle: "italic", margin: "1px 0 0" };

  // Billing tier removed from the printed form.
  if (field.label === "Plan") return null;

  // "Shown to" shows each audience with its monthly price beneath it.
  if (field.label === "Shown to") {
    return (
      <div style={{ margin: "9px 0", breakInside: field.kind === "groups" ? "auto" : "avoid" }}>
        <div style={labelStyle}>{field.label}</div>
        <p style={noteStyle}>Tick one</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px", marginTop: 4 }}>
          {(field.options || []).map((o) => (
            <div key={o} style={{ width: "45%", minWidth: 150 }}>
              <span style={{ display: "inline-flex", alignItems: "center", fontSize: 12 }}>
                <Tick round />
                {o}
              </span>
              {SHOWN_TO_PRICE[o] && (
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#111", marginLeft: 18, marginTop: 1 }}>{SHOWN_TO_PRICE[o]}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (field.kind === "note") {
    return (
      <div style={{ margin: "8px 0" }}>
        <div style={{ fontSize: 11.5, color: "#444" }}>{field.label}</div>
        {field.note && <p style={noteStyle}>{field.note}</p>}
      </div>
    );
  }

  return (
    <div style={{ margin: "9px 0", breakInside: "avoid" }}>
      <div style={labelStyle}>{field.label}</div>
      {field.note && <p style={noteStyle}>{field.note}</p>}

      {field.kind === "text" && <WriteLine />}
      {field.kind === "long" && <WriteBox lines={field.lines} />}
      {field.kind === "choose-one" && field.options && (
        <>
          <p style={noteStyle}>Tick one</p>
          <OptionList options={field.options} round />
        </>
      )}
      {field.kind === "choose-many" && field.options && (
        <>
          <p style={noteStyle}>Tick all that apply</p>
          <OptionList options={field.options} />
        </>
      )}
      {field.kind === "yesno" && (
        <div style={{ display: "flex", gap: 24, marginTop: 4, fontSize: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center" }}><Tick /> Yes</span>
          <span style={{ display: "inline-flex", alignItems: "center" }}><Tick /> No</span>
        </div>
      )}
      {field.kind === "groups" && field.groups && (
        <div style={{ marginTop: 4 }}>
          {field.groups.map((g) => (
            <div key={g.label} style={{ margin: "6px 0", breakInside: "avoid" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: GREEN }}>{g.label}</div>
              <OptionList options={g.options} />
            </div>
          ))}
        </div>
      )}
      {field.kind === "table" && field.columns && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4, fontSize: 11 }}>
          <thead>
            <tr>
              {field.columns.map((c) => (
                <th key={c} style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "left", background: "#f2f2f2", fontWeight: 700 }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: field.rows || 4 }).map((_, r) => (
              <tr key={r}>
                {field.columns!.map((c) => (
                  <td key={c} style={{ border: "1px solid #999", padding: "4px 6px", height: 22 }} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SectionView({ section }: { section: Section }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: "#111", borderBottom: `2px solid ${GREEN}`, paddingBottom: 3, margin: 0 }}>
        {section.title}
      </h2>
      {section.intro && <p style={{ fontSize: 11, color: "#666", margin: "3px 0 0" }}>{section.intro}</p>}
      {section.fields.map((f, i) => (
        <FieldView key={i} field={f} />
      ))}
    </section>
  );
}

export default function OnboardingPrintPage() {
  const params = useParams<{ type: string }>();
  const type = Array.isArray(params.type) ? params.type[0] : params.type;
  const schema = getCategorySchema(type || "");

  useEffect(() => {
    if (!schema) return;
    document.title = `Around You — ${schema.title} onboarding form`;
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        /* ignore */
      }
    }, 700);
    return () => clearTimeout(t);
  }, [schema]);

  if (!schema) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
        <p>Unknown form type.</p>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", color: "#111", minHeight: "100vh", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 14mm; }
          html, body { background: #fff !important; }
        }
      `}</style>

      <div className="no-print" style={{ position: "sticky", top: 0, background: "#111", color: "#fff", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 13 }}>Blank onboarding form — use the Save-as-PDF dialog, or the button.</span>
        <button
          onClick={() => window.print()}
          style={{ background: GREEN, color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 800, cursor: "pointer" }}
        >
          Save as PDF
        </button>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 28px 48px", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "2px solid #111", paddingBottom: 8 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: GREEN }}>Around You</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {schema.title} — Onboarding Form{schema.key === "accommodation" ? ` — ${ACCOMMODATION_PRICE}` : ""}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#555", minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 8 }}>
              <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>Rep Code:</span>
              <span style={{ flex: 1, borderBottom: "1px solid #999", height: 16 }} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
              <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>Date:</span>
              <span style={{ flex: 1, borderBottom: "1px solid #999", height: 16 }} />
            </div>
          </div>
        </div>

        {schema.sections.map((s, i) => (
          <SectionView key={i} section={s} />
        ))}

        <p style={{ marginTop: 24, fontSize: 10, color: "#888", textAlign: "center" }}>
          Around You · aroundyou.co.za — this blank form is generated from the live app fields, so it is always the latest version.
        </p>
      </div>
    </div>
  );
}
