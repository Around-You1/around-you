"use client";

import { useEffect, useMemo, useState } from "react";
import backend from "~backend/client";

// Public self-service partner application. A rep shares a link like
//   /apply?type=restaurant&rep=Rep00000002
// The prospective partner fills this in; it submits straight into Around You
// (stored as Pending + emailed to Accounts and the referring rep). Onboarding
// itself stays an internal step.

const CATEGORIES: { key: string; label: string }[] = [
  { key: "restaurant", label: "Restaurant" },
  { key: "service", label: "Service" },
  { key: "attraction", label: "Attraction" },
  { key: "accommodation", label: "Accommodation" },
  { key: "estate", label: "Real Estate & Rentals" },
];

const PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu Natal", "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"];
const AUDIENCE = ["Guest only", "Local only", "Both"];
const PAYMENTS = ["Card", "Cash", "Gaap", "Mobile Tap", "Snap Scan", "Yoco", "Zapper"];
const ACCESS = ["Wheelchair Access", "Parking Availability"];
const DIETARY = ["Gluten Free", "Halaal", "Kosher", "Nut Free", "Signature Dish", "Chef Recommendation"];
const ATMOSPHERE = ["Family-friendly", "Romantic", "Trendy / Modern", "Quiet", "Lively", "Outdoor Seating", "Sea View", "Mountain View", "Rooftop", "Garden"];
const REST_FEATURES = ["Walk-ins Welcome", "Live Music", "Free Wi-Fi"];
const REST_TYPES = ["Food Truck", "Home Meals", "Take Away", "Pop Up", "Restaurant"];
const CUISINE = ["African", "À la carte", "American", "Asian", "BBQ", "Bakery", "Boerewors Rolls", "Breakfast", "Bunny Chow", "Burgers", "Cafe", "Cake", "Chinese", "Coffee Shop", "Curry", "Deli", "Fast Food", "Fine Dining", "French", "Greek", "Indian", "Italian", "Japanese", "Mediterranean", "Mexican", "Middle Eastern", "Pasta", "Pizza", "Ribs", "Roast", "Sandwiches", "Seafood", "Spanish", "Steaks", "Sushi", "Thai", "Vegan", "Vegetarian"];
const ATTRACTION_CATS = ["Artisanal Tastings & Pairings", "Beaches & Coastal", "Cultural & Historical", "Entertainment & Events", "Nature & Outdoors", "Shopping & Markets", "Sports & Adventure", "Water-Based Activities", "Wellness & Retreats", "Wildlife & Eco"];
const FACILITIES = ["Braai", "Fly Fishing", "Golf", "Gym", "Laundry", "Spa", "Swimming Pool"];
const SERVICE_GROUPS = [
  { label: "Business & Admin", options: ["Accounting & Bookkeeping", "Business Consulting", "HR & Recruitment", "IT Support & Networking", "Legal & Compliance", "Printing & Document Services"] },
  { label: "Health & Wellness", options: ["Beauty Treatments", "Fitness & Gyms", "Grooming Services", "Holistic Therapies", "Skin Care & Aesthetics", "Spas & Beauty Treatments"] },
  { label: "Home & Property", options: ["Architecture", "Cleaning Services", "Gardening & Landscaping", "Home Security", "Interior Design & Décor", "Pest Control", "Pet Sitting", "House Sitting"] },
  { label: "Services & Trades", options: ["Appliance Repairs", "Carpenters", "Electricians", "Handyman Services", "Locksmiths", "Mechanics", "Painters", "Plumbers", "Welders"] },
  { label: "Transport", options: ["Delivery & Courier Services", "Equipment Hire", "Moving Services", "Shuttle Services", "Taxi & Ride Hailing", "Towing Services", "Vehicle Rentals"] },
  { label: "Food & Drink", options: ["Bakeries", "Butcheries & Fishmongers", "Catering Services", "Fresh Produce Markets", "Grocery Stores"] },
  { label: "Safety", options: ["Emergency Services", "First Aid Training", "Medical Services", "Pharmacies", "Security Services"] },
  { label: "Community & Local", options: ["Charity & Non Profit Services", "Community Centres", "Local Events & Activities", "Religious Organizations"] },
];

type Field = { key: string; type: "text" | "textarea" | "select" | "multi" | "multigroup" | "radio"; options?: string[]; groups?: { label: string; options: string[] }[]; top?: string; required?: boolean; note?: string };
type Section = { title: string; fields: Field[] };

const businessSection = (nameLabel: string): Section => ({
  title: "Your business",
  fields: [
    { key: nameLabel, type: "text", top: "businessName", required: true },
    { key: "Contact person", type: "text", top: "contactName" },
    { key: "Contact email", type: "text", top: "contactEmail" },
    { key: "Contact number", type: "text", top: "contactNumber" },
    { key: "Province", type: "select", options: PROVINCES, top: "province", required: true },
    { key: "Physical address", type: "text" },
    { key: "Postal code", type: "text" },
    { key: "Holding company (if any)", type: "text" },
    { key: "Company registration number", type: "text" },
    { key: "VAT number (if registered)", type: "text" },
  ],
});
const audienceSection: Section = { title: "How you'd like to appear", fields: [{ key: "Audience", type: "radio", options: AUDIENCE, note: "Or ask your rep about a Booking listing." }] };
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
const charitySection: Section = { title: "Charity you'd like to support", fields: [
  { key: "Charity group", type: "radio", options: ["Adults", "Children", "Animals"] },
  { key: "Charity focus", type: "radio", options: ["Health", "Homes", "Food"] },
] };

function specsFor(cat: string): Section[] {
  if (cat === "restaurant") return [
    businessSection("Restaurant name"),
    { title: "Restaurant details", fields: [
      { key: "Restaurant type", type: "select", options: REST_TYPES },
      { key: "Cuisine type(s)", type: "multi", options: CUISINE },
      { key: "Atmosphere", type: "multi", options: ATMOSPHERE },
      { key: "Features", type: "multi", options: REST_FEATURES },
      { key: "Dietary options", type: "multi", options: DIETARY },
      { key: "Description", type: "textarea" },
      { key: "Menu link", type: "text" },
      { key: "Service options", type: "multi", options: ["Dine-in", "Takeaway", "Delivery"] },
      { key: "Wi-Fi network name", type: "text" }, { key: "Wi-Fi password", type: "text" },
    ] },
    audienceSection, discountsSection, paymentsSection, socialsSection, accessibilitySection, charitySection,
  ];
  if (cat === "service") return [
    businessSection("Service name"),
    { title: "Service details", fields: [
      { key: "Service category(ies)", type: "multigroup", groups: SERVICE_GROUPS },
      { key: "Description", type: "textarea" },
    ] },
    { title: "Good-to-know info", fields: [
      { key: "Safety information", type: "text" }, { key: "Age restrictions", type: "text" },
      { key: "Fitness level", type: "text" }, { key: "Best time of day", type: "text" }, { key: "What to bring", type: "text" },
    ] },
    audienceSection, discountsSection, paymentsSection, socialsSection, accessibilitySection, charitySection,
  ];
  if (cat === "attraction") return [
    businessSection("Attraction name"),
    { title: "Attraction details", fields: [
      { key: "Attraction category(ies)", type: "multi", options: ATTRACTION_CATS },
      { key: "Description", type: "textarea" },
    ] },
    { title: "Good-to-know info", fields: [
      { key: "Safety information", type: "text" }, { key: "Age restrictions", type: "text" }, { key: "Fitness level", type: "text" },
      { key: "Best time of day", type: "text" }, { key: "What to bring", type: "text" }, { key: "Trail difficulty", type: "text" },
      { key: "Wildlife cautions", type: "text" }, { key: "Tide warnings", type: "text" }, { key: "Parking notes", type: "text" }, { key: "Photography spots", type: "text" },
    ] },
    audienceSection, discountsSection, paymentsSection, socialsSection, accessibilitySection, charitySection,
  ];
  if (cat === "accommodation") return [
    businessSection("Accommodation name"),
    { title: "Accommodation details", fields: [
      { key: "Number of units / rooms", type: "text", note: "sets your monthly price" },
      { key: "Contact", type: "text" }, { key: "Description", type: "textarea" },
      { key: "Check-in instructions", type: "textarea" }, { key: "Check-out instructions", type: "textarea" },
      { key: "Amenities", type: "textarea" }, { key: "House guidelines", type: "textarea" },
      { key: "Facilities", type: "multi", options: FACILITIES },
      { key: "Wi-Fi network name", type: "text" }, { key: "Wi-Fi password", type: "text" },
    ] },
    { title: "Emergency contacts (shown to guests)", fields: [
      { key: "Police", type: "text" }, { key: "Ambulance", type: "text" }, { key: "Fire department", type: "text" },
      { key: "Nearest hospital — number", type: "text" }, { key: "Nearest hospital — address", type: "text" },
      { key: "Doctor — name / number / address", type: "text" }, { key: "Vet — name / number / address", type: "text" },
      { key: "Sea Rescue / NSRI", type: "text" }, { key: "Snake catcher", type: "text" }, { key: "Community watch", type: "text" }, { key: "Local security", type: "text" },
    ] },
    accessibilitySection, charitySection,
  ];
  // estate
  return [
    businessSection("Agency name"),
    { title: "Agency details", fields: [{ key: "Agency description", type: "textarea" }] },
    { title: "Agent details (if applicable)", fields: [
      { key: "Agent full name", type: "text" }, { key: "Agent contact number", type: "text" },
      { key: "Agent email", type: "text" }, { key: "Agent bio", type: "textarea" },
    ] },
    { title: "Property listing (if listing one now)", fields: [
      { key: "Property title", type: "text" }, { key: "Property type", type: "text" },
      { key: "Listing type", type: "radio", options: ["For Sale", "To Rent"] },
      { key: "Price (Rand)", type: "text" }, { key: "Bedrooms", type: "text" }, { key: "Bathrooms", type: "text" }, { key: "Garages", type: "text" },
      { key: "Plot size (m2)", type: "text" }, { key: "House size (m2)", type: "text" },
      { key: "Features", type: "text" }, { key: "Property description", type: "textarea" },
    ] },
  ];
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#f3f5f7", padding: "24px 12px" };
const card: React.CSSProperties = { maxWidth: 640, margin: "0 auto", background: "#fff", borderRadius: 14, padding: "24px 22px", boxShadow: "0 2px 18px rgba(0,0,0,0.08)" };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #cfd4da", borderRadius: 8, fontSize: 14, marginTop: 4, boxSizing: "border-box" };
const labelSt: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#333" };
const secSt: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: "#159a53", margin: "18px 0 4px", borderBottom: "1px solid #e5e7eb", paddingBottom: 4 };

export default function PartnerApplyForm() {
  const [cat, setCat] = useState<string>("");
  const [rep, setRep] = useState<string>("");
  const [vals, setVals] = useState<Record<string, any>>({});
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = (q.get("type") || "").toLowerCase();
    if (CATEGORIES.some((c) => c.key === t)) setCat(t);
    setRep(q.get("rep") || "");
  }, []);

  const sections = useMemo(() => (cat ? specsFor(cat) : []), [cat]);
  const set = (k: string, v: any) => setVals((s) => ({ ...s, [k]: v }));
  const toggle = (k: string, opt: string) =>
    setVals((s) => {
      const arr: string[] = Array.isArray(s[k]) ? s[k] : [];
      return { ...s, [k]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
    });

  const catLabel = CATEGORIES.find((c) => c.key === cat)?.label || "";

  const submit = async () => {
    setErr("");
    // top-level required
    const nameSpec = sections[0]?.fields.find((f) => f.top === "businessName");
    const businessName = (vals[nameSpec?.key || ""] || "").trim();
    const province = (vals["Province"] || "").trim();
    if (!businessName) { setErr("Please enter your business name."); return; }
    if (!province) { setErr("Please choose your province."); return; }
    if (!agree) { setErr("Please tick the agreement box to submit."); return; }

    // Build fields (everything except the top-level five) using the label as key.
    const topKeys = new Set(sections[0].fields.filter((f) => f.top).map((f) => f.key));
    const fields: Record<string, string> = {};
    for (const s of sections) for (const f of s.fields) {
      if (topKeys.has(f.key)) continue;
      const v = vals[f.key];
      const str = Array.isArray(v) ? v.join(", ") : (v || "").toString().trim();
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
        <div style={{ fontSize: 40 }}>✅</div>
        <h2 style={{ color: "#159a53", margin: "8px 0" }}>Thank you!</h2>
        <p style={{ color: "#444", fontSize: 15 }}>Your application has been received. An Around You representative will be in touch to complete your listing.</p>
      </div></div>
    );
  }

  if (!cat) {
    return (
      <div style={wrap}><div style={card}>
        <h1 style={{ color: "#159a53", fontSize: 22, textAlign: "center", margin: "0 0 4px" }}>Join Around You</h1>
        <p style={{ color: "#555", fontSize: 14, textAlign: "center", marginTop: 0 }}>What kind of business are you listing?</p>
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)}
              style={{ padding: "16px", borderRadius: 10, border: "2px solid #159a53", background: "#fff", color: "#159a53", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              {c.label}
            </button>
          ))}
        </div>
      </div></div>
    );
  }

  return (
    <div style={wrap}><div style={card}>
      <h1 style={{ color: "#159a53", fontSize: 22, textAlign: "center", margin: "0 0 2px" }}>Around You — {catLabel} Application</h1>
      <p style={{ color: "#555", fontSize: 13, textAlign: "center", marginTop: 0 }}>
        Please complete the fields below. Fields marked * are required.
        {rep ? <><br />Referred by rep {rep}.</> : null}
      </p>

      {sections.map((sec) => (
        <div key={sec.title}>
          <div style={secSt}>{sec.title}</div>
          {sec.fields.map((f) => (
            <div key={f.key} style={{ marginTop: 10 }}>
              <label style={labelSt}>{f.key}{f.required ? " *" : ""}{f.note ? <span style={{ color: "#8a8f96", fontWeight: 400 }}> ({f.note})</span> : null}</label>
              {f.type === "text" && (
                <input style={input} value={vals[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
              )}
              {f.type === "textarea" && (
                <textarea style={{ ...input, minHeight: 64 }} value={vals[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
              )}
              {f.type === "select" && (
                <select style={input} value={vals[f.key] || ""} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">Select…</option>
                  {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
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
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>{g.label}</div>
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

      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 18, fontSize: 13, color: "#333" }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
        I agree to all of the Around You Terms &amp; Conditions and confirm that the information provided above is true and correct.
      </label>

      {err ? <p style={{ color: "#c0392b", fontSize: 13, marginTop: 10 }}>{err}</p> : null}

      <button onClick={submit} disabled={submitting}
        style={{ marginTop: 16, width: "100%", padding: "14px", borderRadius: 10, border: "none", background: submitting ? "#9bd8b6" : "#159a53", color: "#fff", fontWeight: 800, fontSize: 16, cursor: submitting ? "not-allowed" : "pointer" }}>
        {submitting ? "Submitting…" : "Submit application"}
      </button>
      <p style={{ color: "#8a8f96", fontSize: 11, textAlign: "center", marginTop: 10 }}>
        Your logo and photos will be arranged with your Around You representative.
      </p>
    </div></div>
  );
}
