"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, ArrowLeft, BedDouble, Bath, Car } from "lucide-react";
import ImageCarousel from "./ImageCarousel";
import { getAuthenticatedBackend } from "../lib/backend";
import { buildDirectionsUrl } from "../lib/geolocation";

export function formatPrice(cents: number, listingType: string) {
  const rand = Math.round((cents || 0) / 100);
  const s = "R " + rand.toLocaleString("en-ZA").replace(/,/g, " ");
  return listingType === "rent" ? `${s} / month` : s;
}

const shell = "min-h-screen bg-gradient-to-br from-[#AEECE4]/10 to-background";

function Spinner() {
  return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
}

function DirectionsButton({ lat, lng }: { lat?: number | null; lng?: number | null }) {
  if (lat == null || lng == null) return null;
  return (
    <Button variant="outline" size="sm" onClick={() => window.open(buildDirectionsUrl({ latitude: lat, longitude: lng }), "_blank")}>
      <MapPin className="w-4 h-4 mr-1" /> Directions
    </Button>
  );
}

function CallButton({ number }: { number?: string }) {
  if (!number) return null;
  return (
    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => window.open(`tel:${number}`)}>
      <Phone className="w-4 h-4 mr-1" /> Call
    </Button>
  );
}

// ---------- Cards ----------

export function PropertyCard({ p }: { p: any }) {
  const router = useRouter();
  return (
    <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/estate/property/${p.id}`)}>
      <ImageCarousel images={[...(p.imageUrl ? [p.imageUrl] : []), ...(p.imageUrls || [])]} alt={p.title} className="w-full h-40 object-cover" placeholderClassName="w-full h-40" />
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-sm truncate">{formatPrice(p.priceCents, p.listingType)}</span>
          <Badge className={p.listingType === "rent" ? "bg-blue-600" : "bg-green-600"}>{p.listingType === "rent" ? "For Rent" : "For Sale"}</Badge>
        </div>
        <p className="text-sm font-medium truncate">{p.title}</p>
        <p className="text-xs text-muted-foreground truncate">{[p.propertyType, p.province].filter(Boolean).join(" · ")}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
          {p.bedrooms ? <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" />{p.bedrooms}</span> : null}
          {p.bathrooms ? <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{p.bathrooms}</span> : null}
          {p.garages ? <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5" />{p.garages}</span> : null}
          {p.houseSizeM2 ? <span>{p.houseSizeM2} m²</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentCard({ a }: { a: any }) {
  const router = useRouter();
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => a.profileReferenceCode && router.push(`/estate/agent/${a.profileReferenceCode}`)}>
      <CardContent className="p-3 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {a.photoUrl ? <img src={a.photoUrl} alt={a.name} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-muted" />}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{a.name}</p>
          <p className="text-xs text-muted-foreground truncate">{a.agencyName || a.contactNumber || a.email || "Estate Agent"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Guest browse (list of agencies) ----------

const EP_TYPES = ["House", "Apartment", "Townhouse", "Plot", "Farm", "Commercial", "Land", "Industrial"];
const EP_PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];
const EP_FEATURES = ["Pool", "Tennis Court", "Garden", "Security Estate", "Double Garage", "Borehole", "Solar", "Fibre", "Sea View", "Mountain View", "Pet Friendly", "Fireplace", "Staff Quarters", "Backup Power"];

const epSelect = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";

export function EstateAgenciesBrowse() {
  const router = useRouter();
  const [properties, setProperties] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // search / filter state
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [listing, setListing] = useState("");
  const [province, setProvince] = useState("");
  const [postal, setPostal] = useState("");
  const [minBeds, setMinBeds] = useState("");
  const [minBaths, setMinBaths] = useState("");
  const [minHouse, setMinHouse] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const [pr, ag, agn]: any = await Promise.all([
          backend.estate.publicProperties(),
          backend.estate.publicAgencies(),
          backend.estate.publicAgents(),
        ]);
        setProperties(pr.properties || []);
        setAgencies(ag.agencies || []);
        setAgents(agn.agents || []);
      } catch {
        setProperties([]); setAgencies([]); setAgents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleFeature = (f: string) =>
    setFeatures((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const term = q.trim().toLowerCase();
  const filtered = properties.filter((p) => {
    if (term && !`${p.title} ${p.address} ${p.province} ${p.postalCode} ${p.propertyType}`.toLowerCase().includes(term)) return false;
    if (type && p.propertyType !== type) return false;
    if (listing && p.listingType !== listing) return false;
    if (province && p.province !== province) return false;
    if (postal && !String(p.postalCode || "").includes(postal.trim())) return false;
    if (minBeds && (p.bedrooms || 0) < Number(minBeds)) return false;
    if (minBaths && (p.bathrooms || 0) < Number(minBaths)) return false;
    if (minHouse && (p.houseSizeM2 || 0) < Number(minHouse)) return false;
    if (features.length && !features.every((f) => (p.features || []).includes(f))) return false;
    return true;
  });

  if (loading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search properties by title, area, type…" className={`${epSelect} pl-8`} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters((s) => !s)}>{showFilters ? "Hide" : "Filters"}</Button>
        </div>

        {showFilters && (
          <div className="rounded-lg border border-border p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            <select className={epSelect} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Any type</option>
              {EP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className={epSelect} value={listing} onChange={(e) => setListing(e.target.value)}>
              <option value="">Sale or Rent</option>
              <option value="sale">For Sale</option>
              <option value="rent">For Rent</option>
            </select>
            <select className={epSelect} value={province} onChange={(e) => setProvince(e.target.value)}>
              <option value="">Any province</option>
              {EP_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input className={epSelect} value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="Postal code" />
            <input className={epSelect} type="number" min={0} value={minBeds} onChange={(e) => setMinBeds(e.target.value)} placeholder="Min beds" />
            <input className={epSelect} type="number" min={0} value={minBaths} onChange={(e) => setMinBaths(e.target.value)} placeholder="Min baths" />
            <input className={epSelect} type="number" min={0} value={minHouse} onChange={(e) => setMinHouse(e.target.value)} placeholder="Min house m²" />
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-muted-foreground mb-1">Features</p>
              <div className="flex flex-wrap gap-1.5">
                {EP_FEATURES.map((f) => (
                  <button key={f} type="button" onClick={() => toggleFeature(f)}
                    className={`text-xs rounded-full px-2.5 py-1 border ${features.includes(f) ? "border-green-600 text-green-600 bg-green-600/10" : "border-border text-muted-foreground"}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Property results */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Properties ({filtered.length})</p>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No properties match your search.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((p) => <PropertyCard key={p.id} p={p} />)}
          </div>
        )}
      </div>

      {/* Agencies */}
      {agencies.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Estate Agencies ({agencies.length})</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agencies.map((a) => (
              <Card key={a.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => a.profileReferenceCode && router.push(`/estate/agency/${a.profileReferenceCode}`)}>
                <ImageCarousel images={[...(a.imageUrl ? [a.imageUrl] : []), ...(a.imageUrls || [])]} alt={a.name} className="w-full h-36 object-cover" placeholderClassName="w-full h-36" />
                <CardContent className="p-3">
                  <p className="font-semibold text-sm truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.province || "Estate Agency"}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Standalone Agents */}
      {agents.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Estate Agents ({agents.length})</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agents.map((a) => <AgentCard key={a.id} a={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Agency page ----------

export function EstateAgencyView({ code }: { code: string }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await getAuthenticatedBackend().estate.publicAgency({ code });
        setData(res);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);
  if (loading) return <Spinner />;
  if (!data?.agency) return <div className={`${shell} flex items-center justify-center text-muted-foreground`}>Agency not found.</div>;
  const a = data.agency;
  return (
    <div className={shell}>
      <div className="max-w-3xl mx-auto p-4 space-y-5">
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <ImageCarousel images={[...(a.imageUrl ? [a.imageUrl] : []), ...(a.imageUrls || [])]} alt={a.name} className="w-full aspect-[3/2] object-cover rounded-lg" placeholderClassName="w-full aspect-[3/2] rounded-lg" />
        <div>
          <h1 className="text-2xl font-bold">{a.name}</h1>
          {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            <CallButton number={a.contactNumber} />
            <DirectionsButton lat={a.latitude} lng={a.longitude} />
          </div>
        </div>

        {data.properties?.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Properties ({data.properties.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.properties.map((p: any) => <PropertyCard key={p.id} p={p} />)}
            </div>
          </div>
        )}

        {data.agents?.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Our Agents ({data.agents.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.agents.map((ag: any) => <AgentCard key={ag.id} a={ag} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Agent page ----------

export function EstateAgentView({ code }: { code: string }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        setData(await getAuthenticatedBackend().estate.publicAgent({ code }));
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);
  if (loading) return <Spinner />;
  if (!data?.agent) return <div className={`${shell} flex items-center justify-center text-muted-foreground`}>Agent not found.</div>;
  const a = data.agent;
  return (
    <div className={shell}>
      <div className="max-w-3xl mx-auto p-4 space-y-5">
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {a.photoUrl ? <img src={a.photoUrl} alt={a.name} className="w-24 h-24 rounded-full object-cover" /> : <div className="w-24 h-24 rounded-full bg-muted" />}
          <div>
            <h1 className="text-2xl font-bold">{a.name}</h1>
            {data.agency?.name && <p className="text-sm text-muted-foreground">{data.agency.name}</p>}
            <div className="flex flex-wrap gap-2 mt-2">
              <CallButton number={a.contactNumber} />
              {a.email && <Button variant="outline" size="sm" onClick={() => window.open(`mailto:${a.email}`)}>Email</Button>}
              <DirectionsButton lat={a.latitude} lng={a.longitude} />
            </div>
          </div>
        </div>
        {(a.agencyName || a.address) && (
          <p className="text-sm text-muted-foreground">{[a.agencyName, a.address].filter(Boolean).join(" · ")}</p>
        )}
        {a.bio && <p className="text-sm text-muted-foreground">{a.bio}</p>}
        {data.properties?.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Listings ({data.properties.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.properties.map((p: any) => <PropertyCard key={p.id} p={p} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Property page ----------

function Spec({ label, value }: { label: string; value: any }) {
  if (value == null || value === "" || value === 0) return null;
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

export function EstatePropertyView({ id }: { id: number }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        setData(await getAuthenticatedBackend().estate.publicProperty({ id }));
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);
  if (loading) return <Spinner />;
  if (!data?.property) return <div className={`${shell} flex items-center justify-center text-muted-foreground`}>Property not found.</div>;
  const p = data.property;
  const contactNumber = data.agent?.contactNumber || data.agency?.contactNumber;
  return (
    <div className={shell}>
      <div className="max-w-3xl mx-auto p-4 space-y-5">
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <ImageCarousel images={[...(p.imageUrl ? [p.imageUrl] : []), ...(p.imageUrls || [])]} alt={p.title} className="w-full aspect-[3/2] object-cover rounded-lg" placeholderClassName="w-full aspect-[3/2] rounded-lg" />
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{formatPrice(p.priceCents, p.listingType)}</h1>
          <Badge className={p.listingType === "rent" ? "bg-blue-600" : "bg-green-600"}>{p.listingType === "rent" ? "For Rent" : "For Sale"}</Badge>
        </div>
        <p className="text-lg font-medium">{p.title}</p>
        <p className="text-sm text-muted-foreground">{[p.propertyType, p.address, p.province, p.postalCode].filter(Boolean).join(", ")}</p>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <Spec label="Bedrooms" value={p.bedrooms} />
          <Spec label="Bathrooms" value={p.bathrooms} />
          <Spec label="Garages" value={p.garages} />
          <Spec label="House Size" value={p.houseSizeM2 ? `${p.houseSizeM2} m²` : 0} />
          <Spec label="Plot Size" value={p.plotSizeM2 ? `${p.plotSizeM2} m²` : 0} />
        </div>

        {p.features?.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2">Features</h2>
            <div className="flex flex-wrap gap-2">
              {p.features.map((f: string) => <Badge key={f} variant="secondary">{f}</Badge>)}
            </div>
          </div>
        )}

        {p.description && (
          <div>
            <h2 className="text-sm font-semibold mb-1">Description</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.description}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <CallButton number={contactNumber} />
          <DirectionsButton lat={p.latitude} lng={p.longitude} />
          {data.agent?.profileReferenceCode && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/estate/agent/${data.agent.profileReferenceCode}`)}>View Agent</Button>
          )}
        </div>
      </div>
    </div>
  );
}
