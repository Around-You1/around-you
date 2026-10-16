"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ChevronRight } from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";

type SItem = { type: string; id: number; name: string };

const TYPE_LABEL: Record<string, string> = {
  restaurant: "Restaurant / Takeaway",
  service: "Business / Service",
  attraction: "Attraction / Activity",
  accommodation: "Stay",
};

// SuggestionsBanner shows the "My Suggestions" strip at the top of a profile.
// ownerType/ownerId identify whose profile is being viewed; backName is that
// profile's display name, carried to the destination so its Back button can
// read "Back to <name>". Renders nothing when the profile has no suggestions.
export default function SuggestionsBanner({
  ownerType,
  ownerId,
  backName,
}: {
  ownerType: string;
  ownerId: number;
  backName: string;
}) {
  const [items, setItems] = useState<SItem[]>([]);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    if (!ownerType || !ownerId) return;
    getAuthenticatedBackend()
      .suggestions.get({ ownerType, ownerId })
      .then((r: any) => {
        if (alive) setItems(Array.isArray(r?.items) ? r.items : []);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [ownerType, ownerId]);

  if (!items.length) return null;

  const open = (it: SItem) => {
    let dash = "/guest-dashboard";
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      dash = u?.role === "Partner" ? "/partner-dashboard" : "/guest-dashboard";
    } catch {
      /* default guest */
    }
    const q = new URLSearchParams({
      type: it.type,
      id: String(it.id),
      back: dash,
      backName: backName || "",
    });
    router.push("/view?" + q.toString());
  };

  return (
    <div
      style={{
        border: "1px solid rgba(15,184,155,0.4)",
        background: "linear-gradient(135deg, rgba(15,184,155,0.12), rgba(57,255,20,0.06))",
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Sparkles className="h-4 w-4" style={{ color: "#0FB89B" }} />
        <span style={{ fontWeight: 800, fontSize: 14, color: "#0FB89B" }}>My Suggestions</span>
        <span style={{ fontSize: 11, color: "#8a8f96" }}>— places we recommend nearby</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((it) => (
          <button
            key={`${it.type}:${it.id}`}
            type="button"
            onClick={() => open(it)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(15,184,155,0.5)",
              background: "rgba(0,0,0,0.25)",
              color: "#eafff8",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
            title={TYPE_LABEL[it.type] || it.type}
          >
            {it.name}
            <ChevronRight className="h-3.5 w-3.5" style={{ color: "#0FB89B" }} />
          </button>
        ))}
      </div>
    </div>
  );
}
