import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Phone, ExternalLink, Tag, ChevronDown, Search, Eye, EyeOff, MapPin, Globe, Instagram, Twitter, Youtube, Music, Star } from "lucide-react";
import AddressDropdown from "../components/AddressDropdown";
import DirectionsDropdown from "../components/DirectionsDropdown";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { useSwipe } from "../lib/useSwipe";
import ImageCarousel from "../components/ImageCarousel";
import { EstateAgenciesBrowse } from "../components/EstatePublic";
import SwipeIndicator from "../components/SwipeIndicator";
import type { Accommodation } from "~backend/accommodation/types";
import type { Restaurant } from "~backend/restaurant/types";
import type { ServiceData } from "~backend/service/types";
import type { AttractionData } from "~backend/attraction/types";
import AppLogo from "../components/AppLogo";

const FALLBACK = "The company has opted not to make this information visible.";

// Mirrors backend/app/rating/types.go Summary. myRating is 0/absent until
// this guest has voted; averageRating/ratingCount cover everyone's votes.
interface RatingSummary {
  entityType: string;
  entityId: number;
  averageRating: number;
  ratingCount: number;
  myRating?: number;
}

type RatableType = "restaurant" | "service" | "attraction";
type BookItem = { name: string; price: number; duration: number };

const ratingKey = (entityType: string, entityId: number | string) =>
  `${entityType}:${Number(entityId)}`;

export default function GuestDashboard() {
  const [accommodation, setAccommodation] = useState<Accommodation | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [attractions, setAttractions] = useState<AttractionData[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [filteredServices, setFilteredServices] = useState<ServiceData[]>([]);
  const [filteredAttractions, setFilteredAttractions] = useState<AttractionData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [minRating, setMinRating] = useState(0); // 0 = Any; else 3 / 4 / 4.5
  const [discountsOnly, setDiscountsOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState([10]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("restaurants");

  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());
  const [selectedContact, setSelectedContact] = useState<string>("");
  // Star ratings, keyed "<entityType>:<entityId>" so all three tabs share one map.
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const [bookingFor, setBookingFor] = useState<
    { entityType: RatableType; entityId: number; entityName: string; items: BookItem[] } | null
  >(null);
  const [redeemFor, setRedeemFor] = useState<
    { entityType: RatableType; entityId: number; entityName: string; discount?: string } | null
  >(null);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showAccInfo, setShowAccInfo] = useState(false);
  const fireEvent = (eventType: string, extra?: { entityType?: string; entityId?: number; searchTerm?: string }) => {
    try {
      getAuthenticatedBackend()
        .events.record({ eventType, entityType: extra?.entityType, entityId: extra?.entityId, searchTerm: extra?.searchTerm })
        .catch(() => {});
    } catch {
      // analytics is best-effort — never disrupt the UI
    }
  };
  const toggleCard = (key: string) => {
    if (!expandedCards.has(key)) {
      const [entityType, id] = key.split(":");
      fireEvent("listing_view", { entityType, entityId: Number(id) });
    }
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const { toast } = useToast();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isLocalMode = user.role === "LocalGuest";
  const localArea: string = user.area || user.municipality || "";

  const tabOrder = ["restaurants", "services", "attractions"];

  const handleSwipeLeft = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < tabOrder.length - 1) setActiveTab(tabOrder[currentIndex + 1]);
  };

  const handleSwipeRight = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) setActiveTab(tabOrder[currentIndex - 1]);
  };

  const swipeHandlers = useSwipe({
    onSwipedLeft: handleSwipeLeft,
    onSwipedRight: handleSwipeRight,
    minSwipeDistance: 50,
  });

  useEffect(() => {
    if (isLocalMode) loadPartnersByArea();
    else loadAccommodationDetails();
  }, []);

  useEffect(() => {
    if (!isLocalMode && accommodation) loadNearbyPartners();
  }, [radiusKm, accommodation]);

  const matchesSearch = (query: string, fields: (string | undefined | null)[]): boolean => {
    const haystack = fields
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const trimmedQuery = query.toLowerCase().trim();
    if (haystack.includes(trimmedQuery)) return true;
    return trimmedQuery.split(/\s+/).every((kw) => haystack.includes(kw));
  };

  // Turn a partner's boolean service options + discount into searchable words,
  // so queries like "delivery", "wheelchair" or "discount" find them even
  // though those aren't categories. Fields absent on an entity are just falsy.
  const optionKeywords = (e: any): string[] => {
    const kw: string[] = [];
    if (e.serviceDineIn) kw.push("dine-in", "eat in", "sit down");
    if (e.serviceTakeaway) kw.push("takeaway", "take away", "takeout");
    if (e.serviceDelivery) kw.push("delivery", "deliver");
    if (e.wheelchairAccess) kw.push("wheelchair", "accessible");
    if (e.parkingAvailability) kw.push("parking");
    if (e.discountOffered && String(e.discountOffered).trim()) {
      kw.push("discount", "special", "offer", String(e.discountOffered));
    }
    return kw;
  };

  const hasDiscount = (e: any): boolean => !!(e.discountOffered && String(e.discountOffered).trim());

  // Rating gate for the "3★ & above" filter. Unrated partners (no votes yet)
  // are kept — per the chosen behaviour they show BELOW rated ones rather than
  // being hidden. Only partners rated *below* the threshold are removed.
  const passesRating = (entityType: string, id: number | string): boolean => {
    if (minRating <= 0) return true;
    const summary = ratings[ratingKey(entityType, id)];
    const count = summary?.ratingCount || 0;
    if (count === 0) return true; // unrated — kept, sorted to the bottom
    return (summary?.averageRating || 0) >= minRating;
  };

  // When a rating filter is active, order rated partners (highest first) above
  // unrated ones. With "Any" selected we leave the original order untouched.
  const sortByRating = <T extends { id: number | string }>(entityType: string, list: T[]): T[] => {
    if (minRating <= 0) return list;
    const score = (e: T) => {
      const s = ratings[ratingKey(entityType, e.id)];
      return (s?.ratingCount || 0) > 0 ? (s?.averageRating || 0) : -1;
    };
    return [...list].sort((a, b) => score(b) - score(a));
  };

  useEffect(() => {
    const trimmed = searchQuery.trim();
    const applyAll = <T extends { id: number | string; name?: string; description?: string; area?: string; province?: string }>(
      entityType: string,
      list: T[],
      categories: (e: T) => string[]
    ): T[] => {
      const filtered = list.filter((e) => {
        const searchOk =
          !trimmed ||
          matchesSearch(trimmed, [e.name, e.description, ...categories(e), e.area, e.province, ...optionKeywords(e)]);
        const discountOk = !discountsOnly || hasDiscount(e);
        const ratingOk = passesRating(entityType, e.id);
        return searchOk && discountOk && ratingOk;
      });
      return sortByRating(entityType, filtered);
    };
    setFilteredRestaurants(applyAll("restaurant", restaurants, (r) => [...(r.cuisineTypes || []), ...(r.restaurantType || [])]));
    setFilteredServices(applyAll("service", services, (s) => s.serviceCategories || []));
    setFilteredAttractions(applyAll("attraction", attractions, (a) => a.attractionType || []));
  }, [searchQuery, restaurants, services, attractions, ratings, minRating, discountsOnly]);

  // Best-effort search analytics: fire a (debounced) search event when the user
  // searches, distinguishing zero-result searches. Query text is not sent.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;
    const t = setTimeout(() => {
      const results = filteredRestaurants.length + filteredServices.length + filteredAttractions.length;
      fireEvent(results === 0 ? "search_zero_result" : "search", { searchTerm: q });
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filteredRestaurants, filteredServices, filteredAttractions]);

  // Fetches every rating summary for the three lists in three round trips
  // (one per entity type) rather than one per card. Deliberately silent on
  // failure: a ratings outage must not blank out the whole dashboard.
  const loadRatings = async (
    restaurantList: Restaurant[],
    serviceList: ServiceData[],
    attractionList: AttractionData[]
  ) => {
    try {
      const backend = getAuthenticatedBackend();
      const empty = { summaries: [] as RatingSummary[] };
      const [restaurantRes, serviceRes, attractionRes] = await Promise.all([
        restaurantList.length
          ? backend.rating.listSummaries({ entityType: "restaurant", entityIds: restaurantList.map((x) => Number(x.id)) })
          : Promise.resolve(empty),
        serviceList.length
          ? backend.rating.listSummaries({ entityType: "service", entityIds: serviceList.map((x) => Number(x.id)) })
          : Promise.resolve(empty),
        attractionList.length
          ? backend.rating.listSummaries({ entityType: "attraction", entityIds: attractionList.map((x) => Number(x.id)) })
          : Promise.resolve(empty),
      ]);

      const map: Record<string, RatingSummary> = {};
      [
        ...((restaurantRes as { summaries?: RatingSummary[] }).summaries || []),
        ...((serviceRes as { summaries?: RatingSummary[] }).summaries || []),
        ...((attractionRes as { summaries?: RatingSummary[] }).summaries || []),
      ].forEach((summary) => {
        map[ratingKey(summary.entityType, summary.entityId)] = summary;
      });
      setRatings(map);
    } catch (error) {
      console.error("Failed to load ratings:", error);
    }
  };

  // Called by each card's StarRating after a successful vote, so the average
  // and the guest's own star count update without a full reload.
  const applyRatingSummary = (summary: RatingSummary) => {
    setRatings((prev) => ({ ...prev, [ratingKey(summary.entityType, summary.entityId)]: summary }));
  };

  const loadAccommodationDetails = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user.accommodationId) { setLoading(false); return; }
      const backend = getAuthenticatedBackend();
      const data = await backend.accommodation!.get({ id: user.accommodationId });
      setAccommodation(data);
    } catch (error) {
      console.error("Failed to load accommodation:", error);
      toast({ title: "Error", description: "Failed to load accommodation details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadPartnersByArea = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const [restaurantData, serviceData, attractionData] = await Promise.all([
        backend.restaurant.listByMunicipality({ area: localArea }),
        backend.service.listByMunicipality({ area: localArea }),
        backend.attraction.listByMunicipality({ area: localArea }),
      ]);
      setRestaurants(restaurantData.restaurants);
      setServices(serviceData.services);
      setAttractions(attractionData.attractions);
      setFilteredRestaurants(restaurantData.restaurants);
      setFilteredServices(serviceData.services);
      setFilteredAttractions(attractionData.attractions);
      void loadRatings(restaurantData.restaurants, serviceData.services, attractionData.attractions);
    } catch (error) {
      console.error("Failed to load area partners:", error);
      toast({ title: "Error", description: "Failed to load area partners", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadNearbyPartners = async () => {
    if (!accommodation) return;
    if (accommodation!.latitude == null || accommodation!.longitude == null) return;
    try {
      const backend = getAuthenticatedBackend();
      const [restaurantData, serviceData, attractionData] = await Promise.all([
        backend.restaurant.listNearby({ latitude: accommodation!.latitude, longitude: accommodation!.longitude, radiusKm: radiusKm[0] }),
        backend.service.listNearby({ latitude: accommodation!.latitude, longitude: accommodation!.longitude, radiusKm: radiusKm[0] }),
        backend.attraction.listNearby({ latitude: accommodation!.latitude, longitude: accommodation!.longitude, radiusKm: radiusKm[0] }),
      ]);
      setRestaurants(restaurantData.restaurants);
      setServices(serviceData.services);
      setAttractions(attractionData.attractions);
      setFilteredRestaurants(restaurantData.restaurants);
      setFilteredServices(serviceData.services);
      setFilteredAttractions(attractionData.attractions);
      void loadRatings(restaurantData.restaurants, serviceData.services, attractionData.attractions);
    } catch (error) {
      console.error("Failed to load nearby partners:", error);
      toast({ title: "Error", description: "Failed to load nearby partners", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/20 to-background flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!isLocalMode && !accommodation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/20 to-background flex items-center justify-center p-6">
        <Card>
          <CardContent className="p-8">
            <p>No accommodation assigned</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const triggerClass = "flex items-center gap-2 text-sm font-medium hover:text-purple-600 transition-colors w-full text-left";
  const contentClass = "pl-6 pt-2";
  const fallbackSpan = <span className="text-sm text-muted-foreground italic">{FALLBACK}</span>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/20 to-background p-6">
      <div className="max-w-7xl mx-auto space-y-8 py-8">
        {isLocalMode ? (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-2"><AppLogo src="/logo-dark.png" /></div>
              <h1 className="text-4xl font-bold text-foreground">Around You</h1>
              <p className="text-lg text-muted-foreground">Local Guest</p>
            </div>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#AEECE4]/30 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-[#AEECE4]" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Your Area</p>
                  <p className="text-sm text-muted-foreground">{localArea}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-2"><AppLogo src="/logo-dark.png" /></div>
              <h1 className="text-4xl font-bold text-foreground">Welcome to</h1>
              <p className="text-lg text-muted-foreground">{accommodation!.name}</p>
            </div>
            <Card>
              <CardContent className="p-4">
                <div className="mb-4 mx-auto w-full max-w-xl">
                  <ImageCarousel
                    images={[
                      ...(accommodation!.imageUrl ? [accommodation!.imageUrl] : []),
                      ...(accommodation!.imageUrls || []),
                    ]}
                    alt={accommodation!.name}
                    className="w-full aspect-[3/2] object-cover"
                    placeholderClassName="w-full aspect-[3/2]"
                    intervalMs={3000}
                  />
                </div>
                <h3 className="font-semibold text-lg truncate">{accommodation!.name}</h3>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => setShowAccInfo((v) => !v)}
                >
                  {showAccInfo ? "Less info" : "More info"}
                </Button>

                {showAccInfo && (
                <div className="mt-4 space-y-2">
                  <AddressDropdown
                    address={accommodation!.address}
                    area={accommodation!.area}
                    province={accommodation!.province}
                    postalCode={accommodation!.postalCode}
                    country={accommodation!.country}
                  />
                  <DirectionsDropdown
                    latitude={accommodation!.latitude}
                    longitude={accommodation!.longitude}
                  />

                  <Collapsible>
                    <CollapsibleTrigger className={triggerClass}>
                      <ChevronDown className="h-4 w-4" />
                      Contact
                    </CollapsibleTrigger>
                    <CollapsibleContent className={contentClass}>
                      {accommodation!.primaryContact ? (
                        <div className="space-y-2">
                          <Label htmlFor="accommodation-contact" className="text-sm text-muted-foreground">Contact Number</Label>
                          <div className="flex gap-2 items-center">
                            <Select value={selectedContact || accommodation!.primaryContact} onValueChange={setSelectedContact}>
                              <SelectTrigger id="accommodation-contact" className="flex-1">
                                <SelectValue placeholder="Select contact method" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={accommodation!.primaryContact}>
                                  Primary: {accommodation!.primaryContact}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="default"
                              size="default"
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                              onClick={() => (window.location.href = `tel:${selectedContact || accommodation!.primaryContact}`)}
                            >
                              <Phone className="h-4 w-4 mr-2" />
                              Call
                            </Button>
                          </div>
                        </div>
                      ) : (
                        fallbackSpan
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible>
                    <CollapsibleTrigger className={triggerClass}>
                      <ChevronDown className="h-4 w-4" />
                      WiFi Credentials
                    </CollapsibleTrigger>
                    <CollapsibleContent className={`${contentClass} text-sm space-y-1`}>
                      {accommodation!.wifiName ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Network:</span>
                            <span className="font-medium">{accommodation!.wifiName}</span>
                          </div>
                          {accommodation!.wifiPassword && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Password:</span>
                              <span className="font-medium">{accommodation!.wifiPassword}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        fallbackSpan
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible>
                    <CollapsibleTrigger className={triggerClass}>
                      <ChevronDown className="h-4 w-4" />
                      Check-in Instructions
                    </CollapsibleTrigger>
                    <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                      {accommodation!.checkInInstructions || fallbackSpan}
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible>
                    <CollapsibleTrigger className={triggerClass}>
                      <ChevronDown className="h-4 w-4" />
                      Amenities
                    </CollapsibleTrigger>
                    <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                      {accommodation!.amenities || fallbackSpan}
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible>
                    <CollapsibleTrigger className={triggerClass}>
                      <ChevronDown className="h-4 w-4" />
                      Guidelines
                    </CollapsibleTrigger>
                    <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                      {accommodation!.guidelines || fallbackSpan}
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible>
                    <CollapsibleTrigger className={triggerClass}>
                      <ChevronDown className="h-4 w-4" />
                      Check-out Instructions
                    </CollapsibleTrigger>
                    <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                      {accommodation!.checkOutInstructions || fallbackSpan}
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible>
                    <CollapsibleTrigger className={triggerClass}>
                      <ChevronDown className="h-4 w-4" />
                      Weather
                    </CollapsibleTrigger>
                    <CollapsibleContent className={`${contentClass} text-sm`}>
                      <a
                        href="https://www.weathersa.co.za"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Visit WeatherSA
                      </a>
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible>
                    <CollapsibleTrigger className={triggerClass}>
                      <ChevronDown className="h-4 w-4" />
                      Tides
                    </CollapsibleTrigger>
                    <CollapsibleContent className={`${contentClass} text-sm`}>
                      <a
                        href="https://www.tides4fishing.com/za"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Visit Tides4Fishing
                      </a>
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible>
                    <CollapsibleTrigger className={triggerClass}>
                      <ChevronDown className="h-4 w-4" />
                      Facilities
                    </CollapsibleTrigger>
                    <CollapsibleContent className={contentClass}>
                      {accommodation!.facilities && accommodation!.facilities.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {accommodation!.facilities.map((facility) => (
                            <span key={facility} className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">
                              {facility}
                            </span>
                          ))}
                        </div>
                      ) : (
                        fallbackSpan
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible>
                    <CollapsibleTrigger className={triggerClass}>
                      <ChevronDown className="h-4 w-4" />
                      Emergency Numbers
                    </CollapsibleTrigger>
                    <CollapsibleContent className={`${contentClass} space-y-2`}>
                      {accommodation!.primaryContact || accommodation!.policeContact || accommodation!.doctorContact || accommodation!.ambulanceContact || accommodation!.hospitalContact || accommodation!.fireDepartmentContact || accommodation!.snakeCatchersContact || accommodation!.nsriContact || accommodation!.vetContact || accommodation!.communityWatchContact || accommodation!.localSecurityContact ? (
                        <>
                          {accommodation!.primaryContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Primary Contact:</span>
                              <a href={`tel:${accommodation!.primaryContact}`} className="font-medium text-purple-600 hover:underline">
                                {accommodation!.primaryContact}
                              </a>
                            </div>
                          )}
                          {accommodation!.policeContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Police Contact:</span>
                              <a href={`tel:${accommodation!.policeContact}`} className="font-medium text-purple-600 hover:underline">
                                {accommodation!.policeContact}
                              </a>
                            </div>
                          )}
                          {accommodation!.doctorContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Doctor Contact:</span>
                              <a href={`tel:${accommodation!.doctorContact}`} className="font-medium text-purple-600 hover:underline">
                                {accommodation!.doctorContact}
                              </a>
                            </div>
                          )}
                          {accommodation!.ambulanceContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Ambulance Contact:</span>
                              <a href={`tel:${accommodation!.ambulanceContact}`} className="font-medium text-purple-600 hover:underline">
                                {accommodation!.ambulanceContact}
                              </a>
                            </div>
                          )}
                          {accommodation!.hospitalContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Hospital Contact:</span>
                              <a href={`tel:${accommodation!.hospitalContact}`} className="font-medium text-purple-600 hover:underline">
                                {accommodation!.hospitalContact}
                              </a>
                            </div>
                          )}
                          {accommodation!.fireDepartmentContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Fire Department:</span>
                              <a href={`tel:${accommodation!.fireDepartmentContact}`} className="font-medium text-purple-600 hover:underline">
                                {accommodation!.fireDepartmentContact}
                              </a>
                            </div>
                          )}
                          {accommodation!.snakeCatchersContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Snake Catchers:</span>
                              <a href={`tel:${accommodation!.snakeCatchersContact}`} className="font-medium text-purple-600 hover:underline">{accommodation!.snakeCatchersContact}</a>
                            </div>
                          )}
                          {accommodation!.nsriContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">NSRI:</span>
                              <a href={`tel:${accommodation!.nsriContact}`} className="font-medium text-purple-600 hover:underline">{accommodation!.nsriContact}</a>
                            </div>
                          )}
                          {accommodation!.vetContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Vet:</span>
                              <a href={`tel:${accommodation!.vetContact}`} className="font-medium text-purple-600 hover:underline">{accommodation!.vetContact}</a>
                            </div>
                          )}
                          {accommodation!.communityWatchContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Community Watch:</span>
                              <a href={`tel:${accommodation!.communityWatchContact}`} className="font-medium text-purple-600 hover:underline">{accommodation!.communityWatchContact}</a>
                            </div>
                          )}
                          {accommodation!.localSecurityContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Local Security:</span>
                              <a href={`tel:${accommodation!.localSecurityContact}`} className="font-medium text-purple-600 hover:underline">{accommodation!.localSecurityContact}</a>
                            </div>
                          )}
                        </>
                      ) : (
                        fallbackSpan
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <div className="space-y-4">
          <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold" onClick={() => setShowMyBookings(true)}>My Bookings</Button>
          {isLocalMode ? (
            <Label className="text-lg font-medium">Local Partners</Label>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
              <Label className="text-lg font-medium">Nearby Partners</Label>
              <div className="w-full md:flex-1 md:max-w-md space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Radius: {radiusKm[0]} km</span>
                </div>
                <Slider value={radiusKm} onValueChange={setRadiusKm} min={10} max={150} step={5} className="w-full" />
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={
                isLocalMode
                  ? "Search by name, category or description…"
                  : "Search by name, cuisine, category…"
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-ellipsis"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(minRating)} onValueChange={(v) => setMinRating(Number(v))}>
              <SelectTrigger className="w-auto min-w-[140px] h-9">
                <Star className="h-4 w-4 mr-1 text-yellow-400 fill-yellow-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any rating</SelectItem>
                <SelectItem value="3">3★ &amp; above</SelectItem>
                <SelectItem value="4">4★ &amp; above</SelectItem>
                <SelectItem value="4.5">4.5★ &amp; above</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant={discountsOnly ? "default" : "outline"}
              size="sm"
              className={discountsOnly ? "h-9 bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black" : "h-9"}
              onClick={() => setDiscountsOnly((v) => !v)}
            >
              <Tag className="h-4 w-4 mr-1" />
              Discounts only
            </Button>
            {(minRating > 0 || discountsOnly || searchQuery.trim()) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => { setMinRating(0); setDiscountsOnly(false); setSearchQuery(""); }}
              >
                Clear
              </Button>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 min-h-[48px]">
              <TabsTrigger value="restaurants" className="min-h-[44px] touch-manipulation">Restaurants ({filteredRestaurants.length})</TabsTrigger>
              <TabsTrigger value="services" className="min-h-[44px] touch-manipulation">Services ({filteredServices.length})</TabsTrigger>
              <TabsTrigger value="attractions" className="min-h-[44px] touch-manipulation">Attractions ({filteredAttractions.length})</TabsTrigger>
              <TabsTrigger value="realestate" className="min-h-[44px] touch-manipulation">Real Estate</TabsTrigger>
            </TabsList>

            <TabsContent value="realestate" className="space-y-3 mt-6">
              <EstateAgenciesBrowse />
            </TabsContent>

            <TabsContent value="restaurants" className="space-y-3 mt-6" {...swipeHandlers}>
              {filteredRestaurants.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    {searchQuery.trim() ? "No restaurants match your search" : isLocalMode ? `No restaurants found in ${localArea}` : `No restaurants found within ${radiusKm[0]}km`}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredRestaurants.map((restaurant) => (
                    <Card key={restaurant.id} className="hover:shadow-md transition-shadow active:scale-[0.98] transition-transform">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <ImageCarousel
                            images={restaurant.imageUrls && restaurant.imageUrls.length > 0 ? restaurant.imageUrls : (restaurant.imageUrl ? [restaurant.imageUrl] : [])}
                            alt={restaurant.name}
                            className="w-full sm:w-20 h-32 sm:h-20 object-cover rounded flex-shrink-0"
                            placeholderClassName="w-full sm:w-20 h-32 sm:h-20 rounded flex-shrink-0"
                            intervalMs={3000}
                          />
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold truncate">{restaurant.name}</h4>
                              {restaurant.littleExplorerApproved && <span title="Child Friendly">👶</span>}
                            </div>

                            <StarRating
                              entityType="restaurant"
                              entityId={Number(restaurant.id)}
                              summary={ratings[ratingKey("restaurant", restaurant.id)]}
                              onRated={applyRatingSummary}
                              readOnly={restaurant.accessLevel === "Booking"}
                            />
                            {restaurant.accessLevel === "Booking" && (
                              <Button
                                size="sm"
                                className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black w-full sm:w-auto"
                                onClick={() => setBookingFor({ entityType: "restaurant", entityId: Number(restaurant.id), entityName: restaurant.name, items: (restaurant.bookingItems || []) as BookItem[] })}
                              >
                                Click here to book at this establishment.
                              </Button>
                            )}
                            {restaurant.discountOffered && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto border-[#AEECE4] text-[#AEECE4]"
                                onClick={() => setRedeemFor({ entityType: "restaurant", entityId: Number(restaurant.id), entityName: restaurant.name, discount: restaurant.discountOffered })}
                              >
                                Redeem discount
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => toggleCard("restaurant:" + restaurant.id)}>
                              {expandedCards.has("restaurant:" + restaurant.id) ? "Less info" : "More info"}
                            </Button>
                            {expandedCards.has("restaurant:" + restaurant.id) && (
                              <>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Description
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {restaurant.description || fallbackSpan}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Cuisine Types
                              </CollapsibleTrigger>
                              <CollapsibleContent className={contentClass}>
                                {restaurant.cuisineTypes.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {restaurant.cuisineTypes.map((cuisine) => (
                                      <span key={cuisine} className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">
                                        {cuisine}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Restaurant Type
                              </CollapsibleTrigger>
                              <CollapsibleContent className={contentClass}>
                                {restaurant.restaurantType && restaurant.restaurantType.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {restaurant.restaurantType.map((rt) => (
                                      <span key={rt} className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">
                                        {rt}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Menu Link
                              </CollapsibleTrigger>
                              <CollapsibleContent className={contentClass}>
                                {restaurant.menuLink ? (
                                  <a
                                    href={restaurant.menuLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-600 hover:underline flex items-center gap-1 text-sm"
                                  >
                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                    <span className="break-all">{restaurant.menuLink}</span>
                                  </a>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Menu (PDF)
                              </CollapsibleTrigger>
                              <CollapsibleContent className={contentClass}>
                                {restaurant.menuPdfUrls && restaurant.menuPdfUrls.length > 0 ? (
                                  <div className="space-y-1">
                                    {restaurant.menuPdfUrls.map((url, i) => (
                                      <a
                                        key={url + i}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-purple-600 hover:underline flex items-center gap-1 text-sm"
                                      >
                                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                        <span>View menu — page {i + 1}</span>
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Payment Options
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {restaurant.paymentCard || restaurant.paymentCash || restaurant.paymentMobile ? (
                                  <div className="flex flex-wrap gap-2">
                                    {restaurant.paymentCard && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Card</span>}
                                    {restaurant.paymentCash && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Cash</span>}
                                    {restaurant.paymentMobile && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Mobile</span>}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Service Options
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {restaurant.serviceDineIn || restaurant.serviceTakeaway || restaurant.serviceDelivery ? (
                                  <div className="flex flex-wrap gap-2">
                                    {restaurant.serviceDineIn && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Dine-in</span>}
                                    {restaurant.serviceTakeaway && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Takeaway</span>}
                                    {restaurant.serviceDelivery && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Delivery</span>}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Accessibility
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {restaurant.wheelchairAccess || restaurant.parkingAvailability ? (
                                  <div className="flex flex-wrap gap-2">
                                    {restaurant.wheelchairAccess && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Wheelchair Access</span>}
                                    {restaurant.parkingAvailability && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Parking Available</span>}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Child Friendly
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {restaurant.littleExplorerApproved ? (
                                  <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">with pleasure</span>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                WiFi Credentials
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm space-y-1`}>
                                {restaurant.wifiNetwork ? (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">Network:</span>
                                      <span className="font-medium">{restaurant.wifiNetwork}</span>
                                    </div>
                                    {restaurant.wifiPassword && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">Password:</span>
                                        <span className="font-medium font-mono">
                                          {visiblePasswords.has(restaurant.id) ? restaurant.wifiPassword : "••••••••"}
                                        </span>
                                        <button
                                          onClick={() => {
                                            const newSet = new Set(visiblePasswords);
                                            if (newSet.has(restaurant.id)) newSet.delete(restaurant.id);
                                            else newSet.add(restaurant.id);
                                            setVisiblePasswords(newSet);
                                          }}
                                          className="text-purple-600 hover:text-purple-700"
                                          title={visiblePasswords.has(restaurant.id) ? "Hide password" : "Show password"}
                                        >
                                          {visiblePasswords.has(restaurant.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Contact
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm space-y-1`}>
                                {restaurant.contactNumber ? (
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Contact Number:</span>
                                    <a href={`tel:${restaurant.contactNumber}`} className="text-purple-600 hover:underline flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {restaurant.contactNumber}
                                    </a>
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Discount and Discount Code
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm`}>
                                {restaurant.discountOffered || restaurant.discountCode ? (
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                                    {restaurant.discountOffered && (
                                      <div className="flex items-center gap-1.5 text-purple-600">
                                        <Tag className="h-4 w-4" />
                                        <span className="font-semibold text-sm whitespace-nowrap">{restaurant.discountOffered}</span>
                                      </div>
                                    )}
                                    {restaurant.discountCode && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-muted-foreground">Code:</span>
                                        <span className="px-2 py-0.5 bg-[#AEECE4] text-black rounded font-mono text-xs font-bold">
                                          {restaurant.discountCode}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <AddressDropdown
                              address={restaurant.address}
                              province={restaurant.province}
                              postalCode={restaurant.postalCode}
                              country={restaurant.country}
                            />
                            <DirectionsDropdown
                              latitude={restaurant.latitude}
                              longitude={restaurant.longitude}
                            />


                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Social Media
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm space-y-2`}>
                                {restaurant.socialsWebsite || restaurant.socialsInstagram || restaurant.socialsTwitter || restaurant.socialsYoutube || restaurant.socialsTiktok ? (
                                  <>
                                    {restaurant.socialsWebsite && (
                                      <div className="flex items-center gap-2">
                                        <Globe className="h-3 w-3 flex-shrink-0" />
                                        <a href={restaurant.socialsWebsite} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline flex items-center gap-1 break-all">
                                          Website <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                        </a>
                                      </div>
                                    )}
                                    {restaurant.socialsInstagram && (
                                      <div className="flex items-center gap-2">
                                        <Instagram className="h-3 w-3 flex-shrink-0" />
                                        <a href={restaurant.socialsInstagram} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline flex items-center gap-1 break-all">
                                          Instagram <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                        </a>
                                      </div>
                                    )}
                                    {restaurant.socialsTwitter && (
                                      <div className="flex items-center gap-2">
                                        <Twitter className="h-3 w-3 flex-shrink-0" />
                                        <a href={restaurant.socialsTwitter} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline flex items-center gap-1 break-all">
                                          X (Twitter) <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                        </a>
                                      </div>
                                    )}
                                    {restaurant.socialsYoutube && (
                                      <div className="flex items-center gap-2">
                                        <Youtube className="h-3 w-3 flex-shrink-0" />
                                        <a href={restaurant.socialsYoutube} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline flex items-center gap-1 break-all">
                                          YouTube <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                        </a>
                                      </div>
                                    )}
                                    {restaurant.socialsTiktok && (
                                      <div className="flex items-center gap-2">
                                        <Music className="h-3 w-3 flex-shrink-0" />
                                        <a href={restaurant.socialsTiktok} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline flex items-center gap-1 break-all">
                                          TikTok <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                        </a>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="services" className="space-y-3 mt-6" {...swipeHandlers}>
              {filteredServices.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    {searchQuery.trim() ? "No services match your search" : isLocalMode ? `No services found in ${localArea}` : `No services found within ${radiusKm[0]}km`}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredServices.map((service) => (
                    <Card key={service.id} className="hover:shadow-md transition-shadow active:scale-[0.98] transition-transform">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <ImageCarousel
                            images={service.imageUrls && service.imageUrls.length > 0 ? service.imageUrls : (service.imageUrl ? [service.imageUrl] : [])}
                            alt={service.name}
                            className="w-full sm:w-20 h-32 sm:h-20 object-cover rounded flex-shrink-0"
                            placeholderClassName="w-full sm:w-20 h-32 sm:h-20 rounded flex-shrink-0"
                            intervalMs={3000}
                          />
                          <div className="flex-1 min-w-0 space-y-2">
                            <h4 className="font-semibold truncate">{service.name}</h4>

                            <StarRating
                              entityType="service"
                              entityId={Number(service.id)}
                              summary={ratings[ratingKey("service", service.id)]}
                              onRated={applyRatingSummary}
                              readOnly={service.accessLevel === "Booking"}
                            />
                            {service.accessLevel === "Booking" && (
                              <Button
                                size="sm"
                                className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black w-full sm:w-auto"
                                onClick={() => setBookingFor({ entityType: "service", entityId: Number(service.id), entityName: service.name, items: (service.bookingItems || []) as BookItem[] })}
                              >
                                Click here to book at this establishment.
                              </Button>
                            )}
                            {service.discountOffered && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto border-[#AEECE4] text-[#AEECE4]"
                                onClick={() => setRedeemFor({ entityType: "service", entityId: Number(service.id), entityName: service.name, discount: service.discountOffered })}
                              >
                                Redeem discount
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => toggleCard("service:" + service.id)}>
                              {expandedCards.has("service:" + service.id) ? "Less info" : "More info"}
                            </Button>
                            {expandedCards.has("service:" + service.id) && (
                              <>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Description
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {service.description || fallbackSpan}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Service Categories
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {service.serviceCategories && service.serviceCategories.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {service.serviceCategories.map((category) => (
                                      <span key={category} className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">
                                        {category}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Payment Options
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {service.paymentCard || service.paymentCash || service.paymentMobile ? (
                                  <div className="flex flex-wrap gap-2">
                                    {service.paymentCard && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Card</span>}
                                    {service.paymentCash && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Cash</span>}
                                    {service.paymentMobile && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Mobile</span>}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Accessibility
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {service.wheelchairAccess || service.parkingAvailability ? (
                                  <div className="flex flex-wrap gap-2">
                                    {service.wheelchairAccess && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Wheelchair Access</span>}
                                    {service.parkingAvailability && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Parking Available</span>}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Child Friendly
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {service.littleExplorerApproved ? (
                                  <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">with pleasure</span>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Contact
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm space-y-1`}>
                                {service.contactNumber ? (
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Contact Number:</span>
                                    <a href={`tel:${service.contactNumber}`} className="text-purple-600 hover:underline flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {service.contactNumber}
                                    </a>
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Discount and Discount Code
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm`}>
                                {service.discountOffered || service.discountCode ? (
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                                    {service.discountOffered && (
                                      <div className="flex items-center gap-1.5 text-purple-600">
                                        <Tag className="h-4 w-4" />
                                        <span className="font-semibold text-sm whitespace-nowrap">{service.discountOffered}</span>
                                      </div>
                                    )}
                                    {service.discountCode && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-muted-foreground">Code:</span>
                                        <span className="px-2 py-0.5 bg-[#AEECE4] text-black rounded font-mono text-xs font-bold">
                                          {service.discountCode}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <AddressDropdown
                              address={service.address}
                              province={service.province}
                              postalCode={service.postalCode}
                              country={service.country}
                            />
                            <DirectionsDropdown
                              latitude={service.latitude}
                              longitude={service.longitude}
                            />
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="attractions" className="space-y-3 mt-6" {...swipeHandlers}>
              {filteredAttractions.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    {searchQuery.trim() ? "No attractions match your search" : isLocalMode ? `No attractions found in ${localArea}` : `No attractions found within ${radiusKm[0]}km`}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredAttractions.map((attraction) => (
                    <Card key={attraction.id} className="hover:shadow-md transition-shadow active:scale-[0.98] transition-transform">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <ImageCarousel
                            images={attraction.imageUrls && attraction.imageUrls.length > 0 ? attraction.imageUrls : (attraction.imageUrl ? [attraction.imageUrl] : [])}
                            alt={attraction.name}
                            className="w-full sm:w-20 h-32 sm:h-20 object-cover rounded flex-shrink-0"
                            placeholderClassName="w-full sm:w-20 h-32 sm:h-20 rounded flex-shrink-0"
                            intervalMs={3000}
                          />
                          <div className="flex-1 min-w-0 space-y-2">
                            <h4 className="font-semibold truncate">{attraction.name}</h4>

                            <StarRating
                              entityType="attraction"
                              entityId={Number(attraction.id)}
                              summary={ratings[ratingKey("attraction", attraction.id)]}
                              onRated={applyRatingSummary}
                              readOnly={attraction.accessLevel === "Booking"}
                            />
                            {attraction.accessLevel === "Booking" && (
                              <Button
                                size="sm"
                                className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black w-full sm:w-auto"
                                onClick={() => setBookingFor({ entityType: "attraction", entityId: Number(attraction.id), entityName: attraction.name, items: (attraction.bookingItems || []) as BookItem[] })}
                              >
                                Click here to book at this establishment.
                              </Button>
                            )}
                            {attraction.discountOffered && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto border-[#AEECE4] text-[#AEECE4]"
                                onClick={() => setRedeemFor({ entityType: "attraction", entityId: Number(attraction.id), entityName: attraction.name, discount: attraction.discountOffered })}
                              >
                                Redeem discount
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => toggleCard("attraction:" + attraction.id)}>
                              {expandedCards.has("attraction:" + attraction.id) ? "Less info" : "More info"}
                            </Button>
                            {expandedCards.has("attraction:" + attraction.id) && (
                              <>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Description
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {attraction.description || fallbackSpan}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Attraction Categories
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {attraction.attractionType && attraction.attractionType.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {attraction.attractionType.map((type) => (
                                      <span key={type} className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">
                                        {type}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Payment Options
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {attraction.paymentCard || attraction.paymentCash || attraction.paymentMobile ? (
                                  <div className="flex flex-wrap gap-2">
                                    {attraction.paymentCard && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Card</span>}
                                    {attraction.paymentCash && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Cash</span>}
                                    {attraction.paymentMobile && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Mobile</span>}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Accessibility
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {attraction.wheelchairAccess || attraction.parkingAvailability ? (
                                  <div className="flex flex-wrap gap-2">
                                    {attraction.wheelchairAccess && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Wheelchair Access</span>}
                                    {attraction.parkingAvailability && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">Parking Available</span>}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Child Friendly
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {attraction.littleExplorerApproved ? (
                                  <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">with pleasure</span>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Contact
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm space-y-1`}>
                                {attraction.contactNumber ? (
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Contact Number:</span>
                                    <a href={`tel:${attraction.contactNumber}`} className="text-purple-600 hover:underline flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {attraction.contactNumber}
                                    </a>
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Discount and Discount Code
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm`}>
                                {attraction.discountOffered || attraction.discountCode ? (
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                                    {attraction.discountOffered && (
                                      <div className="flex items-center gap-1.5 text-purple-600">
                                        <Tag className="h-4 w-4" />
                                        <span className="font-semibold text-sm whitespace-nowrap">{attraction.discountOffered}</span>
                                      </div>
                                    )}
                                    {attraction.discountCode && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-muted-foreground">Code:</span>
                                        <span className="px-2 py-0.5 bg-[#AEECE4] text-black rounded font-mono text-xs font-bold">
                                          {attraction.discountCode}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <AddressDropdown
                              address={attraction.address}
                              province={attraction.province}
                              postalCode={attraction.postalCode}
                              country={attraction.country}
                            />
                            <DirectionsDropdown
                              latitude={attraction.latitude}
                              longitude={attraction.longitude}
                            />
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        {bookingFor && (
          <BookingModal
            onClose={() => setBookingFor(null)}
            entityType={bookingFor.entityType}
            entityId={bookingFor.entityId}
            entityName={bookingFor.entityName}
            items={bookingFor.items}
          />
        )}
        {redeemFor && (
          <RedeemModal
            onClose={() => setRedeemFor(null)}
            entityType={redeemFor.entityType}
            entityId={redeemFor.entityId}
            entityName={redeemFor.entityName}
            discount={redeemFor.discount}
          />
        )}
        {showMyBookings && <MyBookingsModal onClose={() => setShowMyBookings(false)} />}
        <SwipeIndicator show={filteredRestaurants.length > 0 || filteredServices.length > 0 || filteredAttractions.length > 0} />
      </div>
    </div>
  );
}

// StarRating is the guest-facing, tap-to-rate widget. Deliberately NOT used on
// the Accommodation card above — guests rate Restaurants, Services and
// Attractions only.
//
// One tap submits immediately (no separate save button: on mobile a second tap
// is a second chance to lose the vote). Once submitted, the server returns the
// recalculated summary, which replaces the local copy.
//
// Re-voting is allowed and overwrites the previous vote — the DB's unique
// constraint on (entity_type, entity_id, voter_key) means it updates rather
// than stacking a second vote.
function StarRating({
  entityType,
  entityId,
  summary,
  onRated,
  readOnly = false,
}: {
  entityType: RatableType;
  entityId: number;
  summary?: RatingSummary;
  onRated: (summary: RatingSummary) => void;
  readOnly?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const myRating = summary?.myRating ?? 0;
  const average = summary?.averageRating ?? 0;
  const count = summary?.ratingCount ?? 0;

  // Hover preview wins while the pointer is over the row; otherwise show the
  // guest's own vote. Touch devices never fire hover, so they just see myRating.
  const highlighted = readOnly ? Math.round(average) : hovered || myRating;

  const submit = async (stars: number) => {
    if (saving) return;
    setSaving(true);
    try {
      const backend = getAuthenticatedBackend();
      const res = await backend.rating.submitRating({ entityType, entityId, stars });
      const updated = (res as { summary?: RatingSummary }).summary;
      if (updated) onRated(updated);
      toast({
        title: "Thanks for rating",
        description: `You gave ${stars} star${stars === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      console.error("Failed to submit rating:", error);
      toast({
        title: "Error",
        description: "Could not save your rating. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={saving || readOnly}
            aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
            onClick={() => { if (!readOnly) submit(star); }}
            onMouseEnter={() => setHovered(star)}
            className="p-0.5 -m-0.5 disabled:opacity-50 touch-manipulation"
          >
            <Star
              className={`h-5 w-5 sm:h-4 sm:w-4 transition-colors ${
                star <= highlighted
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/40"
              }`}
            />
          </button>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {count > 0 ? `${average.toFixed(1)} (${count})` : "Be the first to rate"}
        {!readOnly && myRating > 0 ? " \u00B7 you rated this" : ""}
      </span>
    </div>
  );
}


function BookingModal({ onClose, entityType, entityId, entityName, items }: {
  onClose: () => void; entityType: RatableType; entityId: number; entityName: string; items: BookItem[];
}) {
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [partySize, setPartySize] = useState<number>(0);
  const isRestaurant = entityType === "restaurant";
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateOptions = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const label = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    return { iso, label };
  });
  const timeOptions: string[] = [];
  for (let h = 8; h <= 20; h++) { for (const m of [0, 30]) { timeOptions.push(`${pad(h)}:${pad(m)}`); } }
  const chosen = items.filter((_, i) => selected[i]);
  const total = chosen.reduce((sum, it) => sum + (Number(it.price) || 0), 0);
  const submit = async () => {
    const missingSelection = isRestaurant ? partySize === 0 : chosen.length === 0;
    if (missingSelection || !name.trim() || !email.trim() || !date) {
      toast({
        title: "A few details missing",
        description: isRestaurant
          ? "Choose a table size and fill in your name, email and a date."
          : "Pick at least one item and fill in your name, email and a date.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const backend = getAuthenticatedBackend();
      await backend.booking.create({
        entityType, entityId: Number(entityId),
        customerName: name.trim(), customerEmail: email.trim(), customerPhone: phone.trim(),
        bookingDate: date, bookingTime: time,
        items: isRestaurant ? [] : chosen.map((it) => ({ name: it.name, price: Number(it.price) || 0, duration: Number(it.duration) || 0 })),
        partySize: isRestaurant ? partySize : undefined,
      });
      toast({ title: "Booking requested", description: `Your booking with ${entityName} has been sent.` });
      onClose();
    } catch (error: any) {
      toast({ title: "Booking failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Book {entityName}</h3>
        {isRestaurant ? (
          <div className="space-y-2">
            <Label className="text-sm">Table size</Label>
            <Select value={partySize ? String(partySize) : ""} onValueChange={(v) => setPartySize(Number(v))}>
              <SelectTrigger><SelectValue placeholder="How many people?" /></SelectTrigger>
              <SelectContent>
                {[1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "person" : "people"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Reserve a table — no pre-payment; you settle your bill with the restaurant.</p>
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">This partner hasn't listed any bookable items yet.</p>
        ) : (
          <div className="space-y-2">
            <Label className="text-sm">Select items</Label>
            {items.map((it, i) => (
              <label key={i} className="flex items-center justify-between gap-2 border rounded-md p-2 cursor-pointer">
                <span className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!selected[i]} onChange={() => setSelected((s) => ({ ...s, [i]: !s[i] }))} />
                  {it.name}{it.duration ? ` · ${it.duration} min` : ""}
                </span>
                <span className="text-sm font-medium whitespace-nowrap">R {(Number(it.price) || 0).toFixed(2)}</span>
              </label>
            ))}
            <div className="flex justify-between text-sm font-semibold pt-1"><span>Total</span><span>R {total.toFixed(2)}</span></div>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Select value={date} onValueChange={setDate}>
            <SelectTrigger><SelectValue placeholder="Choose a date" /></SelectTrigger>
            <SelectContent>{dateOptions.map((d) => (<SelectItem key={d.iso} value={d.iso}>{d.label}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Time (optional)</Label>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger><SelectValue placeholder="Any time" /></SelectTrigger>
            <SelectContent>{timeOptions.map((tOpt) => (<SelectItem key={tOpt} value={tOpt}>{tOpt}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">Your name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Phone (optional)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <p className="text-xs text-muted-foreground">You can change or cancel this booking yourself from "My Bookings" using this email. The partner cannot change or cancel it.</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black">{saving ? "Sending…" : "Confirm Booking"}</Button>
        </div>
      </div>
    </div>
  );
}

function RedeemModal({ onClose, entityType, entityId, entityName, discount }: {
  onClose: () => void; entityType: RatableType; entityId: number; entityName: string; discount?: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  useEffect(() => {
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const r = await backend.redemption.start({ entityType, entityId });
        setToken((r as { token: string }).token);
      } catch (error: any) {
        toast({ title: "Couldn't start redemption", description: error?.message || "Please try again.", variant: "destructive" });
        onClose();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);
  const qrUrl = token
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(token)}&bgcolor=000000&color=39FF14&margin=10`
    : "";
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-lg max-w-sm w-full p-5 space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Redeem at {entityName}</h3>
        {discount && <p className="text-sm text-[#AEECE4] font-medium">{discount}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Preparing your code…</p>
        ) : token ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="Your discount QR code" className="mx-auto rounded-lg" width={280} height={280} />
            <p className="text-xs text-muted-foreground">
              Show this to the venue so they can scan it. Once redeemed, you'll be able to rate your experience.
            </p>
            <p className="text-xs font-mono break-all text-muted-foreground">Code: {token}</p>
          </>
        ) : null}
        <Button variant="outline" onClick={onClose} className="w-full">Close</Button>
      </div>
    </div>
  );
}

function InlineRater({ entityType, entityId }: { entityType: RatableType; entityId: number }) {
  const [saved, setSaved] = useState(0);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const rate = async (stars: number) => {
    if (saving) return;
    setSaving(true);
    try {
      const backend = getAuthenticatedBackend();
      await backend.rating.submitRating({ entityType, entityId, stars });
      setSaved(stars);
      toast({ title: "Thanks for rating", description: `You gave ${stars} star${stars === 1 ? "" : "s"}.` });
    } catch (error: any) {
      toast({ title: "Couldn't save rating", description: error?.message || "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  };
  return (
    <div className="flex items-center gap-1 pt-1">
      <span className="text-xs text-muted-foreground mr-1">Rate your visit:</span>
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" disabled={saving} onClick={() => rate(s)} className="disabled:opacity-50">
          <Star className={`h-4 w-4 ${s <= saved ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
        </button>
      ))}
    </div>
  );
}

function MyBookingsModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [bookings, setBookings] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const { toast } = useToast();
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const dateOptions = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const label = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    return { iso, label };
  });
  const timeOptions: string[] = [];
  for (let h = 8; h <= 20; h++) { for (const m of [0, 30]) { timeOptions.push(`${pad(h)}:${pad(m)}`); } }
  const find = async () => {
    if (!email.trim()) { toast({ title: "Enter your email", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const backend = getAuthenticatedBackend();
      const res = await backend.booking.mine({ email: email.trim() });
      setBookings((res as { bookings?: any[] }).bookings || []);
    } catch (error: any) {
      toast({ title: "Couldn't load bookings", description: error?.message || "Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  };
  const cancel = async (id: number) => {
    setBusyId(id);
    try {
      const backend = getAuthenticatedBackend();
      await backend.booking.cancel({ id, email: email.trim() });
      setBookings((prev) => (prev || []).map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)));
      toast({ title: "Booking cancelled" });
    } catch (error: any) {
      toast({ title: "Couldn't cancel", description: error?.message || "Please try again.", variant: "destructive" });
    } finally { setBusyId(null); }
  };
  const startEdit = (b: any) => { setEditingId(b.id); setEditDate(b.bookingDate || ""); setEditTime(b.bookingTime || ""); };
  const saveEdit = async (id: number) => {
    if (!editDate) { toast({ title: "Pick a date", variant: "destructive" }); return; }
    setBusyId(id);
    try {
      const backend = getAuthenticatedBackend();
      await backend.booking.update({ id, email: email.trim(), bookingDate: editDate, bookingTime: editTime });
      setBookings((prev) => (prev || []).map((b) => (b.id === id ? { ...b, bookingDate: editDate, bookingTime: editTime } : b)));
      setEditingId(null);
      toast({ title: "Booking updated" });
    } catch (error: any) {
      toast({ title: "Couldn't update", description: error?.message || "Please try again.", variant: "destructive" });
    } finally { setBusyId(null); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">My Bookings</h3>
        <p className="text-xs text-muted-foreground">Enter the email you booked with to see, cancel, or rate your bookings.</p>
        <div className="flex gap-2">
          <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={find} disabled={loading} className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black whitespace-nowrap">{loading ? "…" : "Find"}</Button>
        </div>
        {bookings !== null &&
          (bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings found for that email.</p>
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => (
                <div key={b.id} className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{b.entityName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${b.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{b.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{b.bookingDate}{b.bookingTime ? ` · ${b.bookingTime}` : ""} · R {(Number(b.total) || 0).toFixed(2)}</div>
                  {Array.isArray(b.items) && b.items.length > 0 && (<div className="text-xs">{b.items.map((it: any) => it.name).join(", ")}</div>)}
                  {b.status !== "cancelled" && editingId === b.id ? (
                    <div className="space-y-2 pt-1">
                      <div className="space-y-1">
                        <Label className="text-xs">New date</Label>
                        <Select value={editDate} onValueChange={setEditDate}>
                          <SelectTrigger><SelectValue placeholder="Choose a date" /></SelectTrigger>
                          <SelectContent>{dateOptions.map((d) => (<SelectItem key={d.iso} value={d.iso}>{d.label}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">New time (optional)</Label>
                        <Select value={editTime} onValueChange={setEditTime}>
                          <SelectTrigger><SelectValue placeholder="Any time" /></SelectTrigger>
                          <SelectContent>{timeOptions.map((tOpt) => (<SelectItem key={tOpt} value={tOpt}>{tOpt}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black" onClick={() => saveEdit(b.id)} disabled={busyId === b.id}>
                          {busyId === b.id ? "Saving…" : "Save"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingId(null)} disabled={busyId === b.id}>Cancel</Button>
                      </div>
                    </div>
                  ) : b.status !== "cancelled" ? (
                    <div className="flex gap-2">
                      {b.bookingDate >= todayStr && (
                        <Button variant="outline" size="sm" onClick={() => startEdit(b)} disabled={busyId === b.id}>Edit date/time</Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => cancel(b.id)} disabled={busyId === b.id}>
                        {busyId === b.id ? "Cancelling…" : "Cancel booking"}
                      </Button>
                    </div>
                  ) : null}
                  {b.status !== "cancelled" && b.bookingDate && b.bookingDate <= todayStr && (
                    <InlineRater entityType={b.entityType} entityId={Number(b.entityId)} />
                  )}
                </div>
              ))}
            </div>
          ))}
        <div className="flex justify-end pt-1"><Button variant="outline" onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}
