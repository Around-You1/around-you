"use client";

import { useEffect, useMemo, useState } from "react";
import backend from "~backend/client";
import { BOOKINGS_ENABLED } from "../lib/features";
import AppLogo from "../components/AppLogo";

const LUMO = "#39FF14";

// Public self-service partner application. A rep shares a link like
//   /apply?type=restaurant&rep=Rep00000002
// The prospective partner fills this in; it submits straight into Around You
// (stored as Pending + emailed to Accounts and the referring rep). Onboarding
// itself stays an internal step.

const CATEGORIES: { key: string; label: string }[] = [
  { key: "accommodation", label: "Accommodation/Caravan Parks" },
  { key: "restaurant", label: "Restaurant/Takeaway" },
  { key: "service", label: "Business/Service" },
  { key: "attraction", label: "Attraction/Activity" },
  { key: "estate", label: "Real Estate & Rentals" },
  { key: "retail", label: "Retail" },
  { key: "nonprofit", label: "NPO / PBO" },
];

// Per-category pricing shown prominently near the top of each application.
// Agent codes flagged half-price (e.g. HALF, shared via /apply?rep=HALF) halve
// the MONTHLY fee only — the per-cover / pre-order usage fees are unchanged.
// Keep HALF_PRICE_REPS in sync with the backend HalfPriceRepCodesLower
// (backend/internal/appdb/reppolicy.go).
const HALF_PRICE_REPS = ["half"];
function isHalfRep(code: string): boolean {
  return HALF_PRICE_REPS.includes((code || "").trim().toLowerCase());
}
const rand = (n: number) => "R" + n.toLocaleString("en-US");
const mo = (n: number, half: boolean) => rand(half ? Math.round(n / 2) : n);
function pricingText(cat: string, half: boolean): string {
  const m = (n: number) => mo(n, half);
  // The 50%-off launch promo is only for sign-ups during November 2026, so the
  // promo line shows only through 30 Nov; from 1 Dec it's normal pricing.
  const promo = Date.now() < Date.parse("2026-12-01T00:00:00+02:00");
  const tail = " - 50% discount for November and December 2026 and January 2027. Normal pricing resumes 01 February 2027.";
  switch (cat) {
    case "accommodation":
      return promo ? "R300 per month" + tail : "R300 per month.";
    case "restaurant":
    case "service":
    case "attraction":
      return promo ? "R300 per month" + tail : "R300 per month.";
    case "estate":
      return promo
        ? "Real Estate & Rentals R300 per month and Estate Agents R200 per month" + tail
        : "Real Estate & Rentals R300 per month and Estate Agents R200 per month.";
    case "retail":
      return promo ? "R500 per month" + tail : "R500 per month.";
    case "nonprofit": return "Free — no monthly fee for registered NPO / PBO organisations.";
    default: return "";
  }
}

const PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu Natal", "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"];
const PAYMENTS = ["Card", "Cash", "Gaap", "Mobile Tap", "Snap Scan", "Yoco", "Zapper", "iKhokha", "G Pay", "Samsung Pay", "SASSA", "Apple Pay"];
const ACCESS = ["Wheelchair Access", "Parking Availability"];
const DIETARY = ["Gluten Free", "Halaal", "Kosher", "Nut Free", "Signature Dish", "Chef Recommendation"];
const ATMOSPHERE = ["Family-friendly", "Romantic", "Trendy / Modern", "Quiet", "Lively", "Outdoor Seating", "Sea View", "Mountain View", "Rooftop", "Garden"];
const REST_FEATURES = ["Walk-ins Welcome", "Live Music", "Free Wi-Fi"];
const REST_TYPES = ["Food Truck", "Home Meals", "Take Away", "Delivery", "Pop Up", "Restaurant"];
const CUISINE = ["African", "À la carte", "American", "Asian", "BBQ", "Bakery", "Boerewors Rolls", "Breakfast", "Bunny Chow", "Burgers", "Cafe", "Cake", "Chinese", "Coffee Shop", "Curry", "Deli", "Fast Food", "Fine Dining", "French", "Greek", "Indian", "Italian", "Jaffels", "Japanese", "Mediterranean", "Mexican", "Middle Eastern", "Pasta", "Pizza", "Ribs", "Roast", "Sandwiches", "Seafood", "Spanish", "Steaks", "Sushi", "Thai", "Vegan", "Vegetarian"];
const ATTRACTION_CATS = ["Artisanal Tastings & Pairings", "Beaches & Coastal", "Cultural & Historical", "Entertainment & Events", "Free", "Nature & Outdoors", "Shopping & Markets", "Sports & Adventure", "Water-Based Activities", "Wellness & Retreats", "Wildlife & Eco"];
const FACILITIES = ["Braai", "Fly Fishing", "Golf", "Gym", "Lapa", "Laundry", "Spa", "Swimming Pool"];
const SERVICE_GROUPS = [
  { label: "Business & Admin", options: ["Accounting & Bookkeeping", "Business Consulting", "HR & Recruitment", "IT Support & Networking", "Legal & Compliance", "Printing & Document Services"] },
  { label: "Health & Wellness", options: ["Beauty Treatments", "Fitness & Gyms", "Grooming Services", "Holistic Therapies", "Skin Care & Aesthetics", "Spas & Beauty Treatments"] },
  { label: "Hobby & Craft Supplies", options: ["Wool & Craft"] },
  { label: "Home & Property", options: ["Architecture", "Cleaning Services", "Gardening & Landscaping", "Home Security", "Interior Design & Décor", "Laundry", "Pest Control", "Pet Sitting", "House Sitting", "Property Management"] },
  { label: "Services & Trades", options: ["Appliance Repairs", "Carpenters", "Electricians", "Gas Provider/Refill", "Handyman Services", "Locksmiths", "Mechanics", "Painters", "Plumbers", "Welders"] },
  { label: "Transport", options: ["Delivery & Courier Services", "Equipment Hire", "Moving Services", "Shuttle Services", "Taxi & Ride Hailing", "Towing Services", "Vehicle Rentals"] },
  { label: "Food & Drink", options: ["Bakeries", "Butcheries & Fishmongers", "Catering Services", "Fresh Produce Markets", "Grocery Stores"] },
  { label: "Safety", options: ["Emergency Services", "First Aid Training", "Medical Services", "Pharmacies", "Security Services", "Veterinary"] },
  { label: "Community & Local", options: ["Charity & Non Profit Services", "Community Centres", "Local Events & Activities", "Religious Organizations"] },
];

type Field = { key: string; type: "text" | "textarea" | "select" | "multi" | "multigroup" | "radio" | "itemrows"; options?: string[]; groups?: { label: string; options: string[] }[]; top?: string; required?: boolean; note?: string; priceRows?: string[]; label?: string };
type Section = { title: string; fields: Field[] };

const businessSection = (nameLabel: string): Section => ({
  title: "Your business",
  fields: [
    { key: nameLabel, type: "text", top: "businessName", required: true },
    { key: "Contact person", type: "text", top: "contactName", required: true },
    { key: "Contact email", type: "text", top: "contactEmail", required: true },
    { key: "Contact number", type: "text", top: "contactNumber", required: true },
    { key: "Province", type: "select", options: PROVINCES, top: "province", required: true },
    { key: "Area", type: "text", note: "your town or suburb (optional — we also get this from your postal code)" },
    { key: "Physical address", type: "text", note: "shown to Guests & Locals (hidden if you tick the box below)" },
    { key: "Works from different addresses", type: "multi", options: [
      "Yes — I work from different addresses (hide my address on Guest & Local pages)",
    ], note: "tick if you have no fixed public address; add your office address below for Official Use" },
    { key: "Office address (Official Use)", type: "text", note: "for accounts/admin only — never shown publicly" },
    { key: "Postal code", type: "text" },
    { key: "Holding company (if any)", type: "text" },
    { key: "Company registration number", type: "text" },
    { key: "VAT number (if registered)", type: "text" },
  ],
});
// Per-category booking charge shown on the "How you'd like to appear" section.
const BOOKING_NOTE: Record<string, string> = {
  restaurant: "R300/month + R10 per cover",
  service: "R300/month + 10% per service",
  attraction: "R300/month + 10% per person",
};
function appearSection(cat: string): Section {
  const fields: Field[] = [
    { key: "Works from different addresses", type: "multi", options: [
      "Yes — I travel to the client (no fixed address)",
    ], note: "tick if you have no fixed address; you'll still appear in nearby searches" },
  ];
  // Bookings are archived for now — hide the "Bookable items" question.
  if (BOOKINGS_ENABLED) {
    fields.unshift({ key: "Bookings", label: "Bookable items", type: "multi", options: [
      `We take bookings — ${BOOKING_NOTE[cat] || "R300/month"}`,
    ], note: "tick if guests can reserve or book with you" });
  }
  return { title: "How you'd like to appear", fields };
}
const discountsSection: Section = { title: "Discounts for Around You users", fields: [
  { key: "Guest discount — offer", type: "text" }, { key: "Guest discount code", type: "text" },
  { key: "Local discount — offer", type: "text" }, { key: "Local discount code", type: "text" },
] };
const paymentsSection: Section = { title: "Payment methods you accept", fields: [{ key: "Payment methods", type: "multi", options: PAYMENTS }] };
const socialsSection: Section = { title: "Social & web links", fields: [
  { key: "Website", type: "text" }, { key: "Facebook", type: "text" }, { key: "Instagram", type: "text" }, { key: "TikTok", type: "text" }, { key: "X (Twitter)", type: "text" },
] };
const accessibilitySection: Section = { title: "Accessibility & family", fields: [
  { key: "Accessibility options", type: "multi", options: ACCESS },
  { key: "Child friendly", type: "multi", options: ["Child Friendly"] },
] };
const charitySection: Section = { title: "Please give us the details of the charity you wish US to support", fields: [
  { key: "Charity name", type: "text" },
  { key: "Charity address", type: "text" },
  { key: "Charity contact number", type: "text" },
] };

const retailSpecialsSection: Section = { title: "Discounts / Specials (Discount or My Stamp Card)", fields: [
  { key: "Discounts / Specials", type: "textarea", note: "List any discounts or specials. For each, say who it's for — Guests, Locals or Both. e.g. '10% off fresh produce on Mondays (Both)'." },
  { key: "My Stamp Card — how a stamp is earned", type: "textarea", note: "e.g. For every 1 litre of milk bought you get 1 stamp." },
  { key: "My Stamp Card — the reward", type: "textarea", note: "e.g. After 10 stamps, redeem a free coffee." },
] };

function specsFor(cat: string, half: boolean): Section[] {
  if (cat === "restaurant") return [businessSection("Restaurant/Takeaway name")];
  if (cat === "service") return [businessSection("Business/Service name")];
  if (cat === "attraction") return [businessSection("Attraction/Activity name")];
  if (cat === "accommodation") return [
    businessSection("Accommodation name"),
    { title: "Accommodation details", fields: [
      { key: "Number of units / rooms", type: "text", note: "sets your monthly price", priceRows: [`1–5 units — ${mo(300, half)}`, `6–10 units — ${mo(500, half)}`, `11–20 units — ${mo(800, half)}`, `21–40 units — ${mo(1200, half)}`, "40+ units — Custom quote"] },
    ] },
  ];
  if (cat === "retail") return [businessSection("Retail business name"), retailSpecialsSection];
  if (cat === "nonprofit") return [
    businessSection("NPO / PBO name"),
    { title: "Registration numbers", fields: [
      { key: "NPO Number", type: "text", note: "your NPO / PBO registration number" },
      { key: "PBO Number", type: "text" },
    ] },
  ];
  // estate
  return [businessSection("Agency name")];
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#0a0a0a", padding: "24px 12px" };
const card: React.CSSProperties = { maxWidth: 640, margin: "0 auto", background: "#111111", color: "#d5d8d5", borderRadius: 14, padding: "24px 22px", border: "1px solid rgba(57,255,20,0.18)", boxShadow: "0 0 40px rgba(57,255,20,0.06)" };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid rgba(57,255,20,0.25)", background: "rgba(255,255,255,0.04)", color: "#fff", borderRadius: 8, fontSize: 14, marginTop: 4, boxSizing: "border-box" };
const labelSt: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#cfd3cf" };
const secSt: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: LUMO, margin: "18px 0 4px", borderBottom: "1px solid rgba(57,255,20,0.2)", paddingBottom: 4 };

export default function PartnerApplyForm() {
  const [cat, setCat] = useState<string>("");
  const [rep, setRep] = useState<string>("");
  const [vals, setVals] = useState<Record<string, any>>({});
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [showAgent, setShowAgent] = useState(false);
  const [geo, setGeo] = useState("");
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = (q.get("type") || "").toLowerCase();
    if (CATEGORIES.some((c) => c.key === t)) setCat(t);
    // Default to the internal/test rep so a self-onboarding partner always has a
    // rep code; they (or a real rep) can change it in the field below.
    setRep(q.get("rep") || "AROUNDYOU");
    // Restore an in-progress application autosaved on this device.
    try {
      const sv = JSON.parse(localStorage.getItem("aroundYouPartnerApply") || "{}");
      if (!CATEGORIES.some((c) => c.key === t) && sv.cat) setCat(sv.cat);
      if (!q.get("rep") && sv.rep) setRep(sv.rep);
      if (sv.vals && typeof sv.vals === "object") setVals(sv.vals);
    } catch { /* ignore */ }
    setRestored(true);
  }, []);

  const half = isHalfRep(rep);
  const sections = useMemo(() => (cat ? specsFor(cat, half) : []), [cat, half]);
  const set = (k: string, v: any) => setVals((s) => ({ ...s, [k]: v }));
  const toggle = (k: string, opt: string) =>
    setVals((s) => {
      const arr: string[] = Array.isArray(s[k]) ? s[k] : [];
      return { ...s, [k]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
    });

  // Autosave the in-progress application to this device (restored on return).
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem("aroundYouPartnerApply", JSON.stringify({ cat, rep, vals })); } catch { /* ignore */ }
  }, [cat, rep, vals, restored]);

  const useMyLocation = () => {
    if (!navigator.geolocation) { setGeo("unavailable"); return; }
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo(pos.coords.latitude.toFixed(5) + "," + pos.coords.longitude.toFixed(5)),
      () => setGeo("denied"),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };


  const catLabel = CATEGORIES.find((c) => c.key === cat)?.label || "";
  const nameKey = sections[0]?.fields.find((f) => f.top === "businessName")?.key || "Business name";
  const LEAD_KEYS = new Set([nameKey, "Contact person", "Contact email", "Contact number", "Postal code", "Province"]);

  const submit = async () => {
    setErr("");
    // top-level required
    const nameSpec = sections[0]?.fields.find((f) => f.top === "businessName");
    const businessName = (vals[nameSpec?.key || ""] || "").trim();
    const province = (vals["Province"] || "").trim();
    if (!businessName) { setErr("Please enter your business name."); return; }
    if (!(vals["Contact email"] || "").trim()) { setErr("Please enter a contact email (for your account and invoices)."); return; }
    if (!(vals["Contact number"] || "").trim()) { setErr("Please enter a contact number."); return; }
    if (!(vals["Postal code"] || "").trim()) { setErr("Please enter your postal code — this sets your area."); return; }
    const worksFrom = Array.isArray(vals["Works from different addresses"]) && vals["Works from different addresses"].length > 0;
    if (worksFrom && !(vals["Office address (Official Use)"] || "").trim()) {
      setErr("You ticked \"works from different addresses\" — please enter an Office address (Official Use)."); return;
    }
    if (!agree) { setErr("Please tick the agreement box to submit."); return; }

    // Build fields (everything except the top-level five) using the label as key.
    const topKeys = new Set(sections[0].fields.filter((f) => f.top).map((f) => f.key));
    const fields: Record<string, string> = {};
    for (const s of sections) for (const f of s.fields) {
      if (topKeys.has(f.key)) continue;
      const v = vals[f.key];
      let str = "";
      if (f.type === "itemrows") {
        str = (Array.isArray(v) ? v : [])
          .filter((r: any) => (r.item || "").toString().trim())
          .map((r: any) => `${(r.item || "").toString().trim()} — R${(r.price || "").toString().trim()}, ${(r.duration || "").toString().trim()} min`)
          .join("; ");
      } else {
        str = Array.isArray(v) ? v.join(", ") : (v || "").toString().trim();
      }
      if (str) fields[f.key] = str;
    }

    if (geo && geo.includes(",")) fields["GPS location"] = geo;
    setSubmitting(true);
    try {
      await backend.partnerApp.submit({
        category: cat,
        repCode: rep,
        businessName,
        contactName: (vals["Contact person"] || "").trim(),
        contactEmail: (vals["Contact email"] || "").trim(),
        contactNumber: (vals["Contact number"] || "").trim(),
        province,
        fields,
        agree,
      });
      setDone(true);
      try { localStorage.removeItem("aroundYouPartnerApply"); } catch { /* ignore */ }
    } catch (e: any) {
      setErr(e?.message || "Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={wrap}><div style={{ ...card, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><AppLogo /></div>
        <div style={{ fontSize: 40 }}>✅</div>
        <h2 style={{ color: LUMO, margin: "8px 0" }}>Thank you!</h2>
        <p style={{ color: "#a0a0a0", fontSize: 15 }}>Your application has been received. An Around You agent will be in touch to complete your listing.</p>
      </div></div>
    );
  }

  if (!cat) {
    return (
      <div style={wrap}><div style={card}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><AppLogo /></div>
        <h1 style={{ color: LUMO, fontSize: 22, textAlign: "center", margin: "0 0 4px" }}>Join Around You</h1>
        <p style={{ color: "#a0a0a0", fontSize: 14, textAlign: "center", marginTop: 0 }}>What kind of business are you listing?</p>
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)}
              style={{ padding: "16px", borderRadius: 10, border: `2px solid ${LUMO}`, background: "#000", color: LUMO, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              {c.label}
            </button>
          ))}
        </div>
      </div></div>
    );
  }

  return (
    <div style={wrap}><div style={card}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><AppLogo /></div>
      <button
        onClick={() => { setCat(""); setVals({}); setAgree(false); setErr(""); }}
        style={{ background: "transparent", border: "none", color: LUMO, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 8 }}
      >
        ← Change category
      </button>
      <h1 style={{ color: LUMO, fontSize: 22, textAlign: "center", margin: "0 0 2px" }}>Around You — {catLabel} Application</h1>
      <p style={{ color: "#a0a0a0", fontSize: 13, textAlign: "center", marginTop: 0 }}>
        Just a few details to get started — your Around You agent completes the rest with you. Fields marked * are required.
      </p>

      {pricingText(cat, half) && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, border: `1px solid ${LUMO}`, background: "rgba(57,255,20,0.07)", color: "#eafff0", fontSize: 13, textAlign: "center" }}>
          <span style={{ color: LUMO, fontWeight: 800 }}>Pricing: </span>{pricingText(cat, half)}
          {half && <div style={{ marginTop: 4, fontSize: 11, color: LUMO }}>HALF agent code applied — 50% off your monthly fee.</div>}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <label style={{ ...labelSt, fontSize: 14 }}>{nameKey} *</label>
        <input style={{ ...input, fontSize: 16 }} value={vals[nameKey] || ""} onChange={(e) => set(nameKey, e.target.value)} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ ...labelSt, fontSize: 14 }}>Contact email * <span style={{ color: "#8a8f96", fontWeight: 400 }}>(for your account &amp; invoices)</span></label>
        <input style={{ ...input, fontSize: 16 }} type="email" inputMode="email" autoComplete="email" value={vals["Contact email"] || ""} onChange={(e) => set("Contact email", e.target.value)} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ ...labelSt, fontSize: 14 }}>Contact number *</label>
        <input style={{ ...input, fontSize: 16 }} type="tel" inputMode="tel" autoComplete="tel" value={vals["Contact number"] || ""} onChange={(e) => set("Contact number", e.target.value)} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ ...labelSt, fontSize: 14 }}>Postal code * <span style={{ color: "#8a8f96", fontWeight: 400 }}>(sets your area)</span></label>
        <input style={{ ...input, fontSize: 16 }} inputMode="numeric" pattern="[0-9]*" maxLength={4} value={vals["Postal code"] || ""} onChange={(e) => set("Postal code", e.target.value.replace(/[^0-9]/g, ""))} />
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={useMyLocation}
            style={{ background: "transparent", color: LUMO, border: "1px solid rgba(57,255,20,0.4)", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
            Use my location (optional)
          </button>
          {geo === "locating" && <span style={{ color: "#9aa39a", fontSize: 12 }}>Finding you…</span>}
          {geo.includes(",") && <span style={{ color: LUMO, fontSize: 12 }}>✓ Location added</span>}
          {(geo === "denied" || geo === "unavailable") && <span style={{ color: "#d0a0a0", fontSize: 12 }}>Couldn’t get location — just type your postal code.</span>}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ ...labelSt, fontSize: 14 }}>Contact person <span style={{ color: "#8a8f96", fontWeight: 400 }}>(optional)</span></label>
        <input style={{ ...input, fontSize: 16 }} value={vals["Contact person"] || ""} onChange={(e) => set("Contact person", e.target.value)} />
      </div>

      <div style={{ marginTop: 12 }}>
        {!showAgent ? (
          <button type="button" onClick={() => setShowAgent(true)}
            style={{ background: "transparent", border: "none", color: LUMO, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
            Have an agent code?
          </button>
        ) : (
          <div>
            <label style={labelSt}>Agent Code</label>
            <input style={input} value={rep} onChange={(e) => setRep(e.target.value)} placeholder="AROUNDYOU" />
            <p style={{ color: "#7f857f", fontSize: 11, marginTop: 4 }}>Leave this as AROUNDYOU unless an agent gave you their own code.</p>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18, borderTop: "1px solid rgba(57,255,20,0.15)", paddingTop: 12 }}>
        <button type="button" onClick={() => setShowDetails((v) => !v)}
          style={{ background: "transparent", border: "none", color: LUMO, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: 0 }}>
          {showDetails ? "\u25be" : "\u25b8"} Add more details now (optional)
        </button>
        <p style={{ color: "#7f857f", fontSize: 11, margin: "4px 0 0" }}>Nice-to-have info for your listing — you can skip all of this and your agent will complete it with you.</p>
      </div>
      {showDetails && sections.map((sec) => (
        <div key={sec.title}>
          <div style={secSt}>{sec.title}</div>
          {sec.fields.filter((f) => !LEAD_KEYS.has(f.key)).map((f) => (
            <div key={f.key} style={{ marginTop: 10 }}>
              <label style={labelSt}>{f.label ?? f.key}{f.required ? " *" : ""}{f.note ? <span style={{ color: "#8a8f96", fontWeight: 400 }}> ({f.note})</span> : null}</label>
              {f.priceRows && (
                <ul style={{ margin: "4px 0 0", paddingLeft: 0, listStyle: "none", fontSize: 12, color: "#9aa" }}>
                  <li style={{ fontWeight: 600, color: "#cfd3cf" }}>Monthly price by units:</li>
                  {f.priceRows.map((r) => (<li key={r}>{r}</li>))}
                </ul>
              )}
              {f.type === "text" && (
                <input style={input} value={vals[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
              )}
              {f.type === "textarea" && (
                <textarea style={{ ...input, minHeight: 64 }} value={vals[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
              )}
              {f.type === "itemrows" && (
                <div style={{ marginTop: 6 }}>
                  {(Array.isArray(vals[f.key]) ? vals[f.key] : []).map((row: any, i: number) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                      <input style={{ ...input, marginTop: 0, flex: 2, minWidth: 120 }} placeholder="Item" value={row.item || ""}
                        onChange={(e) => { const rows = [...(vals[f.key] || [])]; rows[i] = { ...rows[i], item: e.target.value }; set(f.key, rows); }} />
                      <input style={{ ...input, marginTop: 0, flex: 1, minWidth: 80 }} placeholder="Price (R)" inputMode="decimal" value={row.price || ""}
                        onChange={(e) => { const rows = [...(vals[f.key] || [])]; rows[i] = { ...rows[i], price: e.target.value }; set(f.key, rows); }} />
                      <input style={{ ...input, marginTop: 0, flex: 1, minWidth: 150 }} placeholder="Duration (how long good food takes)" value={row.duration || ""}
                        onChange={(e) => { const rows = [...(vals[f.key] || [])]; rows[i] = { ...rows[i], duration: e.target.value }; set(f.key, rows); }} />
                      <button type="button" onClick={() => { const rows = [...(vals[f.key] || [])]; rows.splice(i, 1); set(f.key, rows); }}
                        style={{ background: "#7a1f1f", color: "#fff", border: "none", borderRadius: 8, width: 34, cursor: "pointer" }}>✗</button>
                    </div>
                  ))}
                  <button type="button"
                    onClick={() => set(f.key, [...(Array.isArray(vals[f.key]) ? vals[f.key] : []), { item: "", price: "", duration: "" }])}
                    style={{ background: "transparent", color: "#39FF14", border: "1px solid rgba(57,255,20,0.4)", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", marginTop: 2 }}>
                    + Add item
                  </button>
                </div>
              )}
              {f.type === "select" && (
                <select style={{ ...input, color: "#39FF14" }} value={vals[f.key] || ""} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="" style={{ color: "#39FF14", background: "#111" }}>Select…</option>
                  {f.options!.map((o) => <option key={o} value={o} style={{ color: "#39FF14", background: "#111" }}>{o}</option>)}
                </select>
              )}
              {f.type === "radio" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                  {f.options!.map((o) => (
                    <label key={o} style={{ fontSize: 14, display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="radio" name={f.key} checked={vals[f.key] === o} onChange={() => set(f.key, o)} /> {o}
                    </label>
                  ))}
                </div>
              )}
              {f.type === "multi" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 6 }}>
                  {f.options!.map((o) => (
                    <label key={o} style={{ fontSize: 13, display: "flex", gap: 5, alignItems: "center" }}>
                      <input type="checkbox" checked={Array.isArray(vals[f.key]) && vals[f.key].includes(o)} onChange={() => toggle(f.key, o)} /> {o}
                    </label>
                  ))}
                </div>
              )}
              {f.type === "multigroup" && (
                <div style={{ marginTop: 6 }}>
                  {f.groups!.map((g) => (
                    <div key={g.label} style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#9aa39a" }}>{g.label}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
                        {g.options.map((o) => (
                          <label key={o} style={{ fontSize: 13, display: "flex", gap: 5, alignItems: "center" }}>
                            <input type="checkbox" checked={Array.isArray(vals[f.key]) && vals[f.key].includes(o)} onChange={() => toggle(f.key, o)} /> {o}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      <p style={{ marginTop: 14, fontSize: 13, color: "#cfd3cf", lineHeight: 1.45, borderTop: "1px solid rgba(57,255,20,0.15)", paddingTop: 12 }}>
        Once submitted and you receive your Access and Edit codes, you will be able to edit all of the other information you can show on your Partner Profile.
      </p>

      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 18, fontSize: 13, color: "#cfd3cf" }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
        I agree to all of the Around You Terms &amp; Conditions and confirm that the information provided above is true and correct.
      </label>

      {err ? <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 10 }}>{err}</p> : null}

      <button onClick={submit} disabled={submitting}
        style={{ marginTop: 16, width: "100%", padding: "14px", borderRadius: 10, border: "none", background: submitting ? "#1f5c33" : LUMO, color: "#000", fontWeight: 800, fontSize: 16, cursor: submitting ? "not-allowed" : "pointer" }}>
        {submitting ? "Submitting…" : "Submit application"}
      </button>
      <p style={{ color: "#7f857f", fontSize: 11, textAlign: "center", marginTop: 10 }}>
        Your logo and photos will be arranged with your Around You agent. The first photo you provide will be your main image (shown first), so send that one first.
      </p>
    </div></div>
  );
}
