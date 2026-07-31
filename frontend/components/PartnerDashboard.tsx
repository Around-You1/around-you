"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MapPin, Phone, ExternalLink, Building2, Store, Compass, LogOut, Navigation, Baby, ChevronDown } from "lucide-react";
import BookingsSocialsDropdowns from "../components/BookingsSocialsDropdowns";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import OptimizedImage from "../components/OptimizedImage";
import AppLogo from "../components/AppLogo";
import type { Restaurant } from "~backend/restaurant/types";
import type { ServiceData } from "~backend/service/types";
import type { AttractionData } from "~backend/attraction/types";

type EntityData = Restaurant | ServiceData | AttractionData;

export default function PartnerDashboard() {
  const [entity, setEntity] = useState<EntityData | null>(null);
  const [entityType, setEntityType] = useState<"restaurant" | "service" | "attraction" | null>(null);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/20 to-background p-6">
      <div className="max-w-4xl mx-auto space-y-8 py-8">
        <div className="relative text-center">
          <div className="flex justify-center mb-2"><AppLogo /></div>
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
                {entityType === "restaurant" && "littleExplorerApproved" in entity && entity.littleExplorerApproved && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#AEECE4]/20 text-[#AEECE4] border border-[#AEECE4]/30 rounded-full text-sm font-medium">
                      <Baby className="h-4 w-4" />
                      Little Explorer Approved
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {"imageUrl" in entity && entity.imageUrl && (
              <OptimizedImage
                src={entity.imageUrl}
                alt={entity.name}
                className="w-full h-64 object-cover rounded-lg"
                placeholderClassName="w-full h-64 rounded-lg"
              />
            )}

            <div className="grid gap-4">
              {entityType === "restaurant" && (
                <div className="space-y-2">
                  <BookingsSocialsDropdowns
                    triggerClass="flex items-center gap-2 text-sm font-medium hover:text-[#AEECE4] transition-colors w-full text-left"
                    contentClass="pl-6 pt-2"
                  />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Location</h3>
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
              </div>

              {"contactNumber" in entity && entity.contactNumber && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Contact</h3>
                  <a
                    href={`tel:${entity.contactNumber}`}
                    className="flex items-center gap-2 text-[#AEECE4] hover:underline"
                  >
                    <Phone className="h-5 w-5" />
                    {entity.contactNumber}
                  </a>
                </div>
              )}

              {entityType === "restaurant" && "cuisineTypes" in entity && entity.cuisineTypes.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Cuisine Types</h3>
                  <div className="flex flex-wrap gap-2">
                    {entity.cuisineTypes.map((type) => (
                      <span key={type} className="px-3 py-1 bg-[#AEECE4]/10 text-[#AEECE4] rounded-full text-sm">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {entityType === "service" && "serviceCategories" in entity && entity.serviceCategories.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Service Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {entity.serviceCategories.map((category) => (
                      <span key={category} className="px-3 py-1 bg-[#AEECE4]/10 text-[#AEECE4] rounded-full text-sm">
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {entityType === "attraction" && "attractionType" in entity && entity.attractionType.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Attraction Types</h3>
                  <div className="flex flex-wrap gap-2">
                    {entity.attractionType.map((type) => (
                      <span key={type} className="px-3 py-1 bg-[#AEECE4]/10 text-[#AEECE4] rounded-full text-sm">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {"description" in entity && entity.description && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Description</h3>
                  <p className="text-sm">{entity.description}</p>
                </div>
              )}

              {"discountOffered" in entity && entity.discountOffered && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Discount Offered</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-[#AEECE4]">{entity.discountOffered}</p>
                    {entity.discountCode && (
                      <span className="px-3 py-1.5 bg-[#AEECE4]/10 text-[#AEECE4] rounded text-lg font-mono font-bold tracking-wide">
                        {entity.discountCode}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {entityType === "restaurant" && "menuLink" in entity && entity.menuLink && (
                <div>
                  <Button
                    onClick={() => window.open(entity.menuLink!, "_blank")}
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
