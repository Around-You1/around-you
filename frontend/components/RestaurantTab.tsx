import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, Upload, Download, FileText } from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";
import type { Restaurant } from "~backend/restaurant/types";
import type { ProfileSettings } from "~backend/storage/get_profile_settings";
import { useToast } from "@/components/ui/use-toast";
import RestaurantList from "./RestaurantList";
import RestaurantForm from "./RestaurantForm";
import BulkImportDialog from "./BulkImportDialog";
import SortControls, { SortField, SortOrder } from "./SortControls";

function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string): boolean {
  if (!value) return true;
  return /^[+\d\s\-().]{7,20}$/.test(value);
}

function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

interface RestaurantTabProps {
  onUpdate: () => void;
}

export default function RestaurantTab({ onUpdate }: RestaurantTabProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingRestaurantId, setEditingRestaurantId] = useState<number | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [profileSettings, setProfileSettings] = useState<ProfileSettings>({
    bookingsEmail: "",
    bookingsContactNumber: "",
    socialsWebsite: "",
    socialsInstagram: "",
    socialsTwitter: "",
    socialsYoutube: "",
    socialsTiktok: "",
  });
  const [profileSettingsDirty, setProfileSettingsDirty] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadRestaurants();
  }, [sortBy, sortOrder]);

  useEffect(() => {
    loadProfileSettings();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = restaurants.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.postalCode.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredRestaurants(filtered);
    } else {
      setFilteredRestaurants(restaurants);
    }
  }, [searchQuery, restaurants]);

  const loadRestaurants = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const data = await backend.restaurant.list({ sortBy, sortOrder });
      setRestaurants(data.restaurants);
      setFilteredRestaurants(data.restaurants);
    } catch (error) {
      console.error("Failed to load restaurants:", error);
      toast({
        title: "Error",
        description: "Failed to load restaurants",
        variant: "destructive",
      });
    }
  };

  const loadProfileSettings = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const data = await backend.storage.getProfileSettings();
      setProfileSettings(data);
    } catch (error) {
      console.error("Failed to load profile settings:", error);
    }
  };

  const updateSetting = (field: keyof ProfileSettings, value: string) => {
    setProfileSettings((prev) => ({ ...prev, [field]: value }));
    setProfileSettingsDirty(true);
  };

  const saveProfileSettings = async () => {
    if (!isValidEmail(profileSettings.bookingsEmail)) {
      toast({ title: "Validation Error", description: "Bookings email is not valid", variant: "destructive" });
      return;
    }
    if (!isValidPhone(profileSettings.bookingsContactNumber)) {
      toast({ title: "Validation Error", description: "Bookings contact number is not valid", variant: "destructive" });
      return;
    }
    const urlFields: [keyof ProfileSettings, string][] = [
      ["socialsWebsite", "Website"],
      ["socialsInstagram", "Instagram"],
      ["socialsTwitter", "X (Twitter)"],
      ["socialsYoutube", "YouTube"],
      ["socialsTiktok", "TikTok"],
    ];
    for (const [field, label] of urlFields) {
      if (!isValidUrl(profileSettings[field])) {
        toast({ title: "Validation Error", description: `${label} URL is not valid`, variant: "destructive" });
        return;
      }
    }

    setSavingSettings(true);
    try {
      const backend = getAuthenticatedBackend();
      await backend.storage.setProfileSettings(profileSettings);
      setProfileSettingsDirty(false);
      toast({ title: "Saved", description: "Profile settings updated successfully" });
    } catch (error) {
      console.error("Failed to save profile settings:", error);
      toast({ title: "Error", description: "Failed to save profile settings", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleEdit = (restaurant: Restaurant) => {
    setEditingRestaurantId(restaurant.id);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingRestaurantId(null);
    loadRestaurants();
    onUpdate();
  };

  const handleDownloadTemplate = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const result = await backend.restaurant.template();
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "restaurants-template.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Template download failed:", error);
      toast({
        title: "Error",
        description: "Failed to download template",
        variant: "destructive",
      });
    }
  };

  const handleBulkExport = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const result = await backend.restaurant.exportRestaurants();
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `restaurants-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: "Success",
        description: "Restaurants exported successfully",
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Error",
        description: "Failed to export restaurants",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bookings-email">Email Address</Label>
              <Input
                id="bookings-email"
                type="email"
                placeholder="bookings@example.com"
                value={profileSettings.bookingsEmail}
                onChange={(e) => updateSetting("bookingsEmail", e.target.value)}
                className={profileSettings.bookingsEmail && !isValidEmail(profileSettings.bookingsEmail) ? "border-red-500" : ""}
              />
              {profileSettings.bookingsEmail && !isValidEmail(profileSettings.bookingsEmail) && (
                <p className="text-xs text-red-500">Enter a valid email address</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bookings-contact">Contact Number</Label>
              <Input
                id="bookings-contact"
                type="tel"
                placeholder="+27 12 345 6789"
                value={profileSettings.bookingsContactNumber}
                onChange={(e) => updateSetting("bookingsContactNumber", e.target.value)}
                className={profileSettings.bookingsContactNumber && !isValidPhone(profileSettings.bookingsContactNumber) ? "border-red-500" : ""}
              />
              {profileSettings.bookingsContactNumber && !isValidPhone(profileSettings.bookingsContactNumber) && (
                <p className="text-xs text-red-500">Enter a valid contact number</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Socials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {([
              { field: "socialsWebsite" as keyof ProfileSettings, label: "Website", placeholder: "https://example.com" },
              { field: "socialsInstagram" as keyof ProfileSettings, label: "Instagram", placeholder: "https://instagram.com/yourprofile" },
              { field: "socialsTwitter" as keyof ProfileSettings, label: "X (Twitter)", placeholder: "https://x.com/yourhandle" },
              { field: "socialsYoutube" as keyof ProfileSettings, label: "YouTube", placeholder: "https://youtube.com/@yourchannel" },
              { field: "socialsTiktok" as keyof ProfileSettings, label: "TikTok", placeholder: "https://tiktok.com/@yourprofile" },
            ]).map(({ field, label, placeholder }) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={field}>{label}</Label>
                <Input
                  id={field}
                  type="url"
                  placeholder={placeholder}
                  value={profileSettings[field]}
                  onChange={(e) => updateSetting(field, e.target.value)}
                  className={profileSettings[field] && !isValidUrl(profileSettings[field]) ? "border-red-500" : ""}
                />
                {profileSettings[field] && !isValidUrl(profileSettings[field]) && (
                  <p className="text-xs text-red-500">Enter a valid URL (e.g. https://...)</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {profileSettingsDirty && (
        <div className="flex justify-end">
          <Button onClick={saveProfileSettings} disabled={savingSettings} className="bg-purple-600 hover:bg-purple-700 text-white">
            {savingSettings ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search restaurants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Restaurant
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportDialog(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkExport}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Bulk CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
            >
              <FileText className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>
          <SortControls
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(newSortBy, newSortOrder) => {
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
            }}
          />
        </div>
      </div>

      {showForm ? (
        <RestaurantForm
          restaurantId={editingRestaurantId}
          onClose={handleFormClose}
        />
      ) : (
        <RestaurantList
          restaurants={filteredRestaurants}
          onEdit={handleEdit}
          onUpdate={loadRestaurants}
        />
      )}

      <BulkImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={() => {
          loadRestaurants();
          onUpdate();
        }}
        entityType="restaurant"
      />
    </div>
  );
}
