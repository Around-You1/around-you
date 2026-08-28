import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Upload, Download, FileText } from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";
import type { Accommodation } from "~backend/accommodation/types";
import { useToast } from "@/components/ui/use-toast";
import AccommodationList from "./AccommodationList";
import AccommodationForm from "./AccommodationForm";
import BulkImportDialog from "./BulkImportDialog";
import SortControls, { SortState, DEFAULT_SORT_STATE, applySortState } from "./SortControls";

interface AccommodationTabProps {
  onUpdate: () => void;
}

export default function AccommodationTab({ onUpdate }: AccommodationTabProps) {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [filteredAccommodations, setFilteredAccommodations] = useState<Accommodation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingAccommodation, setEditingAccommodation] = useState<Accommodation | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT_STATE);
  const { toast } = useToast();

  useEffect(() => {
    loadAccommodations();
  }, []);

  useEffect(() => {
    const searched = searchQuery.trim()
      ? accommodations.filter((a) =>
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.postalCode.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : accommodations;
    setFilteredAccommodations(applySortState(searched, sortState));
  }, [searchQuery, accommodations, sortState]);

  const loadAccommodations = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const data = await backend.accommodation.list({});
      setAccommodations(data.accommodations);
    } catch (error) {
      console.error("Failed to load accommodations:", error);
      toast({
        title: "Error",
        description: "Failed to load accommodations",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (accommodation: Accommodation) => {
    setEditingAccommodation(accommodation);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingAccommodation(null);
    loadAccommodations();
    onUpdate();
  };

  const handleDownloadTemplate = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const result = await backend.accommodation.template();
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "accommodations-template.csv";
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
      const result = await backend.accommodation.exportAccommodations();
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `accommodations-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: "Success",
        description: "Accommodations exported successfully",
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Error",
        description: "Failed to export accommodations",
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
              placeholder="Search accommodations..."
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
            Add Accommodation
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

      {showForm ? (
        <AccommodationForm
          accommodation={editingAccommodation}
          onClose={handleFormClose}
        />
      ) : (
        <AccommodationList
          accommodations={filteredAccommodations}
          onEdit={handleEdit}
          onUpdate={loadAccommodations}
        />
      )}
      
      <BulkImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={() => {
          loadAccommodations();
          onUpdate();
        }}
        entityType="accommodation"
      />
    </div>
  );
}
