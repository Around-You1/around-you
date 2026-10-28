import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Phone, ExternalLink, Tag, ChevronDown, ChevronLeft, ChevronRight, Search, Eye, EyeOff, MapPin, Globe, Instagram, Twitter, Youtube, Music, Star } from "lucide-react";
import AddressDropdown from "../components/AddressDropdown";
import DirectionsDropdown from "../components/DirectionsDropdown";
import AddressDirectionsButton from "../components/AddressDirectionsButton";
import WhatsAppButton from "../components/WhatsAppButton";
import { getAuthenticatedBackend } from "../lib/backend";
import { getCurrentPosition } from "../lib/geolocation";
import { useToast } from "@/components/ui/use-toast";
import { useSwipe } from "../lib/useSwipe";
import ImageCarousel from "../components/ImageCarousel";
import RestaurantPreOrder from "../components/RestaurantPreOrder";
import { useTutorial } from "../components/tutorial/TutorialProvider";
import WifiConnect from "../components/WifiConnect";
import SupportBadge from "../components/SupportBadge";
import { EstateAgenciesBrowse } from "../components/EstatePublic";
import SwipeIndicator from "../components/SwipeIndicator";
import type { Accommodation } from "~backend/accommodation/types";
import type { Restaurant } from "~backend/restaurant/types";
import type { ServiceData } from "~backend/service/types";
import type { AttractionData } from "~backend/attraction/types";
import AppLogo from "../components/AppLogo";
import AppInstallButtons from "../components/AppInstallButtons";
import AccommodationForm from "../components/AccommodationForm";
import SuggestionsBanner from "../components/SuggestionsBanner";
import EmergencyButton from "../components/EmergencyButton";
import SuggestionsManager from "../components/SuggestionsManager";

const FALLBACK = "The company has opted not to make this information visible.";

// Visibility is fully open: every profile is treated as the old "Both" audience
// + "Premium" tier, so all content (Address, Directions, etc.) shows to both
// Guests and Locals regardless of the partner's stored audience/tier.
const tierOf = (_accessLevel?: string) => 4;

// Mirrors backend/app/rating/types.go Summary. myRating is 0/absent until
// this guest has voted; averageRating/ratingCount cover everyone's votes.
interface RatingSummary {
  entityType: string;
  entityId: number;
  averageRating: number;
  ratingCount: number;
  myRating?: number;
}

type RatableType = "restaurant" | "service" | "attraction" | "retail" | "nonprofit";
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
  const [retail, setRetail] = useState<ServiceData[]>([]);
  const [nonprofits, setNonprofits] = useState<ServiceData[]>([]);
  const [filteredRetail, setFilteredRetail] = useState<ServiceData[]>([]);
  const [filteredNpo, setFilteredNpo] = useState<ServiceData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [minRating, setMinRating] = useState(0); // 0 = Any; else 3 / 4 / 4.5
  const [sortBy, setSortBy] = useState<"alphabetical" | "discounts" | "stampcards">("alphabetical");
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
    { entityType: RatableType; entityId: number; entityName: string; discount?: string; discountCode?: string } | null
  >(null);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [showMyStamps, setShowMyStamps] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showAccInfo, setShowAccInfo] = useState(false);
  // Accommodation owner self-service edit (unlocked with the Edit Code).
  const [showEditGate, setShowEditGate] = useState(false);
  const [ownerEditCode, setOwnerEditCode] = useState("");
  const [verifyingOwner, setVerifyingOwner] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [verifiedOwnerCode, setVerifiedOwnerCode] = useState("");
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
  // Guided tutorial: Holiday Guests hear VO4 on arrival (not Local guests).
  const tutorial = useTutorial();
  useEffect(() => {
    if (tutorial && !isLocalMode) tutorial.play("VO4");
  }, [tutorial, isLocalMode]);
  const localPostal: string = user.postalCode || "";

  // "Test" partner isolation: a partner (or the guesthouse) is a test entity when
  // its name starts with the word "Test" (e.g. "Test Guesthouse", "Test Spa").
  // A guest who signed in with the Test Guesthouse access code sees ONLY test
  // partners; every other guest and every local sees everything EXCEPT test
  // partners. This keeps test data invisible to real users.
  const isTestName = (name?: string) => /^\s*test(?![a-z])/i.test(name || "");
  // Non-generic (returns any[]) so the filtered arrays stay assignable to the
  // Restaurant[] / ServiceData[] / AttractionData[] state setters.
  const filterTestVisibility = (items: any[], showOnlyTest: boolean): any[] =>
    (items || []).filter((x) => (showOnlyTest ? isTestName(x?.name) : !isTestName(x?.name)));

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
    if (discOffered(e).trim()) {
      kw.push("discount", "special", "offer", discOffered(e));
    }
    return kw;
  };

  // Guests see discountOffered/discountCode; Locals see the local_* variants.
  // A discount only appears when the partner has ticked the enable-checkbox for
  // that audience (discountEnabled / localDiscountEnabled). Older API responses
  // that predate the flag are treated as enabled so nothing silently vanishes.
  const discEnabled = (e: any): boolean => {
    const flag = isLocalMode ? e.localDiscountEnabled : e.discountEnabled;
    return flag === undefined || flag === null ? true : Boolean(flag);
  };
  const discOffered = (e: any): string => (discEnabled(e) ? String((isLocalMode ? e.localDiscountOffered : e.discountOffered) || "") : "");
  const discCode = (e: any): string => (discEnabled(e) ? String((isLocalMode ? e.localDiscountCode : e.discountCode) || "") : "");

  const hasDiscount = (e: any): boolean => !!discOffered(e).trim();

  // For the "Sort by" dropdown: whether a partner has a discount or a stamp card
  // visible to THIS audience (Guest page: guest+both; Local page: local+both).
  // Discounts come from the classic discount fields (non-retail) or a retail
  // "discount" special; stamp cards come from a retail "stampcard" special.
  const audienceVisible = (a: string) => a === "both" || (isLocalMode ? a === "local" : a === "guest");
  const retailHasType = (e: any, kind: "discount" | "stampcard"): boolean =>
    ((((e as any).specials) || []) as any[]).some((sp) => sp && sp.enabled && sp.line1 && sp.type === kind && audienceVisible(sp.audience));
  const entityHasDiscount = (e: any): boolean => hasDiscount(e) || retailHasType(e, "discount");
  const entityHasStampCard = (e: any): boolean => retailHasType(e, "stampcard");

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
        const ratingOk = passesRating(entityType, e.id);
        // "Discounts" / "My Stamp Cards" now FILTER the list: only partners who
        // offer that (for this audience) are shown; everyone else is excluded.
        const categoryOk =
          sortBy === "discounts" ? entityHasDiscount(e)
          : sortBy === "stampcards" ? entityHasStampCard(e)
          : true;
        return searchOk && ratingOk && categoryOk;
      });
      const byName = (a: T, b: T) => (a.name || "").localeCompare(b.name || "");
      return [...filtered].sort(byName);
    };
    setFilteredRestaurants(applyAll("restaurant", restaurants, (r) => [...(r.cuisineTypes || []), ...(r.restaurantType || [])]));
    setFilteredServices(applyAll("service", services, (s) => s.serviceCategories || []));
    setFilteredAttractions(applyAll("attraction", attractions, (a) => a.attractionType || []));
    setFilteredRetail(applyAll("retail", retail, (s) => s.serviceCategories || []));
    setFilteredNpo(applyAll("nonprofit", nonprofits, (s) => s.serviceCategories || []));
  }, [searchQuery, restaurants, services, attractions, retail, nonprofits, ratings, minRating, sortBy, isLocalMode]);

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

  // Locals see every partner within a fixed 50 km radius of where they are.
  // We centre the search on the browser's GPS position. Mobile partners (who
  // work from the client's address and have no coordinates) are matched to the
  // local's own postal code. If GPS is unavailable, the backend falls back to
  // a postal-code match for everyone.
  const LOCAL_RADIUS_KM = 50;
  const loadPartnersByArea = async () => {
    const backend = getAuthenticatedBackend();
    const apply = (r: any, s: any, a: any, ret: any, npo: any) => {
      // Locals never have a test guesthouse, so they never see test partners.
      const rr = filterTestVisibility(r.restaurants, false);
      const ss = filterTestVisibility(s.services, false);
      const aa = filterTestVisibility(a.attractions, false);
      const retl = filterTestVisibility(ret.services, false);
      const npol = filterTestVisibility(npo.services, false);
      setRestaurants(rr);
      setServices(ss);
      setAttractions(aa);
      setRetail(retl);
      setNonprofits(npol);
      setFilteredRestaurants(rr);
      setFilteredServices(ss);
      setFilteredAttractions(aa);
      setFilteredRetail(retl);
      setFilteredNpo(npol);
      void loadRatings(rr, ss, aa);
    };
    try {
      let coords: { latitude: number; longitude: number } | null = null;
      try {
        coords = await getCurrentPosition();
      } catch {
        coords = null;
      }
      const lat = coords ? coords.latitude : 0;
      const lng = coords ? coords.longitude : 0;
      const [r, s, ret, npo, a] = await Promise.all([
        backend.restaurant.listNearby({ latitude: lat, longitude: lng, radiusKm: LOCAL_RADIUS_KM, postalCode: localPostal }),
        backend.service.listNearby({ latitude: lat, longitude: lng, radiusKm: LOCAL_RADIUS_KM, postalCode: localPostal, nonProfit: false }),
        backend.retail.listNearby({ latitude: lat, longitude: lng, radiusKm: LOCAL_RADIUS_KM, postalCode: localPostal }),
        backend.nonprofit.listNearby({ latitude: lat, longitude: lng, radiusKm: LOCAL_RADIUS_KM, postalCode: localPostal }),
        backend.attraction.listNearby({ latitude: lat, longitude: lng, radiusKm: LOCAL_RADIUS_KM, postalCode: localPostal }),
      ]);
      apply(r, s, a, ret, npo);
    } catch (error) {
      console.error("Failed to load local partners:", error);
      toast({ title: "Error", description: "Failed to load local partners", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadNearbyPartners = async () => {
    if (!accommodation) return;
    if (accommodation!.latitude == null || accommodation!.longitude == null) return;
    try {
      const backend = getAuthenticatedBackend();
      const [restaurantData, serviceData, retailData, npoData, attractionData] = await Promise.all([
        backend.restaurant.listNearby({ latitude: accommodation!.latitude, longitude: accommodation!.longitude, radiusKm: radiusKm[0], postalCode: accommodation!.postalCode || "" }),
        backend.service.listNearby({ latitude: accommodation!.latitude, longitude: accommodation!.longitude, radiusKm: radiusKm[0], postalCode: accommodation!.postalCode || "", nonProfit: false }),
        backend.retail.listNearby({ latitude: accommodation!.latitude, longitude: accommodation!.longitude, radiusKm: radiusKm[0], postalCode: accommodation!.postalCode || "" }),
        backend.nonprofit.listNearby({ latitude: accommodation!.latitude, longitude: accommodation!.longitude, radiusKm: radiusKm[0], postalCode: accommodation!.postalCode || "" }),
        backend.attraction.listNearby({ latitude: accommodation!.latitude, longitude: accommodation!.longitude, radiusKm: radiusKm[0], postalCode: accommodation!.postalCode || "" }),
      ]);
      // Only the Test Guesthouse sees test partners; everyone else never does.
      const showOnlyTest = isTestName(accommodation!.name);
      const rr = filterTestVisibility(restaurantData.restaurants, showOnlyTest);
      const ss = filterTestVisibility((serviceData as any).services || [], showOnlyTest);
      const retl = filterTestVisibility((retailData as any).services || [], showOnlyTest);
      const npol = filterTestVisibility((npoData as any).services || [], showOnlyTest);
      const aa = filterTestVisibility(attractionData.attractions, showOnlyTest);
      setRestaurants(rr);
      setServices(ss);
      setAttractions(aa);
      setRetail(retl);
      setNonprofits(npol);
      setFilteredRestaurants(rr);
      setFilteredServices(ss);
      setFilteredAttractions(aa);
      setFilteredRetail(retl);
      setFilteredNpo(npol);
      void loadRatings(rr, ss, aa);
    } catch (error) {
      console.error("Failed to load nearby partners:", error);
      toast({ title: "Error", description: "Failed to load nearby partners", variant: "destructive" });
    }
  };

  // Verify the owner's Edit Code server-side, then reveal the editable profile
  // form. Any accommodation session can see the gate; only the owner holds the
  // code, so only they can unlock it.
  const verifyOwnerAndEdit = async () => {
    if (!accommodation) return;
    if (!ownerEditCode.trim()) {
      toast({ title: "Enter your edit code", variant: "destructive" });
      return;
    }
    setVerifyingOwner(true);
    try {
      const b = getAuthenticatedBackend();
      const res = await b.editCode.verify({ entityType: "accommodation", entityId: accommodation.id, code: ownerEditCode.trim() });
      if ((res as { valid?: boolean }).valid) {
        setVerifiedOwnerCode(ownerEditCode.trim());
        setOwnerEditCode("");
        setShowEditGate(false);
        setEditingProfile(true);
      } else {
        toast({ title: "Incorrect code", description: "That edit code doesn't match. Check with the Around You team if unsure.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Couldn't verify", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setVerifyingOwner(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#39FF14]/10 to-background flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!isLocalMode && !accommodation) {
    // Only a genuine Holiday Guest (role "Guest") whose access code has no
    // accommodation attached should ever see an accommodation message. A Local
    // has nothing to do with accommodations, so if a local session ever reaches
    // here without its role, send them back to sign in instead.
    const isGuest = user.role === "Guest";
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#39FF14]/10 to-background flex items-center justify-center p-6">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <p>{isGuest ? "No accommodation assigned" : "Your session has ended. Please sign in again."}</p>
            {!isGuest && (
              <Button
                className="bg-[#39FF14] hover:bg-[#39FF14]/90 text-black font-semibold"
                onClick={() => { window.location.href = "/portal"; }}
              >
                Sign In
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Owner editing their own accommodation profile (Edit Code verified above).
  if (editingProfile && accommodation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#39FF14]/10 to-background p-6">
        <div className="max-w-4xl mx-auto py-8">
          <AccommodationForm
            accommodation={accommodation}
            partnerEdit
            editCode={verifiedOwnerCode}
            onClose={() => {
              setEditingProfile(false);
              loadAccommodationDetails();
            }}
          />
          <div className="mt-6">
            <SuggestionsManager ownerType="accommodation" ownerId={accommodation.id} editCode={verifiedOwnerCode} />
          </div>
        </div>
      </div>
    );
  }

  const triggerClass = "flex items-center gap-2 text-sm font-medium hover:text-black transition-colors w-full text-left";
  const contentClass = "pl-6 pt-2";
  const fallbackSpan = <span className="text-sm text-muted-foreground italic">{FALLBACK}</span>;

  // NPO / PBO businesses are services flagged is_nonprofit; split them out of
  // Business/Services into their own tab, sharing one card renderer.
  const bizServices = filteredServices;
  const retailServices = filteredRetail;
  const npoServices = filteredNpo;
  const renderServiceCard = (service: ServiceData, entityType: "service" | "retail" | "nonprofit" = "service") => {
    const isNpo = entityType === "nonprofit";
    const isRetail = entityType === "retail";
    // Retail "Discount / My Stamp Card" specials visible to THIS audience
    // (Guest page: guest+both; Local page: local+both), enabled, with text.
    const audienceOk = (a: string) => a === "both" || (isLocalMode ? a === "local" : a === "guest");
    const retailSpecials: Array<{ type: string; audience: string; enabled: boolean; line1: string; line2: string }> =
      isRetail ? ((((service as any).specials) || []) as any[]).filter((sp) => sp && sp.enabled && sp.line1 && audienceOk(sp.audience)) : [];
    return (
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold truncate">{service.name}</h4>
                              <SupportBadge orgName={service.supportOrgName} />
                            </div>
                            {isNpo && (((service as any).npoNumber || (service as any).pboNumber)) && (
                              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                                {(service as any).npoNumber && <span>NPO: {(service as any).npoNumber}</span>}
                                {(service as any).pboNumber && <span>PBO: {(service as any).pboNumber}</span>}
                              </div>
                            )}

                            {false && (
                            <StarRating
                              entityType={entityType}
                              entityId={Number(service.id)}
                              summary={ratings[ratingKey(entityType, service.id)]}
                              onRated={applyRatingSummary}
                              readOnly={service.accessLevel === "Booking"}
                            />
                            )}
                            {!isNpo && !isRetail && (service.offersBookings || service.accessLevel === "Booking") && (service.bookingItems?.length ?? 0) > 0 && (
                              <Button
                                size="sm"
                                className="bg-[#39FF14] hover:bg-[#39FF14]/90 text-black w-full sm:w-auto"
                                onClick={() => setBookingFor({ entityType: entityType, entityId: Number(service.id), entityName: service.name, items: (service.bookingItems || []) as BookItem[] })}
                              >
                                Click here to book at this establishment.
                              </Button>
                            )}
                            {!isNpo && !isRetail && <RestaurantPreOrder entity={service as any} entityType={entityType} />}
                            {discOffered(service) && (
                              <Button
                                size="sm"
                                className="w-full sm:w-auto bg-[#39FF14] hover:bg-[#39FF14]/90 text-black font-semibold"
                                onClick={() => setRedeemFor({ entityType: entityType, entityId: Number(service.id), entityName: service.name, discount: discOffered(service), discountCode: discCode(service) })}
                              >
                                Redeem discount
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => toggleCard(entityType + ":" + service.id)}>
                              {expandedCards.has(entityType + ":" + service.id) ? "Less info" : "More info"}
                            </Button>
                            {expandedCards.has(entityType + ":" + service.id) && (
                              <>
                            <SuggestionsBanner ownerType={entityType} ownerId={Number(service.id)} backName={service.name} />

                            {tierOf(service.accessLevel) >= 2 && (
                              <DirectionsDropdown
                                latitude={service.latitude}
                                longitude={service.longitude}
                              />
                            )}

                            {!isRetail && (
                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Discount and Discount Code
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm`}>
                                {discOffered(service) || discCode(service) ? (
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 px-3 py-2 bg-[#39FF14]/10 border border-[#39FF14] rounded-lg">
                                    {discOffered(service) && (
                                      <div className="flex items-center gap-1.5 text-black">
                                        <Tag className="h-4 w-4" />
                                        <span className="font-semibold text-sm whitespace-nowrap">{discOffered(service)}</span>
                                      </div>
                                    )}
                                    {discCode(service) && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-muted-foreground">Code:</span>
                                        <span className="px-2 py-0.5 bg-[#39FF14] text-black rounded font-mono text-xs font-bold">
                                          {discCode(service)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>
                            )}

                            {isRetail && (
                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Discount / My Stamp Card
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm`}>
                                {retailSpecials.length > 0 ? (
                                  <div className="space-y-2">
                                    {retailSpecials.map((sp, i) => (
                                      <div key={i} className="px-3 py-2 bg-[#39FF14]/10 border border-[#39FF14] rounded-lg">
                                        <div className="flex items-center gap-1.5 text-black">
                                          <Tag className="h-4 w-4 shrink-0" />
                                          <span className="text-xs font-semibold uppercase tracking-wide">
                                            {sp.type === "stampcard" ? "My Stamp Card" : "Discount"}
                                          </span>
                                        </div>
                                        {(sp as any).imageUrl && (
                                          <img
                                            src={(sp as any).imageUrl}
                                            alt={sp.line1 || "Product"}
                                            className="mt-2 w-full max-w-[220px] rounded-md border border-[#39FF14]/40 object-cover"
                                          />
                                        )}
                                        <p className="text-sm text-black mt-1">{sp.line1}</p>
                                        {sp.type === "stampcard" && sp.line2 && (
                                          <p className="text-sm text-black/80 mt-1">{sp.line2}</p>
                                        )}
                                        {sp.type === "stampcard" && (
                                          <Button
                                            size="sm"
                                            className="mt-2 bg-[#39FF14] hover:bg-[#39FF14]/90 text-black font-semibold"
                                            onClick={() => setShowMyStamps(true)}
                                          >
                                            Get Stamps
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>
                            )}

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
                                Trading Hours
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground whitespace-pre-line`}>
                                {service.tradingHours || fallbackSpan}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Public Holidays
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground whitespace-pre-line`}>
                                {service.publicHolidays || fallbackSpan}
                              </CollapsibleContent>
                            </Collapsible>

                            {!isNpo && !isRetail && (
                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Business/Service Categories
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {service.serviceCategories && service.serviceCategories.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {service.serviceCategories.map((category) => (
                                      <span key={category} className="px-2 py-0.5 text-black rounded text-xs">
                                        {category}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            )}

                            {!isNpo && !isRetail && service.offersBookings && (
                              <div className="mt-1">
                                <span className="inline-block px-2 py-0.5 text-black rounded text-xs font-medium">Takes bookings</span>
                              </div>
                            )}

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Payment Options
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {service.paymentCard || service.paymentCash || service.paymentMobile || service.paymentEft || service.paymentIkhokha || service.paymentGpay || service.paymentSamsungpay || service.paymentSassa || service.paymentApplepay ? (
                                  <div className="flex flex-wrap gap-2">
                                    {service.paymentCard && <span className="px-2 py-0.5 text-black rounded text-xs">Card</span>}
                                    {service.paymentCash && <span className="px-2 py-0.5 text-black rounded text-xs">Cash</span>}
                                    {service.paymentMobile && <span className="px-2 py-0.5 text-black rounded text-xs">Mobile</span>}
                                    {service.paymentEft && <span className="px-2 py-0.5 text-black rounded text-xs">EFT — Please contact for more info</span>}
                                    {service.paymentIkhokha && <span className="px-2 py-0.5 text-black rounded text-xs">iKhokha</span>}
                                    {service.paymentGpay && <span className="px-2 py-0.5 text-black rounded text-xs">G Pay</span>}
                                    {service.paymentSamsungpay && <span className="px-2 py-0.5 text-black rounded text-xs">Samsung Pay</span>}
                                    {service.paymentSassa && <span className="px-2 py-0.5 text-black rounded text-xs">SASSA</span>}
                                    {service.paymentApplepay && <span className="px-2 py-0.5 text-black rounded text-xs">Apple Pay</span>}
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
                                    {service.wheelchairAccess && <span className="px-2 py-0.5 text-black rounded text-xs">Wheelchair Access</span>}
                                    {service.parkingAvailability && <span className="px-2 py-0.5 text-black rounded text-xs">Parking Available</span>}
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
                                  <span className="px-2 py-0.5 text-black rounded text-xs">with pleasure</span>
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
                                  <>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Contact Number:</span>
                                      <a href={`tel:${service.contactNumber}`} className="text-black hover:underline flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {service.contactNumber}
                                      </a>
                                    </div>
                                    <WhatsAppButton number={service.contactNumber} className="mt-2" />
                                  </>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>


                            {tierOf(service.accessLevel) >= 2 && (
                              <AddressDropdown
                                address={service.address}
                                province={service.province}
                                postalCode={service.postalCode}
                                country={service.country}
                                worksFromClientAddress={(service as any).worksFromClientAddress}
                              />
                            )}
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#39FF14]/10 to-background px-6 pt-3 pb-6">
      <div className="max-w-7xl mx-auto space-y-6 pt-3 pb-8">
        {isLocalMode ? (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-1"><AppLogo src="/logo-dark.png" size={150} /></div>
              <h1 className="text-3xl font-bold text-foreground">Around You</h1>
              <p className="text-lg text-muted-foreground">Local Guest</p>
            </div>
            <EmergencyButton postalCode={localPostal} />
            <AppInstallButtons />
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-1"><AppLogo src="/logo-dark.png" size={150} /></div>
              <h1 className="text-3xl font-bold text-foreground">Welcome to</h1>
              <p className="text-lg text-muted-foreground">{accommodation!.name}</p>
            </div>
            <EmergencyButton postalCode={accommodation!.postalCode || ""} accommodationId={accommodation!.id} />
            <AppInstallButtons />
            <SuggestionsBanner ownerType="accommodation" ownerId={accommodation!.id} backName={accommodation!.name} />
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
                  <DirectionsDropdown
                    latitude={accommodation!.latitude}
                    longitude={accommodation!.longitude}
                  />
                  <AddressDropdown
                    address={accommodation!.address}
                    area={accommodation!.area}
                    province={accommodation!.province}
                    postalCode={accommodation!.postalCode}
                    country={accommodation!.country}
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
                              className="bg-[#39FF14] hover:bg-[#39FF14]/90 text-black"
                              onClick={() => (window.location.href = `tel:${selectedContact || accommodation!.primaryContact}`)}
                            >
                              <Phone className="h-4 w-4 mr-2" />
                              Call
                            </Button>
                          </div>
                          <WhatsAppButton number={selectedContact || accommodation!.primaryContact} />
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
                        <WifiConnect name={accommodation!.wifiName} password={accommodation!.wifiPassword} />
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
                        className="text-black hover:underline flex items-center gap-1"
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
                        className="text-black hover:underline flex items-center gap-1"
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
                            <span key={facility} className="px-2 py-0.5 text-black rounded text-xs">
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
                    <CollapsibleContent className={`${contentClass} space-y-2 max-w-xl`}>
                      {accommodation!.primaryContact || accommodation!.policeContact || accommodation!.doctorContact || (accommodation!.doctors && accommodation!.doctors.length > 0) || accommodation!.ambulanceContact || accommodation!.privateAmbulanceContact || accommodation!.hospitalContact || accommodation!.fireDepartmentContact || accommodation!.snakeCatchersContact || accommodation!.nsriContact || accommodation!.vetContact || (accommodation!.vets && accommodation!.vets.length > 0) || accommodation!.communityWatchContact || accommodation!.localSecurityContact ? (
                        <>
                          {accommodation!.ambulanceContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Public Ambulance:</span>
                              <a href={`tel:${accommodation!.ambulanceContact}`} className="font-medium text-black hover:underline">
                                {accommodation!.ambulanceContact}
                              </a>
                            </div>
                          )}
                          {accommodation!.privateAmbulanceContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Private Ambulance:</span>
                              <a href={`tel:${accommodation!.privateAmbulanceContact}`} className="font-medium text-black hover:underline">
                                {accommodation!.privateAmbulanceContact}
                              </a>
                            </div>
                          )}
                          {accommodation!.policeContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Police Contact:</span>
                              <a href={`tel:${accommodation!.policeContact}`} className="font-medium text-black hover:underline">
                                {accommodation!.policeContact}
                              </a>
                            </div>
                          )}
                          {accommodation!.fireDepartmentContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Fire Department:</span>
                              <a href={`tel:${accommodation!.fireDepartmentContact}`} className="font-medium text-black hover:underline">
                                {accommodation!.fireDepartmentContact}
                              </a>
                            </div>
                          )}
                          {accommodation!.primaryContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Primary Contact:</span>
                              <a href={`tel:${accommodation!.primaryContact}`} className="font-medium text-black hover:underline">
                                {accommodation!.primaryContact}
                              </a>
                            </div>
                          )}
                          {accommodation!.doctors && accommodation!.doctors.length > 0
                            ? accommodation!.doctors.map((d, i) => (
                                <div key={`doc-${i}`} className="space-y-1 text-sm">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">{d.name ? `Doctor — ${d.name}:` : "Doctor:"}</span>
                                    {d.number && (
                                      <a href={`tel:${d.number}`} className="font-medium text-black hover:underline">
                                        {d.number}
                                      </a>
                                    )}
                                  </div>
                                  {d.address && (
                                    <div className="flex items-center justify-between pl-2">
                                      <span className="text-xs text-muted-foreground">{d.address}</span>
                                      <AddressDirectionsButton address={d.address} />
                                    </div>
                                  )}
                                </div>
                              ))
                            : accommodation!.doctorContact && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Doctor Contact:</span>
                                  <a href={`tel:${accommodation!.doctorContact}`} className="font-medium text-black hover:underline">
                                    {accommodation!.doctorContact}
                                  </a>
                                </div>
                              )}
                          {accommodation!.hospitalContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Hospital Contact:</span>
                              <a href={`tel:${accommodation!.hospitalContact}`} className="font-medium text-black hover:underline">
                                {accommodation!.hospitalContact}
                              </a>
                            </div>
                          )}
                          {accommodation!.hospitalAddress && (
                            <div className="flex items-center justify-between pl-2">
                              <span className="text-xs text-muted-foreground">{accommodation!.hospitalAddress}</span>
                              <AddressDirectionsButton address={accommodation!.hospitalAddress} />
                            </div>
                          )}
                          {accommodation!.snakeCatchersContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Snake Catchers:</span>
                              <a href={`tel:${accommodation!.snakeCatchersContact}`} className="font-medium text-black hover:underline">{accommodation!.snakeCatchersContact}</a>
                            </div>
                          )}
                          {accommodation!.nsriContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">NSRI:</span>
                              <a href={`tel:${accommodation!.nsriContact}`} className="font-medium text-black hover:underline">{accommodation!.nsriContact}</a>
                            </div>
                          )}
                          {accommodation!.vets && accommodation!.vets.length > 0
                            ? accommodation!.vets.map((v, i) => (
                                <div key={`vet-${i}`} className="space-y-1 text-sm">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">{v.name ? `Vet — ${v.name}:` : "Vet:"}</span>
                                    {v.number && (
                                      <a href={`tel:${v.number}`} className="font-medium text-black hover:underline">
                                        {v.number}
                                      </a>
                                    )}
                                  </div>
                                  {v.address && (
                                    <div className="flex items-center justify-between pl-2">
                                      <span className="text-xs text-muted-foreground">{v.address}</span>
                                      <AddressDirectionsButton address={v.address} />
                                    </div>
                                  )}
                                </div>
                              ))
                            : accommodation!.vetContact && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Vet:</span>
                                  <a href={`tel:${accommodation!.vetContact}`} className="font-medium text-black hover:underline">{accommodation!.vetContact}</a>
                                </div>
                              )}
                          {accommodation!.communityWatchContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Community Watch:</span>
                              <a href={`tel:${accommodation!.communityWatchContact}`} className="font-medium text-black hover:underline">{accommodation!.communityWatchContact}</a>
                            </div>
                          )}
                          {accommodation!.localSecurityContact && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Local Security:</span>
                              <a href={`tel:${accommodation!.localSecurityContact}`} className="font-medium text-black hover:underline">{accommodation!.localSecurityContact}</a>
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
          <Button className="w-full bg-[#39FF14] hover:bg-[#39FF14]/90 text-black font-semibold" onClick={() => setShowMyBookings(true)}>Bookings / Pre-Orders I have made</Button>
          <Button className="w-full bg-[#39FF14] hover:bg-[#39FF14]/90 text-black font-semibold" onClick={() => setShowMyStamps(true)}>My Stamp Cards</Button>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
            <TabsList className="flex flex-col w-full gap-1 p-1 bg-muted rounded-md" style={{ height: "auto" }}>
              <TabsTrigger value="restaurants" className="w-full min-h-[44px] justify-center whitespace-nowrap touch-manipulation text-sm px-3">Restaurants/Takeaways ({filteredRestaurants.length})</TabsTrigger>
              <TabsTrigger value="services" className="w-full min-h-[44px] justify-center whitespace-nowrap touch-manipulation text-sm px-3">Business/Services ({bizServices.length})</TabsTrigger>
              <TabsTrigger value="retail" className="w-full min-h-[44px] justify-center whitespace-nowrap touch-manipulation text-sm px-3">Retail ({retailServices.length})</TabsTrigger>
              <TabsTrigger value="attractions" className="w-full min-h-[44px] justify-center whitespace-nowrap touch-manipulation text-sm px-3">Attractions/Activities ({filteredAttractions.length})</TabsTrigger>
              <TabsTrigger value="realestate" className="w-full min-h-[44px] justify-center whitespace-nowrap touch-manipulation text-sm px-3">Real Estate</TabsTrigger>
              <TabsTrigger value="nonprofit" className="w-full min-h-[44px] justify-center whitespace-nowrap touch-manipulation text-sm px-3">NPO / PBO ({npoServices.length})</TabsTrigger>
            </TabsList>
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

          <div className="space-y-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-snug whitespace-normal break-words">
              Search restaurants, business/services and attractions by name, cuisine, category or description.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="sortBy" className="text-sm text-muted-foreground">Sort by</label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "alphabetical" | "discounts" | "stampcards")}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="alphabetical">Alphabetical</option>
              <option value="discounts">Discounts</option>
              <option value="stampcards">My Stamp Cards</option>
            </select>
            {(sortBy !== "alphabetical" || searchQuery.trim()) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => { setMinRating(0); setSortBy("alphabetical"); setSearchQuery(""); }}
              >
                Clear
              </Button>
            )}
          </div>

            <TabsContent value="realestate" className="space-y-3 mt-6">
              <EstateAgenciesBrowse />
            </TabsContent>

            <TabsContent value="nonprofit" className="space-y-3 mt-6" {...swipeHandlers}>
              {npoServices.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    {searchQuery.trim() ? "No NPO / PBO listings match your search" : isLocalMode ? "No NPO / PBO listings found within 50km" : `No NPO / PBO listings found within ${radiusKm[0]}km`}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {npoServices.map((s) => renderServiceCard(s, "nonprofit"))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="restaurants" className="space-y-3 mt-6" {...swipeHandlers}>
              {filteredRestaurants.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    {searchQuery.trim() ? "No restaurants match your search" : isLocalMode ? "No restaurants found within 50km" : `No restaurants found within ${radiusKm[0]}km`}
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
                              <SupportBadge orgName={restaurant.supportOrgName} />
                              {restaurant.littleExplorerApproved && <span title="Child Friendly">👶</span>}
                            </div>

                            {false && (
                            <StarRating
                              entityType="restaurant"
                              entityId={Number(restaurant.id)}
                              summary={ratings[ratingKey("restaurant", restaurant.id)]}
                              onRated={applyRatingSummary}
                              readOnly={restaurant.accessLevel === "Booking" && (restaurant.bookingItems?.length ?? 0) > 0}
                            />
                            )}
                            {(restaurant.offersBookings || restaurant.accessLevel === "Booking") && (restaurant.bookingItems?.length ?? 0) > 0 && (
                              <Button
                                size="sm"
                                className="bg-[#39FF14] hover:bg-[#39FF14]/90 text-black w-full sm:w-auto"
                                onClick={() => setBookingFor({ entityType: "restaurant", entityId: Number(restaurant.id), entityName: restaurant.name, items: (restaurant.bookingItems || []) as BookItem[] })}
                              >
                                Click here to book at this establishment.
                              </Button>
                            )}
                            <RestaurantPreOrder entity={restaurant as any} entityType="restaurant" />
                            {discOffered(restaurant) && (
                              <Button
                                size="sm"
                                className="w-full sm:w-auto bg-[#39FF14] hover:bg-[#39FF14]/90 text-black font-semibold"
                                onClick={() => setRedeemFor({ entityType: "restaurant", entityId: Number(restaurant.id), entityName: restaurant.name, discount: discOffered(restaurant), discountCode: discCode(restaurant) })}
                              >
                                Redeem discount
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => toggleCard("restaurant:" + restaurant.id)}>
                              {expandedCards.has("restaurant:" + restaurant.id) ? "Less info" : "More info"}
                            </Button>
                            {expandedCards.has("restaurant:" + restaurant.id) && (
                              <>
                            <SuggestionsBanner ownerType="restaurant" ownerId={Number(restaurant.id)} backName={restaurant.name} />

                            {tierOf(restaurant.accessLevel) >= 2 && (
                              <DirectionsDropdown
                                latitude={restaurant.latitude}
                                longitude={restaurant.longitude}
                              />
                            )}

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Discount and Discount Code
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm`}>
                                {discOffered(restaurant) || discCode(restaurant) ? (
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 px-3 py-2 bg-[#39FF14]/10 border border-[#39FF14] rounded-lg">
                                    {discOffered(restaurant) && (
                                      <div className="flex items-center gap-1.5 text-black">
                                        <Tag className="h-4 w-4" />
                                        <span className="font-semibold text-sm whitespace-nowrap">{discOffered(restaurant)}</span>
                                      </div>
                                    )}
                                    {discCode(restaurant) && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-muted-foreground">Code:</span>
                                        <span className="px-2 py-0.5 bg-[#39FF14] text-black rounded font-mono text-xs font-bold">
                                          {discCode(restaurant)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

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
                                Trading Hours
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground whitespace-pre-line`}>
                                {restaurant.tradingHours || fallbackSpan}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Public Holidays
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground whitespace-pre-line`}>
                                {restaurant.publicHolidays || fallbackSpan}
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
                                      <span key={cuisine} className="px-2 py-0.5 text-black rounded text-xs">
                                        {cuisine}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            {restaurant.atmosphere && restaurant.atmosphere.length > 0 && (
                              <Collapsible>
                                <CollapsibleTrigger className={triggerClass}>
                                  <ChevronDown className="h-4 w-4" />
                                  Atmosphere / Vibe
                                </CollapsibleTrigger>
                                <CollapsibleContent className={contentClass}>
                                  <div className="flex flex-wrap gap-2">
                                    {restaurant.atmosphere.map((a: string) => (
                                      <span key={a} className="px-2 py-0.5 text-black rounded text-xs">{a}</span>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}

                            {restaurant.features && restaurant.features.length > 0 && (
                              <Collapsible>
                                <CollapsibleTrigger className={triggerClass}>
                                  <ChevronDown className="h-4 w-4" />
                                  Features
                                </CollapsibleTrigger>
                                <CollapsibleContent className={contentClass}>
                                  <div className="flex flex-wrap gap-2">
                                    {restaurant.features.map((f: string) => (
                                      <span key={f} className="px-2 py-0.5 text-black rounded text-xs">{f}</span>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}

                            {restaurant.dietaryOptions && restaurant.dietaryOptions.length > 0 && (
                              <Collapsible>
                                <CollapsibleTrigger className={triggerClass}>
                                  <ChevronDown className="h-4 w-4" />
                                  Dietary Options
                                </CollapsibleTrigger>
                                <CollapsibleContent className={contentClass}>
                                  <div className="flex flex-wrap gap-2">
                                    {restaurant.dietaryOptions.map((d: string) => (
                                      <span key={d} className="px-2 py-0.5 text-black rounded text-xs">{d}</span>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}

                            {restaurant.chefRecommendation && (
                              <Collapsible>
                                <CollapsibleTrigger className={triggerClass}>
                                  <ChevronDown className="h-4 w-4" />
                                  Chef&apos;s Recommendation
                                </CollapsibleTrigger>
                                <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground whitespace-pre-line`}>
                                  {restaurant.chefRecommendation}
                                </CollapsibleContent>
                              </Collapsible>
                            )}

                            {restaurant.offersBookings && (
                              <div className="mt-1">
                                <span className="inline-block px-2 py-0.5 text-black rounded text-xs font-medium">Takes bookings</span>
                              </div>
                            )}

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Restaurant/Takeaway Type
                              </CollapsibleTrigger>
                              <CollapsibleContent className={contentClass}>
                                {restaurant.restaurantType && restaurant.restaurantType.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {restaurant.restaurantType.map((rt) => (
                                      <span key={rt} className="px-2 py-0.5 text-black rounded text-xs">
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
                                    className="text-black hover:underline flex items-center gap-1 text-sm"
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
                                        className="text-black hover:underline flex items-center gap-1 text-sm"
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
                                {restaurant.paymentCard || restaurant.paymentCash || restaurant.paymentMobile || restaurant.paymentEft || restaurant.paymentIkhokha || restaurant.paymentGpay || restaurant.paymentSamsungpay || restaurant.paymentSassa || restaurant.paymentApplepay ? (
                                  <div className="flex flex-wrap gap-2">
                                    {restaurant.paymentCard && <span className="px-2 py-0.5 text-black rounded text-xs">Card</span>}
                                    {restaurant.paymentCash && <span className="px-2 py-0.5 text-black rounded text-xs">Cash</span>}
                                    {restaurant.paymentMobile && <span className="px-2 py-0.5 text-black rounded text-xs">Mobile</span>}
                                    {restaurant.paymentEft && <span className="px-2 py-0.5 text-black rounded text-xs">EFT — Please contact for more info</span>}
                                    {restaurant.paymentIkhokha && <span className="px-2 py-0.5 text-black rounded text-xs">iKhokha</span>}
                                    {restaurant.paymentGpay && <span className="px-2 py-0.5 text-black rounded text-xs">G Pay</span>}
                                    {restaurant.paymentSamsungpay && <span className="px-2 py-0.5 text-black rounded text-xs">Samsung Pay</span>}
                                    {restaurant.paymentSassa && <span className="px-2 py-0.5 text-black rounded text-xs">SASSA</span>}
                                    {restaurant.paymentApplepay && <span className="px-2 py-0.5 text-black rounded text-xs">Apple Pay</span>}
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
                                    {restaurant.serviceDineIn && <span className="px-2 py-0.5 text-black rounded text-xs">Dine-in</span>}
                                    {restaurant.serviceTakeaway && <span className="px-2 py-0.5 text-black rounded text-xs">Takeaway</span>}
                                    {restaurant.serviceDelivery && <span className="px-2 py-0.5 text-black rounded text-xs">Delivery</span>}
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
                                    {restaurant.wheelchairAccess && <span className="px-2 py-0.5 text-black rounded text-xs">Wheelchair Access</span>}
                                    {restaurant.parkingAvailability && <span className="px-2 py-0.5 text-black rounded text-xs">Parking Available</span>}
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
                                  <span className="px-2 py-0.5 text-black rounded text-xs">with pleasure</span>
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
                                  <WifiConnect name={restaurant.wifiNetwork} password={restaurant.wifiPassword} />
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
                                  <>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Contact Number:</span>
                                      <a href={`tel:${restaurant.contactNumber}`} className="text-black hover:underline flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {restaurant.contactNumber}
                                      </a>
                                    </div>
                                    <WhatsAppButton number={restaurant.contactNumber} className="mt-2" />
                                  </>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>


                            {tierOf(restaurant.accessLevel) >= 2 && (
                              <AddressDropdown
                                address={restaurant.address}
                                province={restaurant.province}
                                postalCode={restaurant.postalCode}
                                country={restaurant.country}
                                worksFromClientAddress={(restaurant as any).worksFromClientAddress}
                              />
                            )}


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
                                        <a href={restaurant.socialsWebsite} target="_blank" rel="noopener noreferrer" className="text-black hover:underline flex items-center gap-1 break-all">
                                          Website <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                        </a>
                                      </div>
                                    )}
                                    {restaurant.socialsInstagram && (
                                      <div className="flex items-center gap-2">
                                        <Instagram className="h-3 w-3 flex-shrink-0" />
                                        <a href={restaurant.socialsInstagram} target="_blank" rel="noopener noreferrer" className="text-black hover:underline flex items-center gap-1 break-all">
                                          Instagram <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                        </a>
                                      </div>
                                    )}
                                    {restaurant.socialsTwitter && (
                                      <div className="flex items-center gap-2">
                                        <Twitter className="h-3 w-3 flex-shrink-0" />
                                        <a href={restaurant.socialsTwitter} target="_blank" rel="noopener noreferrer" className="text-black hover:underline flex items-center gap-1 break-all">
                                          X (Twitter) <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                        </a>
                                      </div>
                                    )}
                                    {restaurant.socialsYoutube && (
                                      <div className="flex items-center gap-2">
                                        <Youtube className="h-3 w-3 flex-shrink-0" />
                                        <a href={restaurant.socialsYoutube} target="_blank" rel="noopener noreferrer" className="text-black hover:underline flex items-center gap-1 break-all">
                                          YouTube <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                        </a>
                                      </div>
                                    )}
                                    {restaurant.socialsTiktok && (
                                      <div className="flex items-center gap-2">
                                        <Music className="h-3 w-3 flex-shrink-0" />
                                        <a href={restaurant.socialsTiktok} target="_blank" rel="noopener noreferrer" className="text-black hover:underline flex items-center gap-1 break-all">
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
              {bizServices.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    {searchQuery.trim() ? "No business/services match your search" : isLocalMode ? "No business/services found within 50km" : `No business/services found within ${radiusKm[0]}km`}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {bizServices.map((s) => renderServiceCard(s, "service"))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="retail" className="space-y-3 mt-6" {...swipeHandlers}>
              {retailServices.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    {searchQuery.trim() ? "No retail match your search" : isLocalMode ? "No retail found within 50km" : `No retail found within ${radiusKm[0]}km`}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {retailServices.map((s) => renderServiceCard(s, "retail"))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="attractions" className="space-y-3 mt-6" {...swipeHandlers}>
              {filteredAttractions.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    {searchQuery.trim() ? "No attractions match your search" : isLocalMode ? "No attractions found within 50km" : `No attractions found within ${radiusKm[0]}km`}
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold truncate">{attraction.name}</h4>
                              <SupportBadge orgName={attraction.supportOrgName} />
                            </div>

                            {false && (
                            <StarRating
                              entityType="attraction"
                              entityId={Number(attraction.id)}
                              summary={ratings[ratingKey("attraction", attraction.id)]}
                              onRated={applyRatingSummary}
                              readOnly={attraction.accessLevel === "Booking"}
                            />
                            )}
                            {(attraction.offersBookings || attraction.accessLevel === "Booking") && (attraction.bookingItems?.length ?? 0) > 0 && (
                              <Button
                                size="sm"
                                className="bg-[#39FF14] hover:bg-[#39FF14]/90 text-black w-full sm:w-auto"
                                onClick={() => setBookingFor({ entityType: "attraction", entityId: Number(attraction.id), entityName: attraction.name, items: (attraction.bookingItems || []) as BookItem[] })}
                              >
                                Click here to book at this establishment.
                              </Button>
                            )}
                            <RestaurantPreOrder entity={attraction as any} entityType="attraction" />
                            {discOffered(attraction) && (
                              <Button
                                size="sm"
                                className="w-full sm:w-auto bg-[#39FF14] hover:bg-[#39FF14]/90 text-black font-semibold"
                                onClick={() => setRedeemFor({ entityType: "attraction", entityId: Number(attraction.id), entityName: attraction.name, discount: discOffered(attraction), discountCode: discCode(attraction) })}
                              >
                                Redeem discount
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => toggleCard("attraction:" + attraction.id)}>
                              {expandedCards.has("attraction:" + attraction.id) ? "Less info" : "More info"}
                            </Button>
                            {expandedCards.has("attraction:" + attraction.id) && (
                              <>
                            <SuggestionsBanner ownerType="attraction" ownerId={Number(attraction.id)} backName={attraction.name} />

                            {tierOf(attraction.accessLevel) >= 2 && (
                              <DirectionsDropdown
                                latitude={attraction.latitude}
                                longitude={attraction.longitude}
                              />
                            )}

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Discount and Discount Code
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm`}>
                                {discOffered(attraction) || discCode(attraction) ? (
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 px-3 py-2 bg-[#39FF14]/10 border border-[#39FF14] rounded-lg">
                                    {discOffered(attraction) && (
                                      <div className="flex items-center gap-1.5 text-black">
                                        <Tag className="h-4 w-4" />
                                        <span className="font-semibold text-sm whitespace-nowrap">{discOffered(attraction)}</span>
                                      </div>
                                    )}
                                    {discCode(attraction) && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-muted-foreground">Code:</span>
                                        <span className="px-2 py-0.5 bg-[#39FF14] text-black rounded font-mono text-xs font-bold">
                                          {discCode(attraction)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

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
                                Trading Hours
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground whitespace-pre-line`}>
                                {attraction.tradingHours || fallbackSpan}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Public Holidays
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground whitespace-pre-line`}>
                                {attraction.publicHolidays || fallbackSpan}
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
                                      <span key={type} className="px-2 py-0.5 text-black rounded text-xs">
                                        {type}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            {attraction.offersBookings && (
                              <div className="mt-1">
                                <span className="inline-block px-2 py-0.5 text-black rounded text-xs font-medium">Takes bookings</span>
                              </div>
                            )}

                            <Collapsible>
                              <CollapsibleTrigger className={triggerClass}>
                                <ChevronDown className="h-4 w-4" />
                                Payment Options
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm text-muted-foreground`}>
                                {attraction.paymentCard || attraction.paymentCash || attraction.paymentMobile || attraction.paymentEft || attraction.paymentIkhokha || attraction.paymentGpay || attraction.paymentSamsungpay || attraction.paymentSassa || attraction.paymentApplepay ? (
                                  <div className="flex flex-wrap gap-2">
                                    {attraction.paymentCard && <span className="px-2 py-0.5 text-black rounded text-xs">Card</span>}
                                    {attraction.paymentCash && <span className="px-2 py-0.5 text-black rounded text-xs">Cash</span>}
                                    {attraction.paymentMobile && <span className="px-2 py-0.5 text-black rounded text-xs">Mobile</span>}
                                    {attraction.paymentEft && <span className="px-2 py-0.5 text-black rounded text-xs">EFT — Please contact for more info</span>}
                                    {attraction.paymentIkhokha && <span className="px-2 py-0.5 text-black rounded text-xs">iKhokha</span>}
                                    {attraction.paymentGpay && <span className="px-2 py-0.5 text-black rounded text-xs">G Pay</span>}
                                    {attraction.paymentSamsungpay && <span className="px-2 py-0.5 text-black rounded text-xs">Samsung Pay</span>}
                                    {attraction.paymentSassa && <span className="px-2 py-0.5 text-black rounded text-xs">SASSA</span>}
                                    {attraction.paymentApplepay && <span className="px-2 py-0.5 text-black rounded text-xs">Apple Pay</span>}
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
                                    {attraction.wheelchairAccess && <span className="px-2 py-0.5 text-black rounded text-xs">Wheelchair Access</span>}
                                    {attraction.parkingAvailability && <span className="px-2 py-0.5 text-black rounded text-xs">Parking Available</span>}
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
                                  <span className="px-2 py-0.5 text-black rounded text-xs">with pleasure</span>
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
                                  <>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Contact Number:</span>
                                      <a href={`tel:${attraction.contactNumber}`} className="text-black hover:underline flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {attraction.contactNumber}
                                      </a>
                                    </div>
                                    <WhatsAppButton number={attraction.contactNumber} className="mt-2" />
                                  </>
                                ) : (
                                  fallbackSpan
                                )}
                              </CollapsibleContent>
                            </Collapsible>


                            {tierOf(attraction.accessLevel) >= 2 && (
                              <AddressDropdown
                                address={attraction.address}
                                province={attraction.province}
                                postalCode={attraction.postalCode}
                                country={attraction.country}
                                worksFromClientAddress={(attraction as any).worksFromClientAddress}
                              />
                            )}
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
            discountCode={redeemFor.discountCode}
          />
        )}
        {showMyBookings && <MyBookingsModal onClose={() => setShowMyBookings(false)} />}
        {showMyStamps && <MyStampCardsModal onClose={() => setShowMyStamps(false)} />}
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
        <p className="text-xs text-muted-foreground">You can change or cancel this booking yourself from "Bookings / Pre-Orders I have made" using this email. The partner cannot change or cancel it.</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-[#39FF14] hover:bg-[#39FF14]/90 text-black">{saving ? "Sending…" : "Confirm Booking"}</Button>
        </div>
      </div>
    </div>
  );
}

function RedeemModal({ onClose, entityType, entityId, entityName, discount, discountCode }: {
  onClose: () => void; entityType: RatableType; entityId: number; entityName: string; discount?: string; discountCode?: string;
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

        {discount && <p className="text-base font-semibold">{discount}</p>}

        {discountCode ? (
          <div className="rounded-lg border-2 border-dashed border-[#39FF14] bg-[#39FF14]/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Discount Code</p>
            <p className="text-2xl font-bold font-mono tracking-widest text-black">{discountCode}</p>
          </div>
        ) : (
          discount ? null : <p className="text-sm text-muted-foreground">Show your booking to the venue to claim this offer.</p>
        )}

        {discountCode && (
          <p className="text-xs text-muted-foreground">Show this code to the venue to claim your discount.</p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Preparing your code…</p>
        ) : token ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="Redemption QR code" className="mx-auto rounded-lg" width={200} height={200} />
            <p className="text-xs text-muted-foreground">
              The venue can scan this to confirm your visit. Once redeemed, you'll be able to rate your experience.
            </p>
            <p className="text-[10px] font-mono break-all text-muted-foreground/70">Ref: {token}</p>
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
        <h3 className="text-lg font-semibold">Bookings / Pre-Orders I have made</h3>
        <p className="text-xs text-muted-foreground">Enter the email you booked with to see, cancel, or rate your bookings.</p>
        <div className="flex gap-2">
          <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={find} disabled={loading} className="bg-[#39FF14] hover:bg-[#39FF14]/90 text-black whitespace-nowrap">{loading ? "…" : "Find"}</Button>
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
                    <span className={`text-xs px-2 py-0.5 rounded ${b.status === "cancelled" ? "text-black" : "bg-[#39FF14] text-black"}`}>{b.status}</span>
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
                        <Button size="sm" className="bg-[#39FF14] hover:bg-[#39FF14]/90 text-black" onClick={() => saveEdit(b.id)} disabled={busyId === b.id}>
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

// MyStampCardsModal lets a customer see their loyalty stamp cards by entering the
// mobile number the partner stamps against. Read-only — only partners add stamps.
function MyStampCardsModal({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState(() => {
    try {
      const g = JSON.parse(localStorage.getItem("localGuestInfo") || "{}");
      if (g.cell) return g.cell;
      const a = JSON.parse(localStorage.getItem("aroundYouLogin") || "{}");
      return a?.local?.cell || "";
    } catch { return ""; }
  });
  const [cards, setCards] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortMode, setSortMode] = useState<"alphabetical" | "closest">("alphabetical");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("aystampFavorites") || "[]"); } catch { return []; }
  });
  const { toast } = useToast();
  const cardKey = (c: any) => `${c.partnerType}:${c.partnerId}:${c.specialId || ""}`;
  const isFav = (c: any) => favorites.includes(cardKey(c));
  const toggleFav = (c: any) => {
    const k = cardKey(c);
    setFavorites((prev) => {
      let next: string[];
      if (prev.includes(k)) next = prev.filter((x) => x !== k);
      else {
        if (prev.length >= 3) { toast({ title: "You can favourite up to 3 cards", description: "Unstar one first." }); return prev; }
        next = [...prev, k];
      }
      try { localStorage.setItem("aystampFavorites", JSON.stringify(next)); } catch { /* best-effort */ }
      return next;
    });
  };
  const distKm = (c: any): number => {
    if (!userCoords || !c.latitude || !c.longitude) return Infinity;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(c.latitude - userCoords.lat);
    const dLng = toRad(c.longitude - userCoords.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(userCoords.lat)) * Math.cos(toRad(c.latitude)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
  };
  const useClosest = async () => {
    setSortMode("closest");
    if (userCoords) return;
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setUserCoords({ lat: pos.latitude, lng: pos.longitude });
    } catch {
      toast({ title: "Couldn't get your location", description: "Allow location access to sort by closest, or use Alphabetical.", variant: "destructive" });
      setSortMode("alphabetical");
    } finally { setLocating(false); }
  };
  const digits = phone.replace(/[^0-9]/g, "");
  const load = async (silent: boolean) => {
    if (!phone.trim()) { if (!silent) toast({ title: "Enter your mobile number", variant: "destructive" }); return; }
    if (!silent) setLoading(true);
    try {
      const backend = getAuthenticatedBackend();
      const res: any = await backend.loyalty.myCards({ phone: phone.trim() });
      setCards(res.cards || []);
    } catch (error: any) {
      if (!silent) toast({ title: "Couldn't load cards", description: error?.message || "Please try again.", variant: "destructive" });
    } finally { if (!silent) setLoading(false); }
  };
  const find = () => load(false);

  // Live refresh: once cards are loaded, re-fetch every 5s (and whenever the tab
  // regains focus) so a stamp the partner just added appears without the guest
  // having to close and reopen this window.
  const loaded = cards !== null;
  useEffect(() => {
    if (!loaded || digits.length < 9) return;
    const id = setInterval(() => { load(true); }, 5000);
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(id); window.removeEventListener("focus", onFocus); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, digits]);

  const byName = (a: any, b: any) => (a.partnerName || "").localeCompare(b.partnerName || "") || ((a.label || "").localeCompare(b.label || ""));
  const sortRest = (list: any[]) => sortMode === "closest"
    ? [...list].sort((a, b) => distKm(a) - distKm(b) || byName(a, b))
    : [...list].sort(byName);
  const sortedCards = cards ? [...sortRest(cards.filter(isFav)), ...sortRest(cards.filter((c) => !isFav(c)))] : [];
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">My Stamp Cards</h3>
        <p className="text-xs text-muted-foreground">
          Enter the mobile number you give the shop to see your stamp cards and get your QR code to show at the till. Partners add a stamp each time you buy — collect enough and the reward is yours.
        </p>
        <div className="flex gap-2">
          <Input inputMode="tel" placeholder="Your mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button onClick={find} disabled={loading} className="bg-[#39FF14] hover:bg-[#39FF14]/90 text-black whitespace-nowrap">{loading ? "…" : "Find"}</Button>
        </div>
        {cards !== null && phone.replace(/[^0-9]/g, "").length >= 9 && (
          <div className="rounded-md border p-3 flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground text-center">Show this at the till — the shop scans it to add your stamp.</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent("aystamp:" + phone.replace(/[^0-9]/g, ""))}&bgcolor=000000&color=39FF14&margin=10`}
              alt="Your stamp-card QR code"
              width={200}
              height={200}
              className="rounded-lg"
            />
            <p className="text-[11px] text-muted-foreground text-center">No code reader? Just give the shop your mobile number.</p>
          </div>
        )}
        {cards !== null && (
          <div className="space-y-2">
            {cards.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Sort</span>
                <select
                  value={sortMode}
                  onChange={(e) => (e.target.value === "closest" ? useClosest() : setSortMode("alphabetical"))}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="alphabetical">Alphabetical</option>
                  <option value="closest">Closest to me</option>
                </select>
                {locating && <span className="text-[11px] text-muted-foreground">Locating…</span>}
                <span className="ml-auto text-[11px] text-muted-foreground">★ favourite up to 3</span>
              </div>
            )}
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cards available to view yet.</p>
            ) : (
              sortedCards.map((c, idx) => (
                <div key={cardKey(c) + ":" + idx} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm truncate" style={{ color: (c as any).brandColor || undefined }}>{c.partnerName || "Partner"}</span>
                      {(c as any).label && <span className="text-[11px] text-muted-foreground line-clamp-2">{(c as any).label}</span>}
                      {c.area && <span className="text-[11px] text-muted-foreground">{c.area}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.rewardReady && <span className="text-xs px-2 py-0.5 rounded bg-[#39FF14] text-black font-semibold">Reward ready!</span>}
                      <button type="button" aria-label={isFav(c) ? "Unfavourite" : "Favourite"} onClick={() => toggleFav(c)}
                        className={`text-lg leading-none ${isFav(c) ? "text-[#f5b301]" : "text-muted-foreground"}`}>
                        {isFav(c) ? "★" : "☆"}
                      </button>
                    </div>
                  </div>
                  {(c as any).imageUrl && (
                    <img src={(c as any).imageUrl} alt={(c as any).label || "Product"} className="w-full max-w-[200px] rounded-md border object-cover" />
                  )}
                  {c.rewardText && (
                    <div className="text-xs font-medium rounded px-2 py-1 border border-[#39FF14]/40 bg-[#39FF14]/10 text-[#39FF14]">
                      🎁 Reward: {c.rewardText}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: c.threshold }).map((_, i) => (
                      <span key={i} className={`h-7 w-7 rounded-full border flex items-center justify-center text-xs font-bold ${i < c.stamps ? "bg-[#39FF14] border-[#39FF14] text-black" : "border-border text-muted-foreground"}`}>
                        {i < c.stamps ? "✓" : i + 1}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.stamps} of {c.threshold} stamps</div>
                  {c.rewardReady && <p className="text-xs">Show this to {c.partnerName || "the partner"} to claim your reward.</p>}
                </div>
              ))
            )}
          </div>
        )}
        <div className="flex justify-end pt-1"><Button variant="outline" onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}
