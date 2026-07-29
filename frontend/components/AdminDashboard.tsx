import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, UtensilsCrossed, Scissors, Camera, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import StatsCard from "../components/StatsCard";
import PartnerCategoryMetrics from "../components/PartnerCategoryMetrics";
import LogoPlaceholder from "../components/LogoPlaceholder";
import AccommodationTab from "../components/AccommodationTab";
import RestaurantTab from "../components/RestaurantTab";
import ServiceTab from "../components/ServiceTab";
import AttractionTab from "../components/AttractionTab";
import RepsTab from "../components/RepsTab";

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalAccommodations: 0,
    totalRestaurants: 0,
    totalServices: 0,
    totalAttractions: 0,
    totalPartners: 0,
    activePartners: 0,
    inactivePartners: 0,
    accommodationStats: { totalCount: 0, activeCount: 0, inactiveCount: 0 },
    restaurantStats: { totalCount: 0, activeCount: 0, inactiveCount: 0 },
    serviceStats: { totalCount: 0, activeCount: 0, inactiveCount: 0 },
    attractionStats: { totalCount: 0, activeCount: 0, inactiveCount: 0 },
  });

  const { toast } = useToast();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const data = await backend.stats.get();
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard statistics",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold text-foreground">Admin Dashboard</h1>
            <Button variant="outline" onClick={() => router.push("/admin-analytics")}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics Dashboard
            </Button>
          </div>
          <LogoPlaceholder allowUpload={true} />
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Partner Metrics by Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <PartnerCategoryMetrics
              title="Acc"
              icon={Home}
              color="#007BFF"
              stats={stats.accommodationStats}
            />
            <PartnerCategoryMetrics
              title="Rest"
              icon={UtensilsCrossed}
              color="#FF3B30"
              stats={stats.restaurantStats}
            />
            <PartnerCategoryMetrics
              title="Serv"
              icon={Scissors}
              color="#34C759"
              stats={stats.serviceStats}
            />
            <PartnerCategoryMetrics
              title="Att"
              icon={Camera}
              color="#FFD60A"
              stats={stats.attractionStats}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Manage Content</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="accommodations" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5 min-h-[48px]">
                <TabsTrigger value="accommodations" className="min-h-[44px] touch-manipulation">Accommodations</TabsTrigger>
                <TabsTrigger value="restaurants" className="min-h-[44px] touch-manipulation">Restaurants</TabsTrigger>
                <TabsTrigger value="services" className="min-h-[44px] touch-manipulation">Services</TabsTrigger>
                <TabsTrigger value="attractions" className="min-h-[44px] touch-manipulation">Attractions</TabsTrigger>
                <TabsTrigger value="reps" className="min-h-[44px] touch-manipulation">Reps</TabsTrigger>
              </TabsList>

              <TabsContent value="accommodations">
                <AccommodationTab onUpdate={loadStats} />
              </TabsContent>

              <TabsContent value="restaurants">
                <RestaurantTab onUpdate={loadStats} />
              </TabsContent>

              <TabsContent value="services">
                <ServiceTab onUpdate={loadStats} />
              </TabsContent>

              <TabsContent value="attractions">
                <AttractionTab onUpdate={loadStats} />
              </TabsContent>

              <TabsContent value="reps">
                <RepsTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
