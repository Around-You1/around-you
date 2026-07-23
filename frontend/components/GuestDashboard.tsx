import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Phone, ExternalLink, Tag, ChevronDown, Search, Eye, EyeOff, MapPin, Mail, Globe, Instagram, Twitter, Youtube, Music } from "lucide-react";
import AddressDropdown from "../components/AddressDropdown";
import DirectionsDropdown from "../components/DirectionsDropdown";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { useSwipe } from "../lib/useSwipe";
import OptimizedImage from "../components/OptimizedImage";
import ImageCarousel from "../components/ImageCarousel";
import SwipeIndicator from "../components/SwipeIndicator";
import type { Accommodation } from "~backend/accommodation/types";
import type { Restaurant } from "~backend/restaurant/types";
import type { ServiceData } from "~backend/service/types";
import type { AttractionData } from "~backend/attraction/types";
import AppLogo from "../components/AppLogo";

const FALLBACK = "The company has opted not to make this information visible.";

export default function GuestDashboard() {
  const [accommodation, setAccommodation] = useState<Accommodation | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [attractions, setAttractions] = useState<AttractionData[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [filteredServices, setFilteredServices] = useState<ServiceData[]>([]);
  const [filteredAttractions, setFilteredAttractions] = useState<AttractionData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState([150]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("restaurants");

  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());
  const [selectedContact, setSelectedContact] = useState<string>("");
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

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      setFilteredRestaurants(
        restaurants.filter((r) =>
          matchesSearch(trimmed, [
            r.name,
            r.description,
            ...r.cuisineTypes,
          ])
        )
      );
      setFilteredServices(
        services.filter((s) =>
          matchesSearch(trimmed, [
            s.name,
            s.description,
            ...s.serviceCategories,
          ])
        )
      );
      setFilteredAttractions(
        attractions.filter((a) =>
          matchesSearch(trimmed, [
            a.name,
            a.description,
            ...a.attractionType,
          ])
        )
      );
    } else {
      setFilteredRestaurants(restaurants);
      setFilteredServices(services);
      setFilteredAttractions(attractions);
    }
  }, [searchQuery, restaurants, services, attractions]);

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
              <div className="flex justify-center mb-2"><AppLogo /></div>
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
              <div className="flex justify-center mb-2"><AppLogo /></div>
              <h1 className="text-4xl font-bold text-foreground">Welcome to</h1>
              <p className="text-lg text-muted-foreground">{accommodation!.name}</p>
            </div>
            <Card>
              <CardContent className="p-4">
                <div className="mb-4">
                  <ImageCarousel
                    images={[
                      ...(accommodation!.imageUrl ? [accommodation!.imageUrl] : []),
                      ...(accommodation!.imageUrls || []),
                    ]}
                    alt={accommodation!.name}
                    className="w-full h-48 md:h-64 object-cover"
                    placeholderClassName="w-full h-48 md:h-64"
                    intervalMs={3000}
                  />
                </div>
                <h3 className="font-semibold text-lg truncate">{accommodation!.name}</h3>

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
                      {accommodation!.primaryContact || accommodation!.policeContact || accommodation!.doctorContact || accommodation!.ambulanceContact || accommodation!.hospitalContact || accommodation!.fireDepartmentContact ? (
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
                        </>
                      ) : (
                        fallbackSpan
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                </div>
              </CardContent>
            </Card>
          </>
        )}

        <div className="space-y-4">
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 min-h-[48px]">
              <TabsTrigger value="restaurants" className="min-h-[44px] touch-manipulation">Restaurants ({filteredRestaurants.length})</TabsTrigger>
              <TabsTrigger value="services" className="min-h-[44px] touch-manipulation">Services ({filteredServices.length})</TabsTrigger>
              <TabsTrigger value="attractions" className="min-h-[44px] touch-manipulation">Attractions ({filteredAttractions.length})</TabsTrigger>
            </TabsList>

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
                          <OptimizedImage
                            src={restaurant.imageUrl || ""}
                            alt={restaurant.name}
                            className="w-full sm:w-20 h-32 sm:h-20 object-cover rounded flex-shrink-0"
                            placeholderClassName="w-full sm:w-20 h-32 sm:h-20 rounded flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold truncate">{restaurant.name}</h4>
                              {restaurant.littleExplorerApproved && <span title="Little Explorer Approved">👶</span>}
                            </div>

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
                                Little Explorer Approved
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
                                Bookings
                              </CollapsibleTrigger>
                              <CollapsibleContent className={`${contentClass} text-sm space-y-2`}>
                                {restaurant.bookingsEmail || restaurant.bookingsContactNumber ? (
                                  <>
                                    {restaurant.bookingsEmail && (
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                        <a href={`mailto:${restaurant.bookingsEmail}`} className="text-purple-600 hover:underline break-all">
                                          {restaurant.bookingsEmail}
                                        </a>
                                      </div>
                                    )}
                                    {restaurant.bookingsContactNumber && (
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                        <a href={`tel:${restaurant.bookingsContactNumber}`} className="text-purple-600 hover:underline">
                                          {restaurant.bookingsContactNumber}
                                        </a>
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
                                Socials
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
                          <OptimizedImage
                            src={service.imageUrl || ""}
                            alt={service.name}
                            className="w-full sm:w-20 h-32 sm:h-20 object-cover rounded flex-shrink-0"
                            placeholderClassName="w-full sm:w-20 h-32 sm:h-20 rounded flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0 space-y-2">
                            <h4 className="font-semibold truncate">{service.name}</h4>

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
                                Little Explorer Approved
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
                          <OptimizedImage
                            src={attraction.imageUrl || ""}
                            alt={attraction.name}
                            className="w-full sm:w-20 h-32 sm:h-20 object-cover rounded flex-shrink-0"
                            placeholderClassName="w-full sm:w-20 h-32 sm:h-20 rounded flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0 space-y-2">
                            <h4 className="font-semibold truncate">{attraction.name}</h4>

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
                                Little Explorer Approved
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
        <SwipeIndicator show={filteredRestaurants.length > 0 || filteredServices.length > 0 || filteredAttractions.length > 0} />
      </div>
    </div>
  );
}
