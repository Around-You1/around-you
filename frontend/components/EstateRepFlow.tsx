"use client";

import React, { useRef, useState } from "react";
import { getAuthenticatedBackend } from "../lib/backend";

// Real Estate onboarding for the Rep app — styled to match the black/green
// tap screen (mirrors the palette/primitives in RepOnboardingApp.tsx).

const colors = {
  background: "#000000", surface: "#0A0A0A", surface2: "#121212",
  primary: "#39FF14", accent: "#00FFD1", textPrimary: "#E6F7E6",
  textSecondary: "#A6B0A6", border: "#1F1F1F", error: "#FF4D4F",
};
const inputStyle: React.CSSProperties = {
  width: "100%", background: colors.surface2, border: `1px solid ${colors.border}`,
  color: colors.textPrimary, borderRadius: 10, padding: "12px 14px", fontSize: 15, marginBottom: 4,
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: colors.textSecondary, marginBottom: 4, display: "block" };

const PROPERTY_TYPES = ["House", "Apartment", "Townhouse", "Plot", "Farm", "Commercial", "Land", "Industrial"];
const FEATURES = ["Pool", "Tennis Court", "Garden", "Security Estate", "Double Garage", "Borehole", "Solar", "Fibre", "Sea View", "Mountain View", "Pet Friendly", "Fireplace", "Staff Quarters", "Backup Power"];
const SA_PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];

type Preview = { url: string; file: File; name: string };

interface PropertyRow {
  title: string; propertyType: string; listingType: string; priceRand: string;
  plotSizeM2: string; houseSizeM2: string; bedrooms: string; bathrooms: string; garages: string;
  features: string[]; address: string; province: string; postalCode: string; description: string;
  images: Preview[]; agentRef: number;
}
interface AgentRow {
  name: string; contactNumber: string; email: string; bio: string; officialRepCode: string; photo: Preview[];
}

const newProperty = (): PropertyRow => ({
  title: "", propertyType: "House", listingType: "sale", priceRand: "", plotSizeM2: "", houseSizeM2: "",
  bedrooms: "", bathrooms: "", garages: "", features: [], address: "", province: "", postalCode: "",
  description: "", images: [], agentRef: -1,
});
const newAgent = (): AgentRow => ({ name: "", contactNumber: "", email: "", bio: "", officialRepCode: "", photo: [] });

const fileToDataURL = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

async function uploadPreviews(previews: Preview[]): Promise<string[]> {
  if (previews.length === 0) return [];
  const backend = getAuthenticatedBackend();
  const results = await Promise.allSettled(
    previews.map(async (p) => {
      const dataUrl = await fileToDataURL(p.file);
      const res: any = await backend.storage.upload({ data: dataUrl });
      return res.url as string;
    })
  );
  return results.filter((r) => r.status === "fulfilled").map((r: any) => r.value);
}

// ---- primitives ----
function Section({ children }: { children: React.ReactNode }) {
  return <h3 style={{ color: colors.primary, fontSize: 15, margin: "18px 0 8px" }}>{children}</h3>;
}
function Field({ label, value, onChange, area, type }: { label: string; value: string; onChange: (v: string) => void; area?: boolean; type?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
      ) : (
        <input value={value} type={type} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      )}
    </div>
  );
}
function Dropdown({ label, value, options, onChange }: { label: string; value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        {options.map((o) => <option key={o.v} value={o.v} style={{ background: colors.surface2 }}>{o.l}</option>)}
      </select>
    </div>
  );
}
function Btn({ children, onClick, kind = "outline", disabled }: { children: React.ReactNode; onClick: () => void; kind?: "solid" | "outline" | "ghost"; disabled?: boolean }) {
  const base: React.CSSProperties = { borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 };
  const styles = {
    solid: { ...base, background: colors.primary, color: "#000", border: "none" },
    outline: { ...base, background: "transparent", border: `1px solid ${colors.primary}`, color: colors.primary },
    ghost: { ...base, background: "transparent", border: `1px solid ${colors.border}`, color: colors.textSecondary },
  } as const;
  return <button type="button" disabled={disabled} onClick={onClick} style={styles[kind]}>{children}</button>;
}
function Pills({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (o: string) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button key={o} type="button" onClick={() => onToggle(o)}
              style={{ fontSize: 12, borderRadius: 20, padding: "7px 12px", cursor: "pointer",
                color: on ? colors.primary : colors.textSecondary, background: on ? colors.surface2 : "transparent",
                border: `1px solid ${on ? colors.primary : colors.border}` }}>
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function ImgUpload({ label, images, onChange, max = 10 }: { label: string; images: Preview[]; onChange: (next: Preview[]) => void; max?: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const add = (fl: FileList) => {
    const accepted = Array.from(fl).slice(0, max - images.length)
      .filter((f) => ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(f.type))
      .map((f) => ({ url: URL.createObjectURL(f), file: f, name: f.name }));
    onChange([...images, ...accepted].slice(0, max));
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label} ({images.length}/{max})</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button type="button" onClick={() => camRef.current?.click()} style={{ flex: 1, background: colors.surface2, border: `1px solid ${colors.primary}`, color: colors.primary, borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>📷 Camera</button>
        <button type="button" onClick={() => fileRef.current?.click()} style={{ flex: 1, background: colors.surface2, border: `1px solid ${colors.primary}`, color: colors.primary, borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🖼 Gallery</button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => e.target.files && add(e.target.files)} />
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => e.target.files && add(e.target.files)} />
      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: "relative", width: 60, height: 60 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.name} style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: `1px solid ${colors.border}` }} />
              <button type="button" onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                style={{ position: "absolute", top: -6, right: -6, background: colors.error, color: "#000", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 11, cursor: "pointer", lineHeight: "18px" }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));

export default function EstateRepFlow({ repCode, repName, onDone }: { repCode: string; repName: string; onDone: () => void }) {
  const [agency, setAgency] = useState({
    name: "", description: "", address: "", province: "", country: "South Africa", postalCode: "",
    contactNumber: "", email: "", latitude: "", longitude: "", createAgentPages: false,
  });
  const [agencyImages, setAgencyImages] = useState<Preview[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(false);

  const setA = (patch: Partial<typeof agency>) => setAgency((a) => ({ ...a, ...patch }));
  const setProp = (i: number, patch: Partial<PropertyRow>) => setProperties((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const setAg = (i: number, patch: Partial<AgentRow>) => setAgents((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const activeAgents = agents.length;
  const monthly = 300 * (1 + activeAgents);

  const submit = async () => {
    if (!agency.name.trim()) { alert("Agency name is required."); return; }
    setSubmitting(true);
    try {
      const backend = getAuthenticatedBackend();
      setStatus("Uploading agency images…");
      const agencyUrls = await uploadPreviews(agencyImages);
      setStatus("Creating agency…");
      const savedAgency: any = await backend.estate.createAgency({
        name: agency.name, description: agency.description, address: agency.address, province: agency.province,
        country: agency.country, postalCode: agency.postalCode, contactNumber: agency.contactNumber, email: agency.email,
        latitude: num(agency.latitude), longitude: num(agency.longitude),
        imageUrl: agencyUrls[0] || "", imageUrls: agencyUrls, createAgentPages: agency.createAgentPages,
        officialRepCode: repCode, officialRepName: repName, isActive: true,
      });
      const agencyId = savedAgency.id;

      const agentIdByIndex: (number | null)[] = [];
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        setStatus(`Creating agent ${i + 1}/${agents.length}…`);
        const photoUrls = await uploadPreviews(a.photo);
        const saved: any = await backend.estate.createAgent({
          agencyId, name: a.name, photoUrl: photoUrls[0] || "", contactNumber: a.contactNumber, email: a.email,
          bio: a.bio, officialRepCode: a.officialRepCode || repCode, officialRepName: repName, isActive: true,
        });
        agentIdByIndex[i] = saved.id;
      }

      for (let i = 0; i < properties.length; i++) {
        const p = properties[i];
        setStatus(`Uploading property ${i + 1} images…`);
        const urls = await uploadPreviews(p.images);
        await backend.estate.createProperty({
          agencyId, agentId: p.agentRef >= 0 ? agentIdByIndex[p.agentRef] : null,
          title: p.title, propertyType: p.propertyType, plotSizeM2: num(p.plotSizeM2), houseSizeM2: num(p.houseSizeM2),
          bedrooms: num(p.bedrooms), bathrooms: num(p.bathrooms), garages: num(p.garages), features: p.features,
          priceCents: p.priceRand.trim() ? Math.round(Number(p.priceRand) * 100) : 0, listingType: p.listingType,
          address: p.address, province: p.province, country: "South Africa", postalCode: p.postalCode,
          description: p.description, imageUrl: urls[0] || "", imageUrls: urls, isActive: true,
        });
      }
      setDone(true);
    } catch (e: any) {
      alert(e?.message || "Failed to save. Please try again.");
    } finally {
      setSubmitting(false);
      setStatus("");
    }
  };

  if (done) {
    return (
      <div style={{ background: colors.surface, border: `1px solid ${colors.primary}`, borderRadius: 16, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
        <p style={{ color: colors.textPrimary, fontSize: 15 }}>
          <b>{agency.name}</b> created with {properties.length} propert{properties.length === 1 ? "y" : "ies"}
          {agents.length > 0 ? ` and ${agents.length} agent${agents.length === 1 ? "" : "s"}` : ""}. Billing: <b>R{monthly}/mo</b>.
        </p>
        <div style={{ marginTop: 16 }}><Btn kind="solid" onClick={onDone}>Onboard Another Partner</Btn></div>
      </div>
    );
  }

  return (
    <div>
      <Section>Estate Agency</Section>
      <Field label="Agency Name *" value={agency.name} onChange={(v) => setA({ name: v })} />
      <Field label="Description" area value={agency.description} onChange={(v) => setA({ description: v })} />
      <Field label="Address" value={agency.address} onChange={(v) => setA({ address: v })} />
      <Dropdown label="Province" value={agency.province} options={[{ v: "", l: "Select province" }, ...SA_PROVINCES.map((p) => ({ v: p, l: p }))]} onChange={(v) => setA({ province: v })} />
      <Field label="Postal Code" value={agency.postalCode} onChange={(v) => setA({ postalCode: v })} />
      <Field label="Contact Number" value={agency.contactNumber} onChange={(v) => setA({ contactNumber: v })} />
      <Field label="Email" value={agency.email} onChange={(v) => setA({ email: v })} />
      <Field label="Latitude" type="number" value={agency.latitude} onChange={(v) => setA({ latitude: v })} />
      <Field label="Longitude" type="number" value={agency.longitude} onChange={(v) => setA({ longitude: v })} />
      <ImgUpload label="Agency Images" images={agencyImages} onChange={setAgencyImages} max={10} />

      <Section>Properties ({properties.length})</Section>
      {properties.map((p, i) => (
        <div key={i} style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 700 }}>Property {i + 1}</span>
            <Btn kind="ghost" onClick={() => setProperties((prev) => prev.filter((_, idx) => idx !== i))}>Remove</Btn>
          </div>
          <Field label="Title *" value={p.title} onChange={(v) => setProp(i, { title: v })} />
          <Dropdown label="Type" value={p.propertyType} options={PROPERTY_TYPES.map((t) => ({ v: t, l: t }))} onChange={(v) => setProp(i, { propertyType: v })} />
          <Dropdown label="For Sale / Rent" value={p.listingType} options={[{ v: "sale", l: "For Sale" }, { v: "rent", l: "For Rent" }]} onChange={(v) => setProp(i, { listingType: v })} />
          <Field label="Price (R)" type="number" value={p.priceRand} onChange={(v) => setProp(i, { priceRand: v })} />
          <Field label="Plot Size (m²)" type="number" value={p.plotSizeM2} onChange={(v) => setProp(i, { plotSizeM2: v })} />
          <Field label="House Size (m²)" type="number" value={p.houseSizeM2} onChange={(v) => setProp(i, { houseSizeM2: v })} />
          <Field label="Bedrooms" type="number" value={p.bedrooms} onChange={(v) => setProp(i, { bedrooms: v })} />
          <Field label="Bathrooms" type="number" value={p.bathrooms} onChange={(v) => setProp(i, { bathrooms: v })} />
          <Field label="Garages" type="number" value={p.garages} onChange={(v) => setProp(i, { garages: v })} />
          <Pills label="Features" options={FEATURES} selected={p.features} onToggle={(f) => setProp(i, { features: p.features.includes(f) ? p.features.filter((x) => x !== f) : [...p.features, f] })} />
          <Field label="Address" value={p.address} onChange={(v) => setProp(i, { address: v })} />
          <Dropdown label="Province" value={p.province} options={[{ v: "", l: "Select province" }, ...SA_PROVINCES.map((x) => ({ v: x, l: x }))]} onChange={(v) => setProp(i, { province: v })} />
          <Field label="Postal Code" value={p.postalCode} onChange={(v) => setProp(i, { postalCode: v })} />
          {agency.createAgentPages && agents.length > 0 && (
            <Dropdown label="Assign to Agent" value={String(p.agentRef)}
              options={[{ v: "-1", l: "Unassigned" }, ...agents.map((a, ai) => ({ v: String(ai), l: a.name || `Agent ${ai + 1}` }))]}
              onChange={(v) => setProp(i, { agentRef: Number(v) })} />
          )}
          <Field label="Description" area value={p.description} onChange={(v) => setProp(i, { description: v })} />
          <ImgUpload label="Property Images" images={p.images} onChange={(next) => setProp(i, { images: next })} max={10} />
        </div>
      ))}
      <Btn onClick={() => setProperties((p) => [...p, newProperty()])}>+ Add Property</Btn>

      <div style={{ margin: "18px 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={agency.createAgentPages} onChange={(e) => setA({ createAgentPages: e.target.checked })} style={{ accentColor: colors.primary, width: 18, height: 18 }} />
        <span style={{ color: colors.textPrimary, fontSize: 14 }}>Create individual Estate Agent pages (R300 each)</span>
      </div>

      {agency.createAgentPages && (
        <>
          <Section>Estate Agents ({agents.length})</Section>
          {agents.map((a, i) => (
            <div key={i} style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 700 }}>Agent {i + 1}</span>
                <Btn kind="ghost" onClick={() => {
                  setProperties((prev) => prev.map((p) => (p.agentRef === i ? { ...p, agentRef: -1 } : (p.agentRef > i ? { ...p, agentRef: p.agentRef - 1 } : p))));
                  setAgents((prev) => prev.filter((_, idx) => idx !== i));
                }}>Remove</Btn>
              </div>
              <Field label="Agent Name *" value={a.name} onChange={(v) => setAg(i, { name: v })} />
              <Field label="Contact Number" value={a.contactNumber} onChange={(v) => setAg(i, { contactNumber: v })} />
              <Field label="Email" value={a.email} onChange={(v) => setAg(i, { email: v })} />
              <Field label="Rep Code (billing, optional)" value={a.officialRepCode} onChange={(v) => setAg(i, { officialRepCode: v })} />
              <Field label="Bio" area value={a.bio} onChange={(v) => setAg(i, { bio: v })} />
              <ImgUpload label="Agent Photo" images={a.photo} onChange={(next) => setAg(i, { photo: next })} max={1} />
            </div>
          ))}
          <Btn onClick={() => setAgents((a) => [...a, newAgent()])}>+ Add Agent</Btn>
        </>
      )}

      <div style={{ margin: "18px 0", background: colors.surface2, border: `1px solid ${colors.accent}`, borderRadius: 10, padding: 12, color: colors.textPrimary, fontSize: 13 }}>
        <b>Billing:</b> R300 agency{activeAgents > 0 ? ` + R300 × ${activeAgents} agent${activeAgents === 1 ? "" : "s"}` : ""} = <b>R{monthly}/month</b>
      </div>

      {status && <p style={{ color: colors.accent, fontSize: 12, marginBottom: 8 }}>{status}</p>}
      <button type="button" disabled={submitting} onClick={submit}
        style={{ width: "100%", background: colors.primary, color: "#000", border: "none", borderRadius: 10, padding: 14, fontWeight: 800, fontSize: 15, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1 }}>
        {submitting ? "Saving…" : "Submit Estate Agency"}
      </button>
    </div>
  );
}
