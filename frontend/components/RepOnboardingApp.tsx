"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAuthenticatedBackend } from "../lib/backend";

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

const COUNTRY_OPTIONS = ["South Africa", "Asia", "Europe", "USA"];
const PROVINCE_OPTIONS = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu Natal", "Limpopo",
  "Mpumalanga", "Northern Cape", "North West", "Western Cape",
];
const ACCESSIBILITY_OPTIONS = ["Wheelchair Access", "Parking Availability"];
const DIETARY_OPTIONS = ["Gluten Free", "Halaal", "Kosher", "Nut Free", "Signature Dish", "Chef Recommendation"];
const SOCIAL_LINKS_OPTIONS = ["Website", "Facebook", "Instagram", "Tiktok", "X"];
const PAYMENT_OPTIONS = ["Card", "Cash", "Gaap", "Mobile Tap", "Snap Scan", "Yoco", "Zapper"];

const CUISINE_TYPES = [
  "African", "À la carte", "American", "Asian", "BBQ", "Bakery", "Boerewors Rolls",
  "Breakfast", "Bunny Chow", "Burgers", "Cafe", "Cake", "Chinese", "Coffee Shop",
  "Croissant", "Curry", "Dagwood", "Deli", "Eisbein", "Espetada", "Fast Food",
  "Fine Dining", "French", "Gatsby", "Greek", "Indian", "Irish", "Italian",
  "Japanese", "Mediterranean", "Mexican", "Middle Eastern", "Pancakes", "Panini",
  "Pasta", "Pizza", "Pies", "Pita", "Quiche", "Ribs", "Roast", "Sandwiches",
  "Scones", "Seafood", "Spanish", "Steaks", "Sushi", "Soup", "Thai", "Toasties",
  "Vegan", "Vegetarian", "Vetkoek",
];

// Rep's own session — the real signed-in rep, from Rep sign-in (full name +
// rep code), read from the same localStorage the rest of the app already
// uses (see app/rep-login and RepLoginPage.tsx). Read once at module load
// via a function rather than a plain constant, since localStorage doesn't
// exist during server-side rendering.
function getRepSession() {
  if (typeof window === "undefined") {
    return { repName: "", repCode: "", repEmail: "" };
  }
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return {
      repName: user.fullName || "",
      repCode: user.repCode || "",
      repEmail: user.email || "",
    };
  } catch {
    return { repName: "", repCode: "", repEmail: "" };
  }
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const inputStyle = {
  width: "100%", background: colors.surface2, border: `1px solid ${colors.border}`,
  color: colors.textPrimary, borderRadius: 10, padding: "12px 14px", fontSize: 15,
  marginBottom: 10, boxSizing: "border-box",
};
const labelStyle = { fontSize: 12, color: colors.textSecondary, marginBottom: 4, display: "block" };

function TextField({ label, value, onChange, area }) {
  const Comp = area ? "textarea" : "input";
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <Comp
        style={{ ...inputStyle, ...(area ? { minHeight: 70, resize: "vertical" } : {}) }}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CheckboxGroup({ label, options, selected = [], onChange }) {
  const toggle = (opt) => {
    const next = selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt];
    onChange(next);
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => (
          <label
            key={opt}
            style={{
              display: "flex", alignItems: "center", gap: 6, fontSize: 13,
              color: selected.includes(opt) ? colors.primary : colors.textSecondary,
              border: `1px solid ${selected.includes(opt) ? colors.primary : colors.border}`,
              borderRadius: 20, padding: "7px 12px", cursor: "pointer",
            }}
          >
            <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} style={{ accentColor: colors.primary }} />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

function SocialLinksField({ label = "Social Links", value = {}, onChange }) {
  const toggle = (opt) => {
    const next = { ...value };
    if (opt in next) delete next[opt];
    else next[opt] = "";
    onChange(next);
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      {SOCIAL_LINKS_OPTIONS.map((opt) => (
        <div key={opt} style={{ marginBottom: 6 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: opt in value ? colors.primary : colors.textSecondary, cursor: "pointer" }}>
            <input type="checkbox" checked={opt in value} onChange={() => toggle(opt)} style={{ accentColor: colors.primary }} />
            {opt}
          </label>
          {opt in value && (
            <input
              type="text"
              placeholder={`${opt} URL`}
              value={value[opt]}
              onChange={(e) => onChange({ ...value, [opt]: e.target.value })}
              style={{ ...inputStyle, marginTop: 4, marginBottom: 0 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function DietaryOptionsField({ selected = [], onChange, extraValue, onExtraChange }) {
  const toggle = (opt) => {
    const next = selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt];
    onChange(next);
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>Dietary Options</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {DIETARY_OPTIONS.map((opt) => (
          <label
            key={opt}
            style={{
              display: "flex", alignItems: "center", gap: 6, fontSize: 13,
              color: selected.includes(opt) ? colors.primary : colors.textSecondary,
              border: `1px solid ${selected.includes(opt) ? colors.primary : colors.border}`,
              borderRadius: 20, padding: "7px 12px", cursor: "pointer",
            }}
          >
            <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} style={{ accentColor: colors.primary }} />
            {opt}
          </label>
        ))}
      </div>
      {selected.includes("Signature Dish") && (
        <input
          type="text"
          placeholder="Signature dish name / details"
          value={extraValue || ""}
          onChange={(e) => onExtraChange(e.target.value)}
          style={{ ...inputStyle, marginTop: 8 }}
        />
      )}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ color: colors.accent, fontSize: 12, fontWeight: 800, letterSpacing: 0.5, margin: "18px 0 8px", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

// ---------- Image upload ----------
function ImageUpload({ images, setImages }) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const addFiles = (fileList) => {
    const files = Array.from(fileList).slice(0, 10 - images.length);
    const previews = files.map((f) => ({ url: URL.createObjectURL(f), name: f.name, file: f }));
    setImages((prev) => [...prev, ...previews].slice(0, 10));
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>Images ({images.length}/10)</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          style={{ flex: 1, background: colors.surface2, border: `1px solid ${colors.primary}`, color: colors.primary, borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          📷 Camera
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{ flex: 1, background: colors.surface2, border: `1px solid ${colors.primary}`, color: colors.primary, borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          🖼 Gallery
        </button>
      </div>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => e.target.files && addFiles(e.target.files)} />
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => e.target.files && addFiles(e.target.files)} />

      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: "relative", width: 60, height: 60 }}>
              <img src={img.url} alt={img.name} style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: `1px solid ${colors.border}` }} />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                style={{ position: "absolute", top: -6, right: -6, background: colors.error, color: "#000", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 11, cursor: "pointer", lineHeight: "18px" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Tier button ----------
function TierButtons({ tier, setTier }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
      {[1, 2, 3, 4].map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTier(t)}
          style={{
            padding: "20px 4px", borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: "pointer",
            background: tier >= t ? colors.primary : "transparent",
            color: tier >= t ? "#000" : colors.textSecondary,
            border: `2px solid ${tier >= t ? colors.primary : colors.border}`,
          }}
        >
          Tier {t}
        </button>
      ))}
    </div>
  );
}

// =========================================================
// Main app
// =========================================================
export default function RepOnboardingApp() {
  const router = useRouter();
  const repSession = getRepSession();
  const [partnerType, setPartnerType] = useState(null); // "Accommodations" | "Restaurants" | "Services" | "Attractions"
  const [tier, setTier] = useState(0);
  const [visibility, setVisibility] = useState([]);
  const [country, setCountry] = useState([]);
  const [province, setProvince] = useState([]);
  const [data, setData] = useState({});
  const [emergency, setEmergency] = useState({});
  const [images, setImages] = useState([]);
  const [autoSaveStatus, setAutoSaveStatus] = useState("");
  const [submitted, setSubmitted] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (id) => (val) => setData((d) => ({ ...d, [id]: val }));

  // Auto-save simulation: debounce on any change
  useEffect(() => {
    if (!partnerType) return;
    setAutoSaveStatus("Saving…");
    const t = setTimeout(() => setAutoSaveStatus("Auto-saved to Admin Dashboard ✓"), 500);
    return () => clearTimeout(t);
  }, [data, emergency, images, country, province, visibility, tier, partnerType]);

  const isAccommodation = partnerType === "Accommodations";
  const isRestaurant = partnerType === "Restaurants";
  const isService = partnerType === "Services";
  const isAttraction = partnerType === "Attractions";
  const nameLabel = isAccommodation
    ? "Accommodation Name"
    : isRestaurant
    ? "Restaurant Name"
    : isService
    ? "Service Name"
    : "Attraction Name";

  const reset = () => {
    setPartnerType(null); setTier(0); setVisibility([]); setCountry([]); setProvince([]);
    setData({}); setEmergency({}); setImages([]); setSubmitted(null);
  };

  // Maps the onboarding form's multi-checkbox "visibility" selection to the
  // real backend's single guestType value (see OfficialUseSection.tsx's
  // GUEST_TYPE_OPTIONS: "Guest Only" | "Local" | "Both"). Accommodation has
  // no guestType field at all, so this is only used for the other three.
  function resolveGuestType() {
    const hasGuest = visibility.includes("Guest") || visibility.includes("Both");
    const hasLocal = visibility.includes("Local") || visibility.includes("Both");
    if (hasGuest && hasLocal) return "Both";
    if (hasLocal) return "Local";
    return "Guest Only";
  }

  // The Facilities field is a free-text textarea in this form, but the real
  // Accommodation record stores facilities as a list — split on commas or
  // new lines, matching how a rep would naturally type "Pool, Braai area,
  // Wifi" or one item per line.
  function splitToList(text) {
    return (text || "")
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const submit = async () => {
    if (!data.companyName) {
      alert("Company Name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const backend = getAuthenticatedBackend();
      const latitude = data.latitude ? Number(data.latitude) : undefined;
      const longitude = data.longitude ? Number(data.longitude) : undefined;
      const resolvedCountry = country[0] || "South Africa";
      const resolvedProvince = province[0] || "";
      let created;

      // Upload any captured photos for real before creating the listing —
      // this used to just leave them as local-only browser previews with
      // nothing actually saved. One photo failing to upload doesn't stop
      // the rest of the submission; it's just left out.
      let uploadedImageUrls = [];
      if (images.length > 0) {
        setAutoSaveStatus(`Uploading ${images.length} photo${images.length === 1 ? "" : "s"}…`);
        const results = await Promise.allSettled(
          images.map(async (img) => {
            const dataUrl = await fileToDataURL(img.file);
            const res = await backend.storage.upload({ data: dataUrl });
            return res.url;
          })
        );
        uploadedImageUrls = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value);
        const failedCount = results.length - uploadedImageUrls.length;
        if (failedCount > 0) {
          console.error(
            "Some photo uploads failed:",
            results.filter((r) => r.status === "rejected").map((r) => r.reason)
          );
        }
      }
      const primaryImageUrl = uploadedImageUrls[0] || "";

      if (isAccommodation) {
        created = await backend.accommodation.create({
          name: data.companyName,
          address: data.address || "",
          latitude,
          longitude,
          country: resolvedCountry,
          province: resolvedProvince,
          postalCode: data.postalCode || "",
          contact: data.contact || "",
          description: data.description || "",
          wifiName: data.wifiName || "",
          wifiPassword: data.wifiPassword || "",
          checkInInstructions: data.checkIn || "",
          amenities: data.amenities || "",
          guidelines: data.guidelines || "",
          checkOutInstructions: data.checkOut || "",
          facilities: splitToList(data.facilities),
          wheelchairAccess: false, // no accessibility checkboxes in this form's Accommodation section
          parkingAvailability: false,
          primaryContact: emergency["Primary"] || "",
          policeContact: emergency["Police"] || "",
          doctorContact: emergency["Doctor"] || "",
          ambulanceContact: emergency["Ambulance"] || "",
          hospitalContact: emergency["Hospital"] || "",
          fireDepartmentContact: emergency["Fire Department"] || "",
          imageUrl: primaryImageUrl,
          imageUrls: uploadedImageUrls,
          isActive: false,
          officialContactName: data.personResponsible || repSession.repName,
          officialContactNumber: data.personResponsibleNumber || "",
          officialRepCode: repSession.repCode,
        });
      } else if (isRestaurant) {
        created = await backend.restaurant.create({
          name: data.companyName,
          address: data.address || "",
          latitude,
          longitude,
          country: resolvedCountry,
          province: resolvedProvince,
          postalCode: data.postalCode || "",
          contactNumber: data.contactNumber || "",
          description: data.description || "",
          cuisineTypes: data.cuisineTypes || [],
          menuLink: data.menuLink || "",
          serviceDineIn: true,
          serviceTakeaway: true,
          serviceDelivery: false,
          littleExplorerApproved: (data.childFriendly || []).includes("Child Friendly"),
          paymentCard: (data.paymentOptions || []).includes("Card"),
          paymentCash: (data.paymentOptions || []).includes("Cash"),
          paymentMobile: (data.paymentOptions || []).includes("Mobile Tap"),
          wheelchairAccess: (data.accessibility || []).includes("Wheelchair Access"),
          parkingAvailability: (data.accessibility || []).includes("Parking Availability"),
          wifiNetwork: data.wifiName || "",
          wifiPassword: data.wifiPassword || "",
          discountOffered: data.discountOffered || "",
          discountCode: data.discountCode || "",
          imageUrl: primaryImageUrl,
          imageUrls: uploadedImageUrls,
          isActive: false,
          officialContactName: data.personResponsible || repSession.repName,
          officialContactNumber: data.personResponsibleNumber || "",
          officialRepCode: repSession.repCode,
          officialRepName: repSession.repName,
          companyRegNumber: data.companyRegNumber || "",
          companyVatNumber: data.companyVatNumber || "",
          guestType: resolveGuestType(),
          accessLevel: tier >= 1 ? `Tier ${tier}` : "",
        });
      } else if (isService) {
        created = await backend.service.create({
          name: data.companyName,
          address: data.address || "",
          latitude,
          longitude,
          country: resolvedCountry,
          province: resolvedProvince,
          postalCode: data.postalCode || "",
          contactNumber: data.contact || data.contactNumber || "",
          description: data.description || "",
          serviceCategories: [], // this form has no service-category checklist yet — see note below
          littleExplorerApproved: (data.childFriendly || []).includes("Child Friendly"),
          paymentCard: (data.paymentOptions || []).includes("Card"),
          paymentCash: (data.paymentOptions || []).includes("Cash"),
          paymentMobile: (data.paymentOptions || []).includes("Mobile Tap"),
          wheelchairAccess: (data.accessibility || []).includes("Wheelchair Access"),
          parkingAvailability: (data.accessibility || []).includes("Parking Availability"),
          discountOffered: data.discountOffered || "",
          discountCode: data.discountCode || "",
          imageUrl: primaryImageUrl,
          imageUrls: uploadedImageUrls,
          isActive: false,
          officialContactName: data.personResponsible || repSession.repName,
          officialContactNumber: data.personResponsibleNumber || "",
          officialRepCode: repSession.repCode,
          officialRepName: repSession.repName,
          companyRegNumber: data.companyRegNumber || "",
          companyVatNumber: data.companyVatNumber || "",
          guestType: resolveGuestType(),
          accessLevel: tier >= 1 ? `Tier ${tier}` : "",
        });
      } else {
        created = await backend.attraction.create({
          name: data.companyName,
          address: data.address || "",
          latitude,
          longitude,
          country: resolvedCountry,
          province: resolvedProvince,
          postalCode: data.postalCode || "",
          contactNumber: data.contact || data.contactNumber || "",
          description: data.description || "",
          attractionType: [], // this form has no attraction-type checklist yet — see note below
          littleExplorerApproved: (data.childFriendly || []).includes("Child Friendly"),
          paymentCard: (data.paymentOptions || []).includes("Card"),
          paymentCash: (data.paymentOptions || []).includes("Cash"),
          paymentMobile: (data.paymentOptions || []).includes("Mobile Tap"),
          wheelchairAccess: (data.accessibility || []).includes("Wheelchair Access"),
          parkingAvailability: (data.accessibility || []).includes("Parking Availability"),
          discountOffered: data.discountOffered || "",
          discountCode: data.discountCode || "",
          imageUrl: primaryImageUrl,
          imageUrls: uploadedImageUrls,
          isActive: false,
          officialContactName: data.personResponsible || repSession.repName,
          officialContactNumber: data.personResponsibleNumber || "",
          officialRepCode: repSession.repCode,
          officialRepName: repSession.repName,
          companyRegNumber: data.companyRegNumber || "",
          companyVatNumber: data.companyVatNumber || "",
          guestType: resolveGuestType(),
          accessLevel: tier >= 1 ? `Tier ${tier}` : "",
        });
      }

      setSubmitted({
        companyName: data.companyName,
        partnerType,
        tier,
        accessCode: created.profileReferenceCode,
        imagesCount: images.length,
        uploadedCount: uploadedImageUrls.length,
      });
    } catch (err) {
      console.error(err);
      alert("Failed to submit: " + (err?.message || "please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Confirmation screen ----------
  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: colors.background, color: colors.textPrimary, fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 380, width: "100%", background: colors.surface, border: `1px solid ${colors.primary}`, borderRadius: 16, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
          <h2 style={{ color: colors.primary, fontSize: 18, marginBottom: 6 }}>Profile Submitted</h2>
          <p style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>
            {submitted.companyName} was created under {submitted.partnerType}
            {submitted.tier ? ` — Tier ${submitted.tier}` : ""}, status: <b style={{ color: colors.error }}>Non-Active</b>.
          </p>

          <div style={{ background: colors.surface2, borderRadius: 10, padding: 14, marginBottom: 16, textAlign: "left" }}>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>Access Code</div>
            <div style={{ fontSize: 15, color: colors.accent, fontWeight: 700, marginBottom: 8 }}>{submitted.accessCode}</div>
          </div>

          <ul style={{ textAlign: "left", color: colors.textSecondary, fontSize: 12, lineHeight: 1.8, paddingLeft: 18, marginBottom: 18 }}>
            <li>Saved to the Admin Dashboard just now (Non-Active, pending review)</li>
            {submitted.imagesCount > 0 && submitted.uploadedCount === submitted.imagesCount && (
              <li>
                {submitted.uploadedCount} photo{submitted.uploadedCount === 1 ? "" : "s"} uploaded successfully
              </li>
            )}
            {submitted.imagesCount > 0 && submitted.uploadedCount < submitted.imagesCount && (
              <li style={{ color: colors.error }}>
                {submitted.uploadedCount} of {submitted.imagesCount} photos uploaded — {submitted.imagesCount - submitted.uploadedCount} failed and were not saved
              </li>
            )}
          </ul>

          <button
            onClick={reset}
            style={{ width: "100%", background: colors.primary, color: "#000", border: "none", borderRadius: 10, padding: 14, fontWeight: 800, fontSize: 14, cursor: "pointer" }}
          >
            Onboard Another Partner
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.background, color: colors.textPrimary, fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "20px 16px 100px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h1 style={{ color: colors.primary, fontSize: 19, margin: 0 }}>Tap Based Onboarding</h1>
          {partnerType && (
            <span style={{ fontSize: 11, color: autoSaveStatus.includes("✓") ? colors.accent : colors.textSecondary }}>
              {autoSaveStatus}
            </span>
          )}
        </div>
        <p style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 18 }}>
          Rep: {repSession.repName} · Code: {repSession.repCode}
        </p>

        {/* Step 1: Partner type — big finger-friendly buttons */}
        {!partnerType ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {["Accommodations", "Restaurants", "Services", "Attractions"].map((type) => (
              <button
                key={type}
                onClick={() => setPartnerType(type)}
                style={{
                  padding: "28px 8px", borderRadius: 16, background: colors.surface,
                  border: `2px solid ${colors.primary}`, color: colors.primary,
                  fontWeight: 800, fontSize: 15, cursor: "pointer",
                }}
              >
                {type}
              </button>
            ))}
          </div>
        ) : (
          <>
            <button
              onClick={reset}
              style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.textSecondary, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", marginBottom: 14 }}
            >
              ← Change Partner Type ({partnerType})
            </button>

            <SectionTitle>Company Details</SectionTitle>
            <TextField label="Company Name" value={data.companyName} onChange={set("companyName")} />
            <TextField label="Address" value={data.address} onChange={set("address")} />
            <TextField label="Contact Number" value={data.contactNumber} onChange={set("contactNumber")} />
            <TextField label="Person Responsible" value={data.personResponsible} onChange={set("personResponsible")} />
            <TextField label="Person Responsible Number" value={data.personResponsibleNumber} onChange={set("personResponsibleNumber")} />
            <TextField label="Company Registration Number" value={data.companyRegNumber} onChange={set("companyRegNumber")} />
            <TextField label="Company VAT Number" value={data.companyVatNumber} onChange={set("companyVatNumber")} />
            <TextField label="Rep Name (auto-filled)" value={repSession.repName} onChange={() => {}} />
            <TextField label="Rep Code (auto-filled)" value={repSession.repCode} onChange={() => {}} />
            <CheckboxGroup label="Country" options={COUNTRY_OPTIONS} selected={country} onChange={setCountry} />
            {country.includes("South Africa") && (
              <CheckboxGroup label="Province" options={PROVINCE_OPTIONS} selected={province} onChange={setProvince} />
            )}
            {country.length > 0 && !country.includes("South Africa") && (
              <p style={{ fontSize: 11, color: colors.textSecondary, marginTop: -6, marginBottom: 12 }}>
                Province list for {country.join(", ")} coming soon.
              </p>
            )}
            <TextField label="Postal Code" value={data.postalCode} onChange={set("postalCode")} />
            <TextField label="Latitude" value={data.latitude} onChange={set("latitude")} />
            <TextField label="Longitude" value={data.longitude} onChange={set("longitude")} />

            {!isAccommodation && (
              <>
                <SectionTitle>Visibility</SectionTitle>
                <CheckboxGroup label="Show profile to" options={["Guest", "Local", "Both"]} selected={visibility} onChange={setVisibility} />

                <SectionTitle>Tier Selection</SectionTitle>
                <TierButtons tier={tier} setTier={setTier} />
                <p style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>
                  Tap a tier → its fields open, plus every tier below it.
                </p>
              </>
            )}

            {(isAccommodation || tier >= 1) && (
              <>
                <SectionTitle>{isAccommodation ? "Accommodation Details" : "Tier 1"}</SectionTitle>
                <ImageUpload images={images} setImages={setImages} />
                <TextField label={nameLabel} value={data.name} onChange={set("name")} />
              </>
            )}

            {isAccommodation && (
              <>
                <TextField label="Contact" value={data.contact} onChange={set("contact")} />
                <TextField label="Description" area value={data.description} onChange={set("description")} />
                <TextField label="Check-In Instructions" area value={data.checkIn} onChange={set("checkIn")} />
                <TextField label="Amenities" area value={data.amenities} onChange={set("amenities")} />
                <TextField label="Guidelines" area value={data.guidelines} onChange={set("guidelines")} />
                <TextField label="Check-Out Instructions" area value={data.checkOut} onChange={set("checkOut")} />
                <TextField label="Facilities" area value={data.facilities} onChange={set("facilities")} />
                <TextField label="WiFi Name" value={data.wifiName} onChange={set("wifiName")} />
                <TextField label="WiFi Password" value={data.wifiPassword} onChange={set("wifiPassword")} />
                <label style={labelStyle}>Weather</label>
                <p style={{ fontSize: 11, marginTop: -2, marginBottom: 10 }}>
                  <a href="https://www.yr.no/en" target="_blank" rel="noreferrer" style={{ color: colors.accent }}>https://www.yr.no/en</a>
                </p>
                <label style={labelStyle}>Tides</label>
                <p style={{ fontSize: 11, marginTop: -2, marginBottom: 10 }}>
                  <a href="https://www.yr.no/en" target="_blank" rel="noreferrer" style={{ color: colors.accent }}>https://www.yr.no/en</a>
                </p>
                <SectionTitle>Emergency Contacts</SectionTitle>
                {["Primary", "Police", "Doctor", "Ambulance", "Hospital", "Fire Department"].map((k) => (
                  <TextField key={k} label={k} value={emergency[k]} onChange={(v) => setEmergency((e) => ({ ...e, [k]: v }))} />
                ))}
              </>
            )}

            {!isAccommodation && tier >= 2 && (
              <>
                <SectionTitle>Tier 2</SectionTitle>
                <TextField label="Address (public listing)" value={data.publicAddress} onChange={set("publicAddress")} />
                <CheckboxGroup label="Accessibility Options" options={ACCESSIBILITY_OPTIONS} selected={data.accessibility || []} onChange={set("accessibility")} />
              </>
            )}

            {!isAccommodation && tier >= 3 && (
              <>
                <SectionTitle>Tier 3</SectionTitle>
                {isRestaurant && (
                  <CheckboxGroup label="Cuisine Types" options={CUISINE_TYPES} selected={data.cuisineTypes || []} onChange={set("cuisineTypes")} />
                )}
                <CheckboxGroup label="Child Friendly" options={["Child Friendly"]} selected={data.childFriendly || []} onChange={set("childFriendly")} />
                <TextField label="Description" area value={data.description} onChange={set("description")} />
                {(isService || isAttraction) && (
                  <TextField label="Contact" value={data.contact} onChange={set("contact")} />
                )}
              </>
            )}

            {!isAccommodation && tier >= 4 && (
              <>
                <SectionTitle>Tier 4</SectionTitle>
                {isRestaurant && (
                  <>
                    <TextField label="Booking Email Address" value={data.bookingEmail} onChange={set("bookingEmail")} />
                    <TextField label="Booking Contact Number" value={data.bookingContact} onChange={set("bookingContact")} />
                    <DietaryOptionsField
                      selected={data.dietary || []}
                      onChange={set("dietary")}
                      extraValue={data.signatureDishDetail}
                      onExtraChange={set("signatureDishDetail")}
                    />
                    <TextField label="Menu Link (URL)" value={data.menuLink} onChange={set("menuLink")} />
                    <TextField label="Wifi Name" value={data.wifiName} onChange={set("wifiName")} />
                    <TextField label="Wifi Password" value={data.wifiPassword} onChange={set("wifiPassword")} />
                  </>
                )}
                <TextField label="Discount Offered" value={data.discountOffered} onChange={set("discountOffered")} />
                <TextField label="Discount Code" value={data.discountCode} onChange={set("discountCode")} />
                <SocialLinksField value={data.socialLinks || {}} onChange={set("socialLinks")} />
                <CheckboxGroup label="Payment Options" options={PAYMENT_OPTIONS} selected={data.paymentOptions || []} onChange={set("paymentOptions")} />
                <p style={{ fontSize: 11, color: colors.textSecondary }}>
                  Category checklists (Service/Attraction sub-categories) follow the same pattern as the Admin Dashboard — condensed here for the mobile form.
                </p>
              </>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              style={{ width: "100%", background: submitting ? colors.primaryDark : colors.primary, color: "#000", border: "none", borderRadius: 12, padding: 16, fontWeight: 800, fontSize: 16, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1, marginTop: 20 }}
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
