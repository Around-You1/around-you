"use client";

// -----------------------------------------------------------------------------
// Real Estate — guest-facing views (PREVIEW).
//
// Public visitors still see a "Coming Soon" placeholder. The real experience
// only renders when the page URL carries ?estate=preview, so the layout can be
// trialled with live Admin data before go-live. Flipping it live later is a
// one-line change (see PREVIEW_ONLY below).
//
// Flow: Agencies list → Agency page (totals + agents + show houses) → Agent page
// (show houses + bio + listings) → Property detail. Data comes from the existing
// /estate/public/* endpoints; nothing is hard-coded.
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAuthenticatedBackend } from "../lib/backend";
import {
  ArrowLeft, Building2, BedDouble, Bath, Car, Ruler, MapPin, Phone,
  ChevronLeft, ChevronRight, CalendarClock, ExternalLink,
} from "lucide-react";

// When Real Estate is ready to go live for everyone, set this to false (or
// remove the preview gate) and the views render for all guests.
const PREVIEW_ONLY = true;

const TEAL = "#00C7BE";
const TEAL_SOFT = "#AEECE4";
const GREEN = "#8FD79A";      // stat pills (matches the app's green buttons)
const GREEN_FG = "#0e3b1d";

// ---- helpers ----------------------------------------------------------------
export function formatPrice(cents: number, listingType: string) {
  const rand = Math.round((cents || 0) / 100);
  const s = "R " + rand.toLocaleString("en-ZA").replace(/,/g, " ");
  return listingType === "rent" ? `${s} / month` : s;
}
function priceLabel(p: any) {
  if (p.priceText) return p.priceText;
  return formatPrice(p.priceCents, p.listingType);
}
function initials(name: string) {
  return (name || "")
    .split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "–";
}
function areaLabel(p: any) {
  const a = p.houseSizeM2 || p.plotSizeM2;
  if (!a) return "";
  return a >= 10000 ? (a / 10000).toFixed(2) + " ha" : a + " m²";
}
function agentsForAgency(agency: any, agents: any[]) {
  return agents.filter(
    (a) => a.agencyId === agency.id || (!a.agencyId && a.agencyName && a.agencyName === agency.name),
  );
}
function telHref(num: string) { return "tel:" + (num || "").replace(/[^\d+]/g, ""); }
function mapsHref(addr: string) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr || ""); }

// ---- placeholders (kept for the standalone /estate/* routes) -----------------
function ComingSoon() {
  return (
    <Card className="border-[#AEECE4]/40">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#AEECE4]/20">
          <Building2 className="h-6 w-6 text-[#00C7BE]" />
        </div>
        <p className="text-lg font-semibold">Real Estate is coming soon</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Our Real Estate section is being redeveloped. Please check back shortly.
        </p>
      </CardContent>
    </Card>
  );
}
function ComingSoonPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/10 to-background">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Button variant="outline" size="sm" className="mb-6" onClick={() => router.back()}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <ComingSoon />
      </div>
    </div>
  );
}

// Retained exports (no longer used by the in-tab flow, kept for compatibility).
export function PropertyCard(_: { p: any }) { return null; }
export function AgentCard(_: { a: any }) { return null; }

// ---- small presentational pieces --------------------------------------------
function Photo({ url, hue = 196, className = "", children }: { url?: string; hue?: number; className?: string; children?: any }) {
  if (url) {
    return (
      <div className={"relative overflow-hidden bg-muted " + className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
        {children}
      </div>
    );
  }
  return (
    <div
      className={"relative overflow-hidden " + className}
      style={{ background: `linear-gradient(135deg, hsl(${hue},42%,62%), hsl(${(hue + 28) % 360},46%,42%))` }}
    >
      <div className="absolute inset-0 grid place-items-center opacity-30">
        <Building2 className="h-10 w-10 text-white" />
      </div>
      {children}
    </div>
  );
}
function AgencyLogo({ a, size = 64 }: { a: any; size?: number }) {
  if (a.imageUrl) {
    return (
      <div className="grid shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.imageUrl} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
      </div>
    );
  }
  return (
    <div className="grid shrink-0 place-items-center rounded-xl font-extrabold" style={{ width: size, height: size, background: TEAL_SOFT, color: "#054b47" }}>
      {initials(a.name)}
    </div>
  );
}

function Badge({ listing }: { listing: string }) {
  const rent = listing === "rent";
  return (
    <span
      className="absolute left-2.5 top-2.5 z-10 rounded-md px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide"
      style={{ background: rent ? "#e08a2b" : TEAL, color: rent ? "#2a1803" : "#042b29" }}
    >
      {rent ? "To Rent" : "For Sale"}
    </span>
  );
}
function Spec({ icon, value }: { icon: any; value: any }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      {icon}<b className="font-semibold text-foreground tabular-nums">{value}</b>
    </span>
  );
}

function PropTile({ p, onOpen }: { p: any; onOpen: () => void }) {
  const img = p.imageUrl || (p.imageUrls && p.imageUrls[0]) || "";
  const nPhotos = (p.imageUrls && p.imageUrls.length) || (p.imageUrl ? 1 : 0);
  const subtitle = [p.propertyType, p.code].filter(Boolean).join(" · ") || p.title || "";
  const hasRooms = p.bedrooms || p.bathrooms || p.garages;
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#8FD79A]"
    >
      <Photo url={img} hue={(p.id * 37) % 360} className="aspect-[4/3] w-full">
        <Badge listing={p.listingType} />
        {nPhotos > 1 && (
          <span className="absolute bottom-2.5 right-2.5 z-10 rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white">
            1 / {nPhotos}
          </span>
        )}
      </Photo>
      <div className="flex flex-col gap-2 px-3.5 pb-3.5 pt-3">
        <div className="text-xl font-extrabold tracking-tight tabular-nums">{priceLabel(p)}</div>
        {subtitle ? <div className="text-sm font-semibold text-muted-foreground">{subtitle}</div> : null}
        {hasRooms ? (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 rounded-xl py-2.5 text-[13px] font-bold" style={{ background: GREEN, color: GREEN_FG }}>
            {p.bedrooms ? <span className="inline-flex items-center gap-1.5"><BedDouble className="h-4 w-4" />Bed {p.bedrooms}</span> : null}
            {p.bathrooms ? <span className="inline-flex items-center gap-1.5"><Bath className="h-4 w-4" />Bath {p.bathrooms}</span> : null}
            {p.garages ? <span className="inline-flex items-center gap-1.5"><Car className="h-4 w-4" />Garage {p.garages}</span> : null}
          </div>
        ) : areaLabel(p) ? (
          <div className="mt-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold" style={{ background: GREEN, color: GREEN_FG }}>
            <Ruler className="h-4 w-4" />{areaLabel(p)}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function PropGrid({ list, onOpen }: { list: any[]; onOpen: (p: any) => void }) {
  if (!list.length) return <p className="text-sm text-muted-foreground">No listings yet.</p>;
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
      {list.map((p) => <PropTile key={p.id} p={p} onOpen={() => onOpen(p)} />)}
    </div>
  );
}

// AgentListings splits an agent's listings into two tabs — "Rentals" (To Rent)
// and "Long Term" (For Sale / plots) — shown above the Listings heading.
function AgentListings({ list, onOpen }: { list: any[]; onOpen: (p: any) => void }) {
  const rentals = list.filter((p) => p.listingType === "rent");
  const longTerm = list.filter((p) => p.listingType !== "rent");
  const [tab, setTab] = useState<"rent" | "long">(longTerm.length ? "long" : "rent");
  const shown = tab === "rent" ? rentals : longTerm;
  const tabCls = (active: boolean) =>
    "rounded-full px-4 py-1.5 text-sm font-bold transition " +
    (active ? "text-[#042b29]" : "bg-muted text-muted-foreground hover:text-foreground");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("rent")} className={tabCls(tab === "rent")} style={tab === "rent" ? { background: TEAL } : undefined}>
          Rentals ({rentals.length})
        </button>
        <button type="button" onClick={() => setTab("long")} className={tabCls(tab === "long")} style={tab === "long" ? { background: TEAL } : undefined}>
          Long Term ({longTerm.length})
        </button>
      </div>
      <h3 className="text-lg font-bold">Listings ({shown.length})</h3>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {tab === "rent" ? "rental" : "long term"} listings yet.</p>
      ) : (
        <PropGrid list={shown} onOpen={onOpen} />
      )}
    </div>
  );
}

// toEmbedUrl turns a YouTube or Vimeo link into its embeddable player URL.
// Returns null for anything it doesn't recognise (shown as a plain link instead).
function toEmbedUrl(raw?: string): string | null {
  const url = (raw || "").trim();
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

// VideoEmbed shows the listing's property video (click-to-play, 16:9). Renders
// nothing when there is no video link.
function VideoEmbed({ url }: { url?: string }) {
  const raw = (url || "").trim();
  if (!raw) return null;
  const embed = toEmbedUrl(raw);
  return (
    <Card><CardContent className="p-4">
      <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">Video</div>
      {embed ? (
        <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden", background: "#000" }}>
          <iframe src={embed} title="Property video" loading="lazy" allowFullScreen
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
        </div>
      ) : (
        <a href={raw} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline" style={{ color: "#0b7a5e" }}>Watch the property video</a>
      )}
    </CardContent></Card>
  );
}

function ShowHouses({ list, agents, showAgent, agencyPhone }: { list: any[]; agents: any[]; showAgent?: boolean; agencyPhone?: string }) {
  if (!list.length) return null;
  return (
    <Card className="border-[#00C7BE]" style={{ background: `linear-gradient(180deg, ${TEAL_SOFT}55, transparent)` }}>
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wider" style={{ background: TEAL, color: "#042b29" }}>
            Show Houses
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">Open viewings this weekend.</p>
        <div className="flex flex-col gap-2.5">
          {list.map((p) => {
            const ag = agents.find((x) => x.id === p.agentId);
            const phone = (ag && ag.contactNumber) || agencyPhone || "";
            const img = p.imageUrl || (p.imageUrls && p.imageUrls[0]) || "";
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg" style={{ background: TEAL, color: "#042b29" }}>
                  <CalendarClock className="h-5 w-5" />
                </div>
                <Photo url={img} hue={(p.id * 37) % 360} className="h-12 w-16 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 basis-[120px]">
                  <div className="truncate text-sm font-semibold">{p.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {priceLabel(p)}{showAgent && ag ? ` · ${ag.name}` : ""}
                  </div>
                </div>
                {phone ? (
                  <a href={telHref(phone)} className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold sm:ml-auto sm:w-auto"
                     style={{ borderColor: TEAL, background: TEAL_SOFT, color: "#054b47" }}>
                    <Phone className="h-3.5 w-3.5" />{phone}
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Gallery({ p }: { p: any }) {
  const imgs: string[] = (p.imageUrls && p.imageUrls.length ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []));
  const [i, setI] = useState(0);
  const n = imgs.length;
  const cur = n ? imgs[i % n] : "";
  return (
    <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
      <Photo url={cur} hue={(p.id * 37) % 360} className="aspect-[16/10] w-full">
        <Badge listing={p.listingType} />
        {n > 1 && (
          <>
            <button aria-label="Previous" onClick={() => setI((v) => (v - 1 + n) % n)}
              className="absolute left-2.5 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-black">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button aria-label="Next" onClick={() => setI((v) => (v + 1) % n)}
              className="absolute right-2.5 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-black">
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-2.5 right-2.5 z-10 rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white">
              {(i % n) + 1} / {n}
            </span>
          </>
        )}
      </Photo>
    </div>
  );
}

// ---- the preview app (embedded in the Guest/Local "Real Estate" tab) ---------
type Nav = { v: "browse" | "agency" | "agent" | "property"; id?: number };

export function EstatePreviewApp() {
  const [db, setDb] = useState<{ agencies: any[]; agents: any[]; properties: any[] } | null>(null);
  const [err, setErr] = useState("");
  const [nav, setNav] = useState<Nav[]>([{ v: "browse" }]);

  useEffect(() => {
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const [a, g, p]: any[] = await Promise.all([
          backend.estate.publicAgencies(),
          backend.estate.publicAgents(),
          backend.estate.publicProperties(),
        ]);
        setDb({
          agencies: a.agencies || [],
          agents: g.agents || [],
          properties: (p.properties || []).filter((x: any) => x.isActive !== false),
        });
      } catch (e: any) {
        setErr(e?.message || "Could not load Real Estate data.");
      }
    })();
  }, []);

  const go = (v: Nav["v"], id?: number) => setNav((s) => [...s, { v, id }]);
  const back = () => setNav((s) => (s.length > 1 ? s.slice(0, -1) : s));

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!db) return <p className="text-sm text-muted-foreground">Loading Real Estate…</p>;

  const top = nav[nav.length - 1];
  const prev = nav[nav.length - 2];
  const findAgency = (id?: number) => db.agencies.find((a) => a.id === id);
  const findAgent = (id?: number) => db.agents.find((a) => a.id === id);
  const findProp = (id?: number) => db.properties.find((p) => p.id === id);

  const backLabel = () => {
    if (!prev) return "Back";
    if (prev.v === "browse") return "Agencies";
    if (prev.v === "agency") return findAgency(prev.id)?.name || "Agency";
    if (prev.v === "agent") return findAgent(prev.id)?.name || "Agent";
    return "Back";
  };
  const BackBtn = () => (
    <button onClick={back} className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-semibold hover:border-[#00C7BE]">
      <ChevronLeft className="h-4 w-4" /> Back to {backLabel()}
    </button>
  );

  // ---- BROWSE ----
  if (top.v === "browse") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Agencies</h3>
          <span className="text-sm text-muted-foreground">{db.agencies.length} agenc{db.agencies.length === 1 ? "y" : "ies"}</span>
        </div>
        <p className="-mt-1 text-sm text-muted-foreground">Choose an agency, then one of its agents, to see their listings.</p>
        {db.agencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agencies yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {db.agencies.map((a) => {
              const aAgentIds = new Set(agentsForAgency(a, db.agents).map((x: any) => x.id));
              const nProps = db.properties.filter((p) => p.agencyId === a.id || aAgentIds.has(p.agentId)).length;
              const nAgents = agentsForAgency(a, db.agents).length;
              return (
                <button key={a.id} onClick={() => go("agency", a.id)}
                  className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-[#8FD79A]">
                  <div className="flex items-start gap-4">
                    <AgencyLogo a={a} />
                    <div className="min-w-0 flex-1 self-center text-lg font-extrabold leading-snug tracking-tight">{a.name}</div>
                  </div>
                  {a.address ? (
                    <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />{a.address}
                    </div>
                  ) : null}
                  <div className="mt-3 w-full rounded-xl py-2.5 text-center text-sm font-bold" style={{ background: GREEN, color: GREEN_FG }}>
                    {nProps} listing{nProps === 1 ? "" : "s"} – {nAgents} agent{nAgents === 1 ? "" : "s"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <p className="pt-2 text-center text-xs text-muted-foreground">Preview — not visible to the public yet.</p>
      </div>
    );
  }

  // ---- AGENCY ----
  if (top.v === "agency") {
    const a = findAgency(top.id);
    if (!a) return (<><BackBtn /><p className="text-sm text-muted-foreground">Agency not found.</p></>);
    const ags = agentsForAgency(a, db.agents);
    const agentIds = new Set(ags.map((x: any) => x.id));
    const props = db.properties.filter((p) => p.agencyId === a.id || agentIds.has(p.agentId));
    const sh = props.filter((p) => p.showHouse);
    return (
      <div className="space-y-4">
        <BackBtn />
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <AgencyLogo a={a} size={64} />
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold tracking-tight">{a.name}</h2>
                {a.address ? <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{a.address}</div> : null}
              </div>
            </div>
            {a.description ? <p className="mt-3 text-sm">{a.description}</p> : null}
            {(a.contactNumber || a.email) ? (
              <div className="mt-2 text-sm text-muted-foreground">
                {a.contactNumber ? <>Phone <span className="select-all text-foreground">{a.contactNumber}</span></> : null}
                {a.contactNumber && a.email ? " · " : null}
                {a.email ? <>Email <span className="select-all text-foreground">{a.email}</span></> : null}
              </div>
            ) : null}
            <div className="mt-3.5 flex flex-wrap gap-2.5">
              {[["Listings", props.length], ["Rentals", props.filter((p) => p.listingType === "rent").length], ["Long Term", props.filter((p) => p.listingType !== "rent").length], ["Agent" + (ags.length === 1 ? "" : "s"), ags.length], ["Show houses", sh.length]].map(([l, n]) => (
                <div key={l as string} className="min-w-[100px] flex-1 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
                  <div className="text-xl font-extrabold tabular-nums">{n as number}</div>
                  <div className="text-[11.5px] uppercase tracking-wide text-muted-foreground">{l as string}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <ShowHouses list={sh} agents={db.agents} showAgent agencyPhone={a.contactNumber} />

        <h3 className="text-lg font-bold">Our agents</h3>
        {ags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agents yet.</p>
        ) : (
          <>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
              {ags.map((ag) => {
                const nL = db.properties.filter((p) => p.agentId === ag.id).length;
                return (
                  <button key={ag.id} onClick={() => go("agent", ag.id)}
                    className="flex items-stretch gap-3.5 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition hover:border-[#8FD79A]">
                    {ag.photoUrl ? (
                      <div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ag.photoUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                      </div>
                    ) : (
                      <div className="grid h-28 w-24 shrink-0 place-items-center rounded-xl text-2xl font-extrabold" style={{ background: TEAL_SOFT, color: "#054b47" }}>{initials(ag.name)}</div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                      <div className="text-lg font-extrabold leading-tight">{ag.name}</div>
                      <div className="text-sm text-muted-foreground">{ag.province || ag.agencyName || ""}</div>
                      <div className="w-full rounded-xl py-2 text-center text-sm font-bold" style={{ background: GREEN, color: GREEN_FG }}>
                        {nL} listing{nL === 1 ? "" : "s"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">Select an agent to view their listings.</p>
          </>
        )}
      </div>
    );
  }

  // ---- AGENT ----
  if (top.v === "agent") {
    const ag = findAgent(top.id);
    if (!ag) return (<><BackBtn /><p className="text-sm text-muted-foreground">Agent not found.</p></>);
    const agency = findAgency(ag.agencyId) || db.agencies.find((x) => x.name === ag.agencyName);
    const props = db.properties.filter((p) => p.agentId === ag.id);
    const sh = props.filter((p) => p.showHouse);
    return (
      <div className="space-y-4">
        <BackBtn />
        <ShowHouses list={sh} agents={db.agents} agencyPhone={agency?.contactNumber} />
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              {ag.photoUrl ? (
                <Photo url={ag.photoUrl} className="h-20 w-20 shrink-0 rounded-full" />
              ) : (
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full text-2xl font-extrabold" style={{ background: TEAL_SOFT, color: "#054b47" }}>{initials(ag.name)}</div>
              )}
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold tracking-tight">{ag.name}</h2>
                <div className="mt-0.5 text-sm text-muted-foreground">{[ag.province, agency?.name || ag.agencyName].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            {ag.bio ? <p className="mt-3 text-sm">{ag.bio}</p> : null}
            {(ag.contactNumber || ag.email) ? (
              <div className="mt-2 text-sm text-muted-foreground">
                {ag.contactNumber ? <>Phone <span className="select-all text-foreground">{ag.contactNumber}</span></> : null}
                {ag.contactNumber && ag.email ? " · " : null}
                {ag.email ? <>Email <span className="select-all text-foreground">{ag.email}</span></> : null}
              </div>
            ) : null}
            {ag.contactNumber ? (
              <a href={telHref(ag.contactNumber)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold" style={{ background: TEAL, color: "#042b29" }}>
                <Phone className="h-4 w-4" /> Call {ag.name.split(" ")[0]}
              </a>
            ) : null}
          </CardContent>
        </Card>
        <AgentListings list={props} onOpen={(p) => go("property", p.id)} />
      </div>
    );
  }

  // ---- PROPERTY ----
  if (top.v === "property") {
    const p = findProp(top.id);
    if (!p) return (<><BackBtn /><p className="text-sm text-muted-foreground">Listing not found.</p></>);
    const ag = findAgent(p.agentId);
    const agency = findAgency(p.agencyId);
    const contactPhone = (ag && ag.contactNumber) || agency?.contactNumber || "";
    const specs: [string, any][] = [];
    specs.push(["Type", p.propertyType || "—"]);
    specs.push(["Listing", p.listingType === "rent" ? "To Rent" : "For Sale"]);
    if (p.bedrooms) specs.push(["Bedrooms", p.bedrooms]);
    if (p.bathrooms) specs.push(["Bathrooms", p.bathrooms]);
    if (p.garages) specs.push(["Garages", p.garages]);
    if (p.houseSizeM2) specs.push(["Floor size", p.houseSizeM2 + " m²"]);
    if (p.plotSizeM2) specs.push(["Plot size", p.plotSizeM2 >= 10000 ? (p.plotSizeM2 / 10000).toFixed(2) + " ha" : p.plotSizeM2 + " m²"]);
    return (
      <div className="space-y-4">
        <BackBtn />
        <div className="grid gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-4" style={{ minWidth: 0 }}>
            <Gallery p={p} />
            <VideoEmbed url={p.videoUrl} />
            <Card><CardContent className="p-4">
              <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">Description</div>
              <p className="whitespace-pre-line text-sm">{p.description || "No description provided."}</p>
              {p.features && p.features.length ? (
                <>
                  <div className="mb-2 mt-4 text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">Features</div>
                  <div className="flex flex-wrap gap-2">
                    {p.features.map((f: string) => (
                      <span key={f} className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: TEAL_SOFT, color: "#054b47" }}>{f}</span>
                    ))}
                  </div>
                </>
              ) : null}
            </CardContent></Card>
          </div>
          <div className="space-y-4" style={{ minWidth: 0 }}>
            <Card><CardContent className="p-4">
              <span className="inline-block rounded-md px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide" style={{ background: p.listingType === "rent" ? "#e08a2b" : TEAL, color: p.listingType === "rent" ? "#2a1803" : "#042b29" }}>
                {p.listingType === "rent" ? "To Rent" : "For Sale"}
              </span>
              <h2 className="mt-2 text-xl font-extrabold tracking-tight">{p.title}</h2>
              {p.address ? <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{p.address}</div> : null}
              <div className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums">{priceLabel(p)}</div>
              <div className="mt-3.5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
                {specs.map(([k, v]) => (
                  <div key={k} className="bg-card px-3.5 py-3">
                    <div className="text-[11.5px] uppercase tracking-wide text-muted-foreground">{k}</div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
              {p.address ? (
                <a href={mapsHref(p.address)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold" style={{ background: TEAL, color: "#042b29" }}>
                  <MapPin className="h-4 w-4" /> Directions
                </a>
              ) : null}
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">Contact agent</div>
              {ag ? (
                <button onClick={() => go("agent", ag.id)} className="flex w-full items-center gap-3 text-left">
                  {ag.photoUrl ? <Photo url={ag.photoUrl} className="h-12 w-12 rounded-full" /> : <div className="grid h-12 w-12 place-items-center rounded-full text-base font-extrabold" style={{ background: TEAL_SOFT, color: "#054b47" }}>{initials(ag.name)}</div>}
                  <div><div className="font-bold">{ag.name}</div><div className="text-xs text-muted-foreground">{[ag.province, agency?.name].filter(Boolean).join(" · ")}</div></div>
                </button>
              ) : (
                <div className="text-sm font-semibold">{agency?.name || "Agency"}</div>
              )}
              {contactPhone ? (
                <>
                  <div className="mt-3 text-sm text-muted-foreground">Phone <span className="select-all text-foreground">{contactPhone}</span></div>
                  <a href={telHref(contactPhone)} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold" style={{ background: TEAL, color: "#042b29" }}>
                    <Phone className="h-4 w-4" /> Call {contactPhone}
                  </a>
                </>
              ) : null}
              {p.listingUrl ? (
                <a href={p.listingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-bold">
                  View full listing <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </CardContent></Card>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ---- exported entry points ---------------------------------------------------

// Embedded in the Guest/Local dashboard's "Real Estate" tab.
export function EstateAgenciesBrowse() {
  const sp = useSearchParams();
  const preview = sp?.get("estate") === "preview";
  if (PREVIEW_ONLY && !preview) return <ComingSoon />;
  return <EstatePreviewApp />;
}

// Standalone detail routes stay on the placeholder until go-live; the in-tab
// flow above is the preview surface.
export function EstateAgencyView(_: { code: string }) { return <ComingSoonPage />; }
export function EstateAgentView(_: { code: string }) { return <ComingSoonPage />; }
export function EstatePropertyView(_: { id: number }) { return <ComingSoonPage />; }
