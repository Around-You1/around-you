"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MapPin, Phone, ExternalLink, Building2, Store, Compass, LogOut, Navigation, Baby,
  Wifi, CreditCard, Accessibility, CarFront, Globe, Facebook, Instagram, Mail,
} from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import OptimizedImage from "../components/OptimizedImage";
import AppLogo from "../components/AppLogo";
import type { Restaurant } from "~backend/restaurant/types";
import type { ServiceData } from "~backend/service/types";
import type { AttractionData } from "~backend/attraction/types";

type EntityData = Restaurant | ServiceData | AttractionData;

// PAYMENT_LABELS maps each backend boolean field to its display label — one
// place to add a payment option in future rather than five.
const PAYMENT_LABELS: [string, string][] = [
  ["paymentCard", "Card"],
  ["paymentCash", "Cash"],
  ["paymentMobile", "Mobile Tap"],
  ["paymentGaap", "Gaap"],
  ["paymentSnapScan", "Snap Scan"],
  ["paymentYoco", "Yoco"],
  ["paymentZapper", "Zapper"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-sm text-muted-foreground mb-2">{title}</h3>
      {children}
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="px-3 py-1 bg-[#AEECE4]/10 text-[#AEECE4] rounded-full text-sm">
          {item}
        </span>
      ))}
    </div>
  );
}

export default function PartnerDashboard() {
  const [entity, setEntity] = useState<EntityData | null>(null);
  const [entityType, setEntityType] = useState<"restaurant" | "service" | "attraction" | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<any[]>([]);
  const router = useRouter();
  const navigate = (to: string, opts?: { replace?: boolean }) =>
    opts?.replace ? router.replace(to) : router.push(to);
  const { toast } = useToast();

  useEffect(() => {
    loadEntityDetails();
  }, []);

  const loadEntityDetails = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user.entityType || !user.entityId) {
        toast({
          title: "Error",
          description: "No partner entity assigned",
          variant: "destructive",
        });
        return;
      }

      setEntityType(user.entityType);
      const backend = getAuthenticatedBackend();

      let data: EntityData;
      if (user.entityType === "restaurant") {
        const restaurants = await backend.restaurant.list({});
        data = restaurants.restaurants.find((r: Restaurant) => r.id === user.entityId)!;
      } else if (user.entityType === "service") {
        const services = await backend.service.list({});
        data = services.services.find((s: ServiceData) => s.id === user.entityId)!;
      } else {
        const attractions = await backend.attraction.list({});
        data = attractions.attractions.find((a: AttractionData) => a.id === user.entityId)!;
      }

      setEntity(data);
      try {
        const bk = await backend.booking.forPartner({ entityType: user.entityType, entityId: user.entityId });
        setBookings((bk as { bookings?: any[] }).bookings || []);
      } catch (bkErr) {
        console.error("Failed to load bookings:", bkErr);
      }
    } catch (error) {
      console.error("Failed to load entity details:", error);
      toast({
        title: "Error",
        description: "Failed to load partner details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const getEntityIcon = () => {
    if (entityType === "restaurant") return <Store className="h-12 w-12 text-[#AEECE4]" />;
    if (entityType === "service") return <Building2 className="h-12 w-12 text-[#AEECE4]" />;
    return <Compass className="h-12 w-12 text-[#AEECE4]" />;
  };

  const getEntityTypeName = () => {
    if (entityType === "restaurant") return "Restaurant";
    if (entityType === "service") return "Service";
    return "Attraction";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/20 to-background flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!entity || !entityType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/20 to-background flex items-center justify-center p-6">
        <Card>
          <CardContent className="p-8">
            <p>No partner entity assigned</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const e = entity as any; // fields vary by entity type; guarded by checks below

  const activePayments = PAYMENT_LABELS.filter(([field]) => e[field]).map(([, label]) => label);
  const images: string[] = e.imageUrls && e.imageUrls.length > 0 ? e.imageUrls : e.imageUrl ? [e.imageUrl] : [];
  const hasSocials = e.socialsWebsite || e.socialsFacebook || e.socialsInstagram || e.socialsTiktok || e.socialsTwitter;
  const hasBookings = entityType === "restaurant" && (e.bookingsEmail || e.bookingsContactNumber);
  const hasExperienceInfo =
    (entityType === "service" || entityType === "attraction") &&
    (e.safetyInfo || e.ageRestrictions || e.fitnessLevel || e.bestTimeOfDay || e.whatToBring);
  const hasAttractionExtras =
    entityType === "attraction" &&
    (e.trailDifficulty || e.wildlifeCautions || e.tideWarnings || e.parkingNotes || e.photographySpots);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/20 to-background p-6">
      <div className="max-w-4xl mx-auto space-y-8 py-8">
        <div className="relative text-center">
          <div className="flex justify-center mb-2"><AppLogo src="/logo-dark.png" /></div>
          <h1 className="text-4xl font-bold text-foreground">Partner Portal</h1>
          <p className="text-lg text-muted-foreground mt-2">{getEntityTypeName()} Dashboard</p>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="absolute top-0 right-0 flex items-center gap-2"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              {getEntityIcon()}
              <div className="flex-1">
                <CardTitle className="text-2xl">{entity.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Status: {entity.isActive ? (
                    <span className="text-green-600 font-medium">Active</span>
                  ) : (
                    <span className="text-red-600 font-medium">Inactive</span>
                  )}
                </p>
                {entityType === "restaurant" && e.littleExplorerApproved && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#AEECE4]/20 text-[#AEECE4] border border-[#AEECE4]/30 rounded-full text-sm font-medium">
                      <Baby className="h-4 w-4" />
                      Child Friendly
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {images.length > 0 && (
              <div className={images.length === 1 ? "" : "grid grid-cols-2 sm:grid-cols-3 gap-3"}>
                {images.map((url, i) => (
                  <OptimizedImage
                    key={url + i}
                    src={url}
                    alt={`${entity.name} photo ${i + 1}`}
                    className={images.length === 1 ? "w-full h-64 object-cover rounded-lg" : "w-full aspect-square object-cover rounded-lg"}
                    placeholderClassName={images.length === 1 ? "w-full h-64 rounded-lg" : "w-full aspect-square rounded-lg"}
                  />
                ))}
              </div>
            )}

            <div className="grid gap-4">
              <Section title="Location">
                <div className="flex items-start gap-2">
                  <MapPin className="h-5 w-5 mt-0.5 text-[#AEECE4] flex-shrink-0" />
                  <div className="flex-1">
                    <p>{entity.address}</p>
                    <p className="text-sm text-muted-foreground">
                      {entity.province}, {entity.country} {entity.postalCode}
                    </p>
                  </div>
                </div>
                {entity.latitude && entity.longitude && (
                  <Button
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${entity.latitude},${entity.longitude}`, "_blank")}
                    className="mt-3 bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black"
                    title="Opens directions in your default map app"
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Get Directions
                  </Button>
                )}
              </Section>

              {e.contactNumber && (
                <Section title="Contact">
                  <a href={`tel:${e.contactNumber}`} className="flex items-center gap-2 text-[#AEECE4] hover:underline">
                    <Phone className="h-5 w-5" />
                    {e.contactNumber}
                  </a>
                </Section>
              )}

              {entityType === "restaurant" && e.cuisineTypes?.length > 0 && (
                <Section title="Cuisine Types"><TagList items={e.cuisineTypes} /></Section>
              )}
              {entityType === "service" && e.serviceCategories?.length > 0 && (
                <Section title="Service Categories"><TagList items={e.serviceCategories} /></Section>
              )}
              {entityType === "attraction" && e.attractionType?.length > 0 && (
                <Section title="Attraction Categories"><TagList items={e.attractionType} /></Section>
              )}

              {entityType === "restaurant" && (
                <Section title="Service Options">
                  <TagList
                    items={[
                      e.serviceDineIn && "Dine-In",
                      e.serviceTakeaway && "Takeaway",
                      e.serviceDelivery && "Delivery",
                    ].filter(Boolean) as string[]}
                  />
                </Section>
              )}

              {e.description && <Section title="Description"><p className="text-sm">{e.description}</p></Section>}

              <Section title="Accessibility">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className={`flex items-center gap-1.5 ${e.wheelchairAccess ? "text-[#AEECE4]" : "text-muted-foreground/50"}`}>
                    <Accessibility className="h-4 w-4" /> Wheelchair Access
                  </span>
                  <span className={`flex items-center gap-1.5 ${e.parkingAvailability ? "text-[#AEECE4]" : "text-muted-foreground/50"}`}>
                    <CarFront className="h-4 w-4" /> Parking Available
                  </span>
                </div>
              </Section>

              {activePayments.length > 0 && (
                <Section title="Payment Options">
                  <div className="flex flex-wrap gap-2">
                    {activePayments.map((label) => (
                      <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#AEECE4]/10 text-[#AEECE4] rounded-full text-sm">
                        <CreditCard className="h-3.5 w-3.5" /> {label}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {entityType === "restaurant" && e.wifiNetwork && (
                <Section title="WiFi">
                  <p className="flex items-center gap-2 text-sm">
                    <Wifi className="h-4 w-4 text-[#AEECE4]" />
                    {e.wifiNetwork}{e.wifiPassword ? ` — ${e.wifiPassword}` : ""}
                  </p>
                </Section>
              )}

              {hasExperienceInfo && (
                <Section title="Experience Info">
                  <div className="text-sm space-y-1">
                    {e.safetyInfo && <p><span className="text-muted-foreground">Safety Info: </span>{e.safetyInfo}</p>}
                    {e.ageRestrictions && <p><span className="text-muted-foreground">Age Restrictions: </span>{e.ageRestrictions}</p>}
                    {e.fitnessLevel && <p><span className="text-muted-foreground">Fitness Level: </span>{e.fitnessLevel}</p>}
                    {e.bestTimeOfDay && <p><span className="text-muted-foreground">Best Time of Day: </span>{e.bestTimeOfDay}</p>}
                    {e.whatToBring && <p><span className="text-muted-foreground">What to Bring: </span>{e.whatToBring}</p>}
                  </div>
                </Section>
              )}

              {hasAttractionExtras && (
                <Section title="Attraction Extras">
                  <div className="text-sm space-y-1">
                    {e.trailDifficulty && <p><span className="text-muted-foreground">Trail Difficulty: </span>{e.trailDifficulty}</p>}
                    {e.wildlifeCautions && <p><span className="text-muted-foreground">Wildlife Cautions: </span>{e.wildlifeCautions}</p>}
                    {e.tideWarnings && <p><span className="text-muted-foreground">Tide Warnings: </span>{e.tideWarnings}</p>}
                    {e.parkingNotes && <p><span className="text-muted-foreground">Parking Notes: </span>{e.parkingNotes}</p>}
                    {e.photographySpots && <p><span className="text-muted-foreground">Photography Spots: </span>{e.photographySpots}</p>}
                  </div>
                </Section>
              )}

              {hasBookings && (
                <Section title="Bookings">
                  <div className="text-sm space-y-1">
                    {e.bookingsEmail && (
                      <p className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-[#AEECE4]" />
                        <a href={`mailto:${e.bookingsEmail}`} className="text-[#AEECE4] hover:underline">{e.bookingsEmail}</a>
                      </p>
                    )}
                    {e.bookingsContactNumber && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-[#AEECE4]" />
                        <a href={`tel:${e.bookingsContactNumber}`} className="text-[#AEECE4] hover:underline">{e.bookingsContactNumber}</a>
                      </p>
                    )}
                  </div>
                </Section>
              )}

              {hasSocials && (
                <Section title="Social Media">
                  <div className="flex flex-wrap gap-3">
                    {e.socialsWebsite && (
                      <a href={e.socialsWebsite} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-[#AEECE4] hover:underline">
                        <Globe className="h-4 w-4" /> Website
                      </a>
                    )}
                    {e.socialsFacebook && (
                      <a href={e.socialsFacebook} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-[#AEECE4] hover:underline">
                        <Facebook className="h-4 w-4" /> Facebook
                      </a>
                    )}
                    {e.socialsInstagram && (
                      <a href={e.socialsInstagram} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-[#AEECE4] hover:underline">
                        <Instagram className="h-4 w-4" /> Instagram
                      </a>
                    )}
                    {e.socialsTiktok && (
                      <a href={e.socialsTiktok} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-[#AEECE4] hover:underline">
                        TikTok
                      </a>
                    )}
                    {e.socialsTwitter && (
                      <a href={e.socialsTwitter} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-[#AEECE4] hover:underline">
                        X (Twitter)
                      </a>
                    )}
                  </div>
                </Section>
              )}

              {e.discountOffered && (
                <Section title="Discount Offered">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-[#AEECE4]">{e.discountOffered}</p>
                    {e.discountCode && (
                      <span className="px-3 py-1.5 bg-[#AEECE4]/10 text-[#AEECE4] rounded text-lg font-mono font-bold tracking-wide">
                        {e.discountCode}
                      </span>
                    )}
                  </div>
                </Section>
              )}

              {entityType === "restaurant" && e.menuLink && (
                <div>
                  <Button
                    onClick={() => window.open(e.menuLink, "_blank")}
                    className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black"
                  >
                    <ExternalLink className="h-5 w-5 mr-2" />
                    View Menu
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {(e.accessLevel === "Booking" || bookings.length > 0) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Bookings Received</CardTitle>
                {bookings.filter((b) => b.status === "pending").length > 0 && (
                  <span className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-red-600 text-white text-xs font-bold">
                    {bookings.filter((b) => b.status === "pending").length} new
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Read-only. Only the customer can change or cancel a booking (from the app), so this list always reflects real bookings.
              </p>
              {bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings yet.</p>
              ) : (
                bookings.map((b) => (
                  <div key={b.id} className={`border rounded-lg p-3 space-y-1 ${b.status === "cancelled" ? "opacity-60" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{b.bookingDate}{b.bookingTime ? ` \u00B7 ${b.bookingTime}` : ""}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${b.status === "cancelled" ? "bg-red-100 text-red-700" : b.status === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-700"}`}>{b.status}</span>
                    </div>
                    <div className="text-sm">{b.customerName}</div>
                    <div className="text-xs text-muted-foreground">{[b.customerPhone, b.customerEmail].filter(Boolean).join(" \u00B7 ")}</div>
                    {Array.isArray(b.items) && b.items.length > 0 && (
                      <div className="text-xs text-muted-foreground">{b.items.map((it: any) => it.name).join(", ")}</div>
                    )}
                    <div className="text-sm font-medium">R {(Number(b.total) || 0).toFixed(2)}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Important Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Welcome to the Around You Partner Portal! Your business is now listed on our platform and visible to guests staying at participating accommodations in your area.
            </p>
            <div className="p-4 bg-[#AEECE4]/10 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">Need to update your information?</h4>
              <p className="text-sm text-muted-foreground">
                Please contact the platform administrator to make changes to your business profile, including contact details, images, descriptions, or discount offers.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
