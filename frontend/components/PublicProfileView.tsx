"use client";

import { useEffect, useState } from "react";
import { currentDashboardPath } from "../lib/dashboard";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Globe, Wifi, Navigation } from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";
import WhatsAppButton from "../components/WhatsAppButton";
import SupportBadge from "../components/SupportBadge";
import WifiConnect from "../components/WifiConnect";

const TYPE_LABEL: Record<string, string> = {
  restaurant: "Restaurant / Takeaway",
  service: "Business / Service",
  attraction: "Attraction / Activity",
  accommodation: "Stay",
};

const GREEN = "#0FB89B";

function asArray(v: any): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : [];
}

// Read-only profile shown when a visitor taps a recommendation in the
// "My Suggestions" banner. Params (type, id, back, backName) come from the URL.
export default function PublicProfileView() {
  const router = useRouter();
  const [entity, setEntity] = useState<any | null>(null);
  const [type, setType] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [back, setBack] = useState("/guest-dashboard"); // replaced at mount by the role-correct default
  const [backName, setBackName] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = (q.get("type") || "").toLowerCase();
    const id = Number(q.get("id") || "0");
    setType(t);
    setBack(q.get("back") || currentDashboardPath());
    setBackName(q.get("backName") || "");
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        let data: any = null;
        if (t === "restaurant") {
          const r: any = await backend.restaurant.list({});
          data = (r.restaurants || []).find((x: any) => Number(x.id) === id);
        } else if (t === "service") {
          const r: any = await backend.service.list({});
          data = (r.services || []).find((x: any) => Number(x.id) === id);
        } else if (t === "attraction") {
          const r: any = await backend.attraction.list({});
          data = (r.attractions || []).find((x: any) => Number(x.id) === id);
        } else if (t === "accommodation") {
          data = await backend.accommodation.get({ id });
        }
        if (!data) setNotFound(true);
        else setEntity(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const goBack = () => router.push(back);

  const BackBar = (
    <button
      type="button"
      onClick={goBack}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 14px",
        borderRadius: 999,
        border: `2px solid ${GREEN}`,
        background: "#000",
        color: GREEN,
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
        marginBottom: 14,
      }}
    >
      <ArrowLeft className="h-4 w-4" />
      {backName ? `Back to ${backName}` : "Back"}
    </button>
  );

  const wrap: React.CSSProperties = { minHeight: "100vh", background: "#0a0a0a", padding: "20px 12px" };
  const card: React.CSSProperties = {
    maxWidth: 640,
    margin: "0 auto",
    background: "#111",
    color: "#d5d8d5",
    borderRadius: 14,
    padding: "18px 18px 24px",
    border: "1px solid rgba(15,184,155,0.25)",
  };

  if (loading) {
    return (
      <div style={wrap}>
        <div style={card}>Loading…</div>
      </div>
    );
  }
  if (notFound || !entity) {
    return (
      <div style={wrap}>
        <div style={card}>
          {BackBar}
          <p style={{ color: "#a0a0a0" }}>Sorry, that listing couldn’t be found — it may have been removed.</p>
        </div>
      </div>
    );
  }

  const name = entity.name || "";
  const contact = entity.contactNumber || entity.primaryContact || "";
  const worksFromClient = !!entity.worksFromClientAddress;
  const addressParts = [worksFromClient ? "" : entity.address, entity.area, entity.province].filter((x: any) => x && String(x).trim());
  const address = addressParts.join(", ");
  const mapsQuery = encodeURIComponent(address || name);

  const tagGroups: { label: string; items: string[] }[] = [
    { label: "Type", items: asArray(entity.restaurantType) },
    { label: "Cuisine", items: asArray(entity.cuisineTypes) },
    { label: "Atmosphere", items: asArray(entity.atmosphere) },
    { label: "Features", items: asArray(entity.features) },
    { label: "Dietary", items: asArray(entity.dietary) },
    { label: "Categories", items: (entity as any).isNonProfit ? [] : asArray(entity.serviceCategories) },
    { label: "Categories", items: asArray(entity.attractionType) },
    { label: "Facilities", items: asArray(entity.facilities) },
    { label: "Amenities", items: asArray(entity.amenities) },
  ].filter((g) => g.items.length);

  const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: GREEN, margin: "16px 0 6px" };
  const linkBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(15,184,155,0.4)",
    color: GREEN,
    background: "transparent",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
  };

  const guestDisc = entity.discountOffered || entity.discount || "";
  const localDisc = entity.localDiscountOffered || "";

  return (
    <div style={wrap}>
      <div style={card}>
        {BackBar}

        {entity.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entity.imageUrl}
            alt={name}
            style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10, marginBottom: 12 }}
          />
        ) : null}

        <div style={{ fontSize: 12, color: "#8a8f96", fontWeight: 600 }}>{TYPE_LABEL[type] || ""}</div>
        <h1 style={{ color: "#fff", fontSize: 22, margin: "2px 0 6px" }}>{name}</h1>
        {entity.supportOrgName ? (
          <div style={{ margin: "0 0 8px" }}><SupportBadge orgName={entity.supportOrgName} /></div>
        ) : null}
        {(entity as any).isNonProfit && (((entity as any).npoNumber || (entity as any).pboNumber)) ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 13, color: "#b9beb9", margin: "0 0 8px" }}>
            {(entity as any).npoNumber ? <span>NPO: {(entity as any).npoNumber}</span> : null}
            {(entity as any).pboNumber ? <span>PBO: {(entity as any).pboNumber}</span> : null}
          </div>
        ) : null}

        {address ? (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, color: "#b9beb9", fontSize: 13 }}>
            <MapPin className="h-4 w-4" style={{ color: GREEN, flexShrink: 0, marginTop: 2 }} />
            <span>{address}</span>
          </div>
        ) : null}
        {worksFromClient ? (
          <div style={{ color: "#8a8f96", fontSize: 13, fontStyle: "italic", marginTop: 4 }}>
            Travels to you — no fixed address.
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {contact ? (
            <a href={`tel:${contact}`} style={linkBtn}>
              <Phone className="h-4 w-4" /> Call
            </a>
          ) : null}
          {contact ? <WhatsAppButton number={contact} /> : null}
          {address && !worksFromClient ? (
            <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noopener noreferrer" style={linkBtn}>
              <Navigation className="h-4 w-4" /> Directions
            </a>
          ) : null}
        </div>

        {entity.description ? (
          <>
            <div style={sectionTitle}>About</div>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "#cfd3cf", whiteSpace: "pre-wrap" }}>{entity.description}</p>
          </>
        ) : null}

        {entity.tradingHours ? (
          <>
            <div style={sectionTitle}>Trading hours</div>
            <p style={{ fontSize: 14, color: "#cfd3cf", whiteSpace: "pre-wrap" }}>{entity.tradingHours}</p>
          </>
        ) : null}

        {(guestDisc || localDisc) ? (
          <>
            <div style={sectionTitle}>Around You offers</div>
            {guestDisc ? <p style={{ fontSize: 14, color: "#cfd3cf", margin: "2px 0" }}>Guests: {guestDisc}</p> : null}
            {localDisc ? <p style={{ fontSize: 14, color: "#cfd3cf", margin: "2px 0" }}>Locals: {localDisc}</p> : null}
          </>
        ) : null}

        {tagGroups.map((g, i) => (
          <div key={`${g.label}-${i}`}>
            <div style={sectionTitle}>{g.label}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {g.items.map((it) => (
                <span
                  key={it}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(15,184,155,0.15)",
                    color: "#eafff8",
                    fontSize: 12,
                  }}
                >
                  {it}
                </span>
              ))}
            </div>
          </div>
        ))}

        {entity.wifiName ? (
          <>
            <div style={sectionTitle}>Wi-Fi</div>
            <WifiConnect name={entity.wifiName} password={entity.wifiPassword} />
          </>
        ) : null}

        {entity.website || entity.facebook || entity.instagram ? (
          <>
            <div style={sectionTitle}>Links</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {entity.website ? (
                <a href={entity.website} target="_blank" rel="noopener noreferrer" style={linkBtn}>
                  <Globe className="h-4 w-4" /> Website
                </a>
              ) : null}
              {entity.facebook ? (
                <a href={entity.facebook} target="_blank" rel="noopener noreferrer" style={linkBtn}>
                  Facebook
                </a>
              ) : null}
              {entity.instagram ? (
                <a href={entity.instagram} target="_blank" rel="noopener noreferrer" style={linkBtn}>
                  Instagram
                </a>
              ) : null}
            </div>
          </>
        ) : null}

        <div style={{ marginTop: 22 }}>{BackBar}</div>
      </div>
    </div>
  );
}
