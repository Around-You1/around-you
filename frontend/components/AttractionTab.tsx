import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Upload, Download, FileText, Search } from "lucide-react";
import AttractionList from "./AttractionList";
import AttractionForm from "./AttractionForm";
import BulkImportDialog from "./BulkImportDialog";
import { getAuthenticatedBackend } from "../lib/backend";
import PendingApplications from "./PendingApplications";
import { useToast } from "@/components/ui/use-toast";
import SortControls, { SortState, DEFAULT_SORT_STATE } from "./SortControls";

interface AttractionTabProps {
  onUpdate?: () => void;
}

export default function AttractionTab({ onUpdate }: AttractionTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingAttractionId, setEditingAttractionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT_STATE);
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
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search attractions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            onClick={handleAdd}
            className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Attraction
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
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

      {!showForm && <PendingApplications category="attraction" />}

      {showForm ? (
        <AttractionForm
          attractionId={editingAttractionId}
          onClose={handleFormClose}
        />
      ) : (
        <AttractionList key={refreshKey} onEdit={handleEdit} onUpdate={onUpdate} searchQuery={searchQuery} sortState={sortState} />
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
