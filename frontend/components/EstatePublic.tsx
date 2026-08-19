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
          <p className="text-xs text-muted-foreground truncate">{a.contactNumber || a.email || "Estate Agent"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Guest browse (list of agencies) ----------

export function EstateAgenciesBrowse() {
  const router = useRouter();
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res: any = await getAuthenticatedBackend().estate.publicAgencies();
        setAgencies(res.agencies || []);
      } catch {
        setAgencies([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  if (loading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;
  if (agencies.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">No estate agencies listed yet.</p>;
  return (
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
            </div>
          </div>
        </div>
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
