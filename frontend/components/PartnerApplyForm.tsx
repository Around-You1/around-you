"use client";

import { useEffect, useMemo, useState } from "react";
import backend from "~backend/client";
import { getAuthenticatedBackend } from "../lib/backend";
import AppLogo from "../components/AppLogo";

const LUMO = "#39FF14";

// Public self-service partner application. A rep shares a link like
//   /apply?type=restaurant&rep=Rep00000002
// The prospective partner fills this in; it submits straight into Around You
// (stored as Pending + emailed to Accounts and the referring rep). Onboarding
// itself stays an internal step.

const CATEGORIES: { key: string; label: string }[] = [
  { key: "accommodation", label: "Accommodation" },
  { key: "restaurant", label: "Restaurant/Takeaway" },
  { key: "service", label: "Business/Service" },
  { key: "attraction", label: "Attraction/Activity" },
  { key: "estate", label: "Real Estate & Rentals" },
  { key: "retail", label: "Retail" },
  { key: "nonprofit", label: "NPO / PBO" },
];

// Per-category pricing shown prominently near the top of each application.
const PRICING: Record<string, string> = {
  accommodation: "R300 per month.",
  restaurant: "R300 per month, plus Bookings @ R10 per cover and Pre-Orders @ 5% of the bill.",
  service: "R300 per month, plus Bookings @ 10% of the bill and Pre-Orders @ 10% of the bill.",
  attraction: "R300 per month, plus Bookings @ 10% of the bill and Pre-Orders @ 10% of the bill.",
  estate: "Estate Agencies R500 per month and Agents R300 per month each.",
  retail: "R500 per month.",
  nonprofit: "Free — no monthly fee for registered NPO / PBO organisations.",
};

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
    { key: "Area", type: "text", required: true, note: "your town or suburb — used to list you in the right area" },
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
  return {
    title: "How you'd like to appear",
    fields: [
      { key: "Bookings", label: "Bookable items", type: "multi", options: [
        `We take bookings — ${BOOKING_NOTE[cat] || "R300/month"}`,
      ], note: "tick if guests can reserve or book with you" },
      { key: "Works from different addresses", type: "multi", options: [
        "Yes — I travel to the client (no fixed address)",
      ], note: "tick if you have no fixed address; you'll still appear in nearby searches" },
    ],
  };
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

function specsFor(cat: string): Section[] {
  if (cat === "restaurant") return [businessSection("Restaurant/Takeaway name")];
  if (cat === "service") return [businessSection("Business/Service name")];
  if (cat === "attraction") return [businessSection("Attraction/Activity name")];
  if (cat === "accommodation") return [
    businessSection("Accommodation name"),
    { title: "Accommodation details", fields: [
      { key: "Number of units / rooms", type: "text", note: "sets your monthly price", priceRows: ["1–5 units — R300", "6–10 units — R500", "11–20 units — R800", "21–40 units — R1,200", "40+ units — Custom quote"] },
    ] },
  ];
  if (cat === "retail") return [businessSection("Retail business name"), retailSpecialsSection];
  if (cat === "nonprofit") return [
    businessSection("NPO / PBO name"),
    { title: "Registration numbers", fields: [
      { key: "NPO Number", type: "text", required: true, note: "required for NPO / PBO organisations" },
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
  const [isStaff, setIsStaff] = useState(false);
  const [autofillStatus, setAutofillStatus] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = (q.get("type") || "").toLowerCase();
    if (CATEGORIES.some((c) => c.key === t)) setCat(t);
    // Default to the internal/test rep so a self-onboarding partner always has a
    // rep code; they (or a real rep) can change it in the field below.
    setRep(q.get("rep") || "AROUNDYOU");
    // Reps / admins (signed in) get an extra tool: upload a completed onboarding
    // PDF and Claude pre-fills the form. Public visitors never see it.
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      const tok = localStorage.getItem("token") || "";
      if (tok && ["Rep", "SuperAdmin", "Admin"].includes(u?.role)) setIsStaff(true);
    } catch { /* not signed in — fine */ }
  }, []);

  const sections = useMemo(() => (cat ? specsFor(cat) : []), [cat]);
  const set = (k: string, v: any) => setVals((s) => ({ ...s, [k]: v }));
  const toggle = (k: string, opt: string) =>
    setVals((s) => {
      const arr: string[] = Array.isArray(s[k]) ? s[k] : [];
      return { ...s, [k]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
    });

  // Staff-only: upload a hand-filled onboarding PDF, or one or more WhatsApp /
  // photo screenshots; Claude reads them all and the form pre-fills for review.
  // Restaurant only for now. Never auto-submits.
  const autofillFromFiles = async (fileList: FileList) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    setAutofillStatus(`Reading ${files.length === 1 ? "the file" : files.length + " files"} with Claude\u2026 this can take ~20 seconds.`);
    try {
      const readOne = (file: File) =>
        new Promise<{ mediaType: string; data: string }>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () =>
            resolve({ mediaType: file.type || "application/octet-stream", data: String(fr.result || "") });
          fr.onerror = () => reject(new Error("Could not read " + file.name));
          fr.readAsDataURL(file);
        });
      const payloadFiles = await Promise.all(files.map(readOne));
      const res: any = await getAuthenticatedBackend().onboarding.extract({
        category: "restaurant",
        files: payloadFiles,
      });
      const f = res?.fields || {};
      const d = f.data || {};
      const strip = (x: any) => (x == null ? "" : String(x).trim());
      const norm = (s2: string) => s2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const canon = (opts: string[], arr: any): string[] =>
        (Array.isArray(arr) ? arr : [])
          .map((v) => opts.find((o) => norm(o) === norm(String(v))) || String(v))
          .filter(Boolean);
      const soc = d.socialLinks || {};
      const next: Record<string, any> = {
        "Restaurant/Takeaway name": strip(d.name),
        "Contact person": strip(d.personResponsible),
        "Contact email": strip(d.businessEmail),
        "Contact number": strip(d.contactNumber) || strip(d.personResponsibleNumber),
        "Province": strip(f.province),
        "Physical address": strip(d.address),
        "Postal code": strip(d.postalCode),
        "Holding company (if any)": strip(d.holdingCompany),
        "Company registration number": strip(d.companyRegNumber),
        "VAT number (if registered)": strip(d.companyVatNumber),
        "Trading hours": strip(d.tradingHours),
        "Public holidays": strip(d.publicHolidays),
        "Restaurant type": canon(REST_TYPES, d.restaurantType)[0] || "",
        "Cuisine type(s)": canon(CUISINE, d.cuisineTypes),
        "Atmosphere": canon(ATMOSPHERE, d.atmosphere),
        "Features": canon(REST_FEATURES, d.features),
        "Dietary options": canon(DIETARY, d.dietary),
        "Chef recommendation": strip(d.chefRecommendation),
        "Description": strip(d.description),
        "Menu link": strip(d.menuLink),
        "Service options": canon(["Dine-in", "Takeaway", "Delivery"], f.serviceOptions),
        "Wi-Fi network name": strip(d.wifiName),
        "Wi-Fi password": strip(d.wifiPassword),
        "Guest discount \u2014 offer": strip(d.discountOffered),
        "Guest discount code": strip(d.discountCode),
        "Local discount \u2014 offer": strip(d.localDiscountOffered),
        "Local discount code": strip(d.localDiscountCode),
        "Payment methods": canon(PAYMENTS, d.paymentOptions),
        "Website": strip(soc.Website),
        "Facebook": strip(soc.Facebook),
        "Instagram": strip(soc.Instagram),
        "TikTok": strip(soc.Tiktok),
        "X (Twitter)": strip(soc.X),
        "Accessibility options": canon(ACCESS, d.accessibility),
        "Child friendly": canon(["Child Friendly"], d.childFriendly),
      };
      // Only write non-empty values so a re-upload never blanks a field.
      setVals((cur) => {
        const merged = { ...cur };
        for (const [k, v] of Object.entries(next)) {
          if (Array.isArray(v) ? v.length : strip(v)) merged[k] = v;
        }
        return merged;
      });
      setAutofillStatus("\u2713 Form pre-filled \u2014 please review every field, correct anything the reader missed, then submit.");
    } catch (e: any) {
      setAutofillStatus("Could not read that: " + (e?.message || "please try again, or enter the details manually."));
    }
  };

  const catLabel = CATEGORIES.find((c) => c.key === cat)?.label || "";

  const submit = async () => {
    setErr("");
    // top-level required
    const nameSpec = sections[0]?.fields.find((f) => f.top === "businessName");
    const businessName = (vals[nameSpec?.key || ""] || "").trim();
    const province = (vals["Province"] || "").trim();
    if (!businessName) { setErr("Please enter your business name."); return; }
    if (!province) { setErr("Please choose your province."); return; }
    if (!(vals["Contact person"] || "").trim()) { setErr("Please enter a contact person."); return; }
    if (!(vals["Contact email"] || "").trim()) { setErr("Please enter a contact email."); return; }
    if (!(vals["Contact number"] || "").trim()) { setErr("Please enter a contact number."); return; }
    if (!(vals["Area"] || "").trim()) { setErr("Please enter your Area (town or suburb)."); return; }
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
        Please complete the fields below. Fields marked * are required.
      </p>

      {PRICING[cat] && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, border: `1px solid ${LUMO}`, background: "rgba(57,255,20,0.07)", color: "#eafff0", fontSize: 13, textAlign: "center" }}>
          <span style={{ color: LUMO, fontWeight: 800 }}>Pricing: </span>{PRICING[cat]}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <label style={labelSt}>Agent Code</label>
        <input style={input} value={rep} onChange={(e) => setRep(e.target.value)} placeholder="AROUNDYOU" />
        <p style={{ color: "#7f857f", fontSize: 11, marginTop: 4 }}>Leave this as AROUNDYOU unless an agent gave you their own code, then please change accordingly.</p>
      </div>

      {isStaff && cat === "restaurant" && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 10, border: `1px dashed ${LUMO}`, background: "rgba(57,255,20,0.05)" }}>
          <div style={{ color: LUMO, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Agent tool \u2014 auto-fill from a completed form</div>
          <p style={{ color: "#a0a0a0", fontSize: 12, margin: "0 0 10px" }}>
            Have a hand-filled onboarding PDF, or WhatsApp screenshots of the owner's details? Upload the PDF <strong>or</strong> the screenshots (select them all at once) and Claude will read them and pre-fill the fields below for you to review before submitting.
          </p>
          <label style={{ display: "inline-block", padding: "9px 14px", borderRadius: 8, border: `2px solid ${LUMO}`, background: "#000", color: LUMO, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Upload PDF or screenshots to auto-fill
            <input
              type="file"
              accept="application/pdf,image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => { const fl = e.target.files; if (fl && fl.length) autofillFromFiles(fl); e.currentTarget.value = ""; }}
            />
          </label>
          {autofillStatus && (
            <p style={{ color: autofillStatus.startsWith("\u2713") ? LUMO : "#d0a0a0", fontSize: 12, marginTop: 10 }}>{autofillStatus}</p>
          )}
        </div>
      )}

      {sections.map((sec) => (
        <div key={sec.title}>
          <div style={secSt}>{sec.title}</div>
          {sec.fields.map((f) => (
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
