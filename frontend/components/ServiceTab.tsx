import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Upload, Download, FileText, Search } from "lucide-react";
import ServiceList from "./ServiceList";
import ServiceForm from "./ServiceForm";
import BulkImportDialog from "./BulkImportDialog";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";
import SortControls, { SortField, SortOrder } from "./SortControls";

interface ServiceTabProps {
  onUpdate?: () => void;
}

export default function ServiceTab({ onUpdate }: ServiceTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const { toast } = useToast();

  const handleAdd = () => {
    setEditingServiceId(null);
    setShowForm(true);
  };

  const handleEdit = (serviceId: string) => {
    setEditingServiceId(serviceId);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingServiceId(null);
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
      const result = await backend.service.exportServices();
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `services-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: "Success",
        description: "Services exported successfully",
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Error",
        description: "Failed to export services",
        variant: "destructive",
      });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const result = await backend.service.template();
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "services-template.csv";
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
              placeholder="Search services..."
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
            Add Service
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
        <ServiceForm
          serviceId={editingServiceId}
          onClose={handleFormClose}
        />
      ) : (
        <ServiceList key={refreshKey} onEdit={handleEdit} onUpdate={onUpdate} searchQuery={searchQuery} sortBy={sortBy} sortOrder={sortOrder} />
      )}

      {showImport && (
        <BulkImportDialog
          open={showImport}
          onClose={() => setShowImport(false)}
          onImportComplete={handleImportClose}
          entityType="service"
        />
      )}
    </div>
  );
}
