import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Upload, Download, FileText } from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";
import PendingApplications from "./PendingApplications";
import type { Restaurant } from "~backend/restaurant/types";
import { useToast } from "@/components/ui/use-toast";
import RestaurantList from "./RestaurantList";
import RestaurantForm from "./RestaurantForm";
import BulkImportDialog from "./BulkImportDialog";
import SortControls, { SortState, DEFAULT_SORT_STATE, applySortState } from "./SortControls";

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
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT_STATE);

  const { toast } = useToast();

  useEffect(() => {
    loadRestaurants();
  }, []);

  useEffect(() => {
    const searched = searchQuery.trim()
      ? restaurants.filter((r) =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.postalCode.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : restaurants;
    setFilteredRestaurants(applySortState(searched, sortState));
  }, [searchQuery, restaurants, sortState]);

  const loadRestaurants = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const data = await backend.restaurant.list({});
      setRestaurants(data.restaurants);
    } catch (error) {
      console.error("Failed to load restaurants:", error);
      toast({
        title: "Error",
        description: "Failed to load restaurants",
        variant: "destructive",
      });
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
          <SortControls state={sortState} onChange={setSortState} />
        </div>
      </div>

      {!showForm && <PendingApplications category="restaurant" />}

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
