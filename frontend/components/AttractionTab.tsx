import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Upload, Download, FileText, Search } from "lucide-react";
import AttractionList from "./AttractionList";
import AttractionForm from "./AttractionForm";
import BulkImportDialog from "./BulkImportDialog";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import SortControls, { SortField, SortOrder } from "./SortControls";

interface AttractionTabProps {
  onUpdate?: () => void;
}

export default function AttractionTab({ onUpdate }: AttractionTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingAttractionId, setEditingAttractionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const { toast } = useToast();

  const handleAdd = () => {
    setEditingAttractionId(null);
    setShowForm(true);
  };

  const handleEdit = (attractionId: string) => {
    setEditingAttractionId(attractionId);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingAttractionId(null);
    setRefreshKey((k) => k + 1);
    onUpdate?.();
  };

  const handleImportClose = () => {
    setShowImport(false);
    setRefreshKey((k) => k + 1);
    onUpdate?.();
  };



  const handleExport = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const result = await backend.attraction.exportAttractions();
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attractions-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: "Success",
        description: "Attractions exported successfully",
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Error",
        description: "Failed to export attractions",
        variant: "destructive",
      });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const result = await backend.attraction.template();
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "attractions-template.csv";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center gap-4">
          <div className="flex gap-2">
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add Attraction
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Download Bulk CSV
            </Button>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <FileText className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search attractions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
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

      {showForm ? (
        <AttractionForm
          attractionId={editingAttractionId}
          onClose={handleFormClose}
        />
      ) : (
        <AttractionList key={refreshKey} onEdit={handleEdit} onUpdate={onUpdate} searchQuery={searchQuery} sortBy={sortBy} sortOrder={sortOrder} />
      )}

      {showImport && (
        <BulkImportDialog
          open={showImport}
          onClose={() => setShowImport(false)}
          onImportComplete={handleImportClose}
          entityType="attraction"
        />
      )}
    </div>
  );
}
