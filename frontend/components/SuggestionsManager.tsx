"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, Search, Check, X } from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";

type SItem = { type: string; id: number; name: string };

const TYPE_LABEL: Record<string, string> = {
  restaurant: "Restaurant / Takeaway",
  service: "Business / Service",
  attraction: "Attraction / Activity",
  accommodation: "Stay",
  retail: "Retail",
  nonprofit: "NPO / PBO",
};

const GREEN = "#0FB89B";
const MAX = 10;

const keyOf = (i: { type: string; id: number }) => `${i.type}:${i.id}`;

// SuggestionsManager lets an owner pick up to 10 nearby businesses (within 50km)
// to recommend on their profile. editCode authorises the save for non-Partner
// owners (e.g. accommodations); a Partner session is authorised server-side too.
export default function SuggestionsManager({
  ownerType,
  ownerId,
  editCode,
  onClose,
}: {
  ownerType: string;
  ownerId: number;
  editCode: string;
  onClose?: () => void;
}) {
  const [nearby, setNearby] = useState<SItem[]>([]);
  const [selected, setSelected] = useState<SItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const [n, cur]: any = await Promise.all([
          backend.suggestions.nearby({ ownerType, ownerId }),
          backend.suggestions.get({ ownerType, ownerId }),
        ]);
        if (!alive) return;
        setNearby(Array.isArray(n?.items) ? n.items : []);
        setSelected(Array.isArray(cur?.items) ? cur.items : []);
      } catch (e: any) {
        if (alive) setStatus("Couldn’t load nearby businesses: " + (e?.message || "please try again."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ownerType, ownerId]);

  const selectedKeys = useMemo(() => new Set(selected.map(keyOf)), [selected]);

  // Candidates = nearby plus any already-selected that fell outside the list,
  // filtered by the search box.
  const candidates = useMemo(() => {
    const map = new Map<string, SItem>();
    for (const s of selected) map.set(keyOf(s), s);
    for (const n of nearby) if (!map.has(keyOf(n))) map.set(keyOf(n), n);
    let list = Array.from(map.values());
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q) || (TYPE_LABEL[i.type] || "").toLowerCase().includes(q));
    return list;
  }, [nearby, selected, search]);

  const toggle = (it: SItem) => {
    setStatus("");
    setSelected((cur) => {
      const has = cur.some((c) => keyOf(c) === keyOf(it));
      if (has) return cur.filter((c) => keyOf(c) !== keyOf(it));
      if (cur.length >= MAX) {
        setStatus(`You can recommend up to ${MAX} businesses — remove one first.`);
        return cur;
      }
      return [...cur, it];
    });
  };

  const save = async () => {
    setSaving(true);
    setStatus("");
    try {
      const backend = getAuthenticatedBackend();
      const res: any = await backend.suggestions.save({
        ownerType,
        ownerId,
        editCode,
        items: selected.map((s) => ({ type: s.type, id: s.id })),
      });
      setStatus(`✓ Saved ${res?.saved ?? selected.length} suggestion${(res?.saved ?? selected.length) === 1 ? "" : "s"}.`);
    } catch (e: any) {
      setStatus("Couldn’t save: " + (e?.message || "please try again."));
    } finally {
      setSaving(false);
    }
  };

  const panel: React.CSSProperties = {
    border: "1px solid rgba(15,184,155,0.4)",
    background: "#0f1512",
    borderRadius: 12,
    padding: 14,
  };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px 9px 34px",
    border: "1px solid rgba(15,184,155,0.3)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    borderRadius: 8,
    fontSize: 14,
    boxSizing: "border-box",
  };

  return (
    <div style={panel}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles className="h-4 w-4" style={{ color: GREEN }} />
          <span style={{ fontWeight: 800, fontSize: 15, color: GREEN }}>My Recommendations</span>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", color: "#8a8f96", cursor: "pointer" }}>
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <p style={{ fontSize: 12, color: "#9aa39a", margin: "0 0 10px" }}>
        Recommend up to {MAX} other businesses within 50km. They appear in a banner at the top of your profile; visitors can tap through and come straight back to you.
      </p>

      {loading ? (
        <p style={{ color: "#9aa39a", fontSize: 13 }}>Loading nearby businesses…</p>
      ) : (
        <>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search className="h-4 w-4" style={{ position: "absolute", left: 10, top: 10, color: "#6f766f" }} />
            <input
              style={input}
              placeholder="Search nearby businesses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ fontSize: 12, color: selected.length >= MAX ? "#e0b050" : "#9aa39a", marginBottom: 8 }}>
            {selected.length} / {MAX} selected
          </div>

          <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {candidates.length === 0 ? (
              <p style={{ color: "#9aa39a", fontSize: 13 }}>No other businesses found within 50km yet.</p>
            ) : (
              candidates.map((it) => {
                const on = selectedKeys.has(keyOf(it));
                return (
                  <button
                    key={keyOf(it)}
                    type="button"
                    onClick={() => toggle(it)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: on ? `1px solid ${GREEN}` : "1px solid rgba(255,255,255,0.08)",
                      background: on ? "rgba(15,184,155,0.12)" : "rgba(255,255,255,0.02)",
                      color: "#e6e9e6",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{it.name}</span>
                      <span style={{ fontSize: 11, color: "#8a8f96" }}>{TYPE_LABEL[it.type] || it.type}</span>
                    </span>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: on ? "none" : "1px solid rgba(255,255,255,0.25)",
                        background: on ? GREEN : "transparent",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {on ? <Check className="h-3.5 w-3.5" style={{ color: "#000" }} /> : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: GREEN,
                color: "#000",
                fontWeight: 800,
                fontSize: 14,
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving…" : "Save suggestions"}
            </button>
            {status ? (
              <span style={{ fontSize: 12, color: status.startsWith("✓") ? GREEN : "#d0a0a0" }}>{status}</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
