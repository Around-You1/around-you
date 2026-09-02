import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";
import { useToast } from "@/components/ui/use-toast";

interface BulkImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  entityType: "service" | "attraction" | "accommodation" | "restaurant" | "estate_agency" | "estate_agent" | "estate_property";
}

export default function BulkImportDialog({ open, onClose, onImportComplete, entityType }: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  const parseCsv = (text: string): any[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];

    const rawHeaders = parseCsvLine(lines[0]);
    const headers = rawHeaders.map(h => h.trim());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const row: any = {};

      headers.forEach((header, index) => {
        let value = values[index] || "";

        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }

        row[header] = value;
      });

      rows.push(row);
    }

    return rows;
  };

  const parseNumber = (value: string | undefined, fieldName?: string): number => {
    const trimmed = (value || "").trim();
    if (trimmed === "" || trimmed === "undefined" || trimmed === "null") {
      const field = fieldName ? ` for field '${fieldName}'` : "";
      const hint = trimmed === "undefined" || trimmed === "null"
        ? " (This usually means the CSV was created with outdated export code. Please download a fresh CSV export and try again.)"
        : "";
      throw new Error(`Missing or invalid number value${field}: "${value}"${hint}`);
    }
    const num = parseFloat(trimmed);
    if (isNaN(num)) {
      const field = fieldName ? ` for field '${fieldName}'` : "";
      throw new Error(`Invalid number value${field}: "${value}"`);
    }
    return num;
  };

  const isNotesRow = (row: any): boolean => {
    // Properties key off `title`; every other entity keys off `name`.
    const val = String(row.name || row.title || "").toLowerCase().trim();
    return val === "" || val.startsWith("valid values") || val.startsWith("must match") || val.startsWith("true or false") || val.startsWith("comma-separated");
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const rawRows = parseCsv(text);

      if (rawRows.length === 0) {
        throw new Error("CSV file is empty or invalid");
      }

      const dataRows = rawRows.filter(row => !isNotesRow(row));

      if (dataRows.length === 0) {
        throw new Error("No data rows found in CSV file");
      }

      const validateRequiredHeaders = (requiredHeaders: string[]) => {
        const firstRowKeys = Object.keys(rawRows[0] || {});
        const missingHeaders = requiredHeaders.filter(h => !firstRowKeys.includes(h));
        if (missingHeaders.length > 0) {
          throw new Error(
            `CSV file is missing required headers: ${missingHeaders.join(", ")}. ` +
            `Found headers: ${firstRowKeys.join(", ")}. ` +
            `Please ensure your CSV has the correct column names (check for extra spaces or typos).`
          );
        }
      };

      if (dataRows.some(row => row.latitude === "undefined" || row.longitude === "undefined")) {
        throw new Error(
          "This CSV file contains invalid data (literal 'undefined' values). " +
          "This usually means it was exported before recent bug fixes. " +
          "Please download a fresh CSV export and try again."
        );
      }

      if (entityType === "service") {
        validateRequiredHeaders(["name", "address", "latitude", "longitude", "country", "province", "serviceCategories"]);
        const rows = dataRows.map((row, index) => {
          try {
            // Forward every column present in the CSV (header names match the
            // backend's JSON field tags); only latitude/longitude need to be
            // numbers. New template columns flow through automatically.
            return {
              ...row,
              latitude: parseNumber(row.latitude, `latitude (row ${index + 2})`),
              longitude: parseNumber(row.longitude, `longitude (row ${index + 2})`),
            };
          } catch (error) {
            throw new Error(`Row ${index + 2} (${row.name || 'unnamed'}): ${error instanceof Error ? error.message : String(error)}`);
          }
        });

        const backend = getAuthenticatedBackend();
        const result = await backend.service.importServices({ rows });

        toast({
          title: result.success ? "Success" : "Partial Success",
          description: `Imported: ${result.imported}, Failed: ${result.failed}`,
          variant: result.success ? "default" : "destructive",
        });

        if (result.errors.length > 0) {
          console.error("Import errors:", result.errors);
        }
      } else if (entityType === "attraction") {
        validateRequiredHeaders(["name", "address", "latitude", "longitude", "country", "province", "attractionType"]);
        const rows = dataRows.map((row, index) => {
          try {
            return {
              ...row,
              latitude: parseNumber(row.latitude, `latitude (row ${index + 2})`),
              longitude: parseNumber(row.longitude, `longitude (row ${index + 2})`),
            };
          } catch (error) {
            throw new Error(`Row ${index + 2} (${row.name || 'unnamed'}): ${error instanceof Error ? error.message : String(error)}`);
          }
        });

        const backend = getAuthenticatedBackend();
        const result = await backend.attraction.importAttractions({ rows });

        toast({
          title: result.success ? "Success" : "Partial Success",
          description: `Imported: ${result.imported}, Failed: ${result.failed}`,
          variant: result.success ? "default" : "destructive",
        });

        if (result.errors.length > 0) {
          console.error("Import errors:", result.errors);
        }
      } else if (entityType === "accommodation") {
        validateRequiredHeaders(["name", "address", "latitude", "longitude", "country", "province"]);
        const rows = dataRows.map((row, index) => {
          try {
            return {
              ...row,
              area: row.area || "",
              latitude: parseNumber(row.latitude, `latitude (row ${index + 2})`),
              longitude: parseNumber(row.longitude, `longitude (row ${index + 2})`),
            };
          } catch (error) {
            throw new Error(`Row ${index + 2} (${row.name || 'unnamed'}): ${error instanceof Error ? error.message : String(error)}`);
          }
        });

        const backend = getAuthenticatedBackend();
        const result = await backend.accommodation.importAccommodations({ rows });

        toast({
          title: result.success ? "Success" : "Partial Success",
          description: `Imported: ${result.imported}, Failed: ${result.failed}`,
          variant: result.success ? "default" : "destructive",
        });

        if (result.errors.length > 0) {
          console.error("Import errors:", result.errors);
        }
      } else if (entityType === "restaurant") {
        validateRequiredHeaders(["name", "address", "latitude", "longitude", "country", "province", "cuisineTypes"]);
        const rows = dataRows.map((row, index) => {
          try {
            return {
              ...row,
              latitude: parseNumber(row.latitude, `latitude (row ${index + 2})`),
              longitude: parseNumber(row.longitude, `longitude (row ${index + 2})`),
            };
          } catch (error) {
            throw new Error(`Row ${index + 2} (${row.name || 'unnamed'}): ${error instanceof Error ? error.message : String(error)}`);
          }
        });

        const backend = getAuthenticatedBackend();
        const result = await backend.restaurant.importRestaurants({ rows });

        toast({
          title: result.success ? "Success" : "Partial Success",
          description: `Imported: ${result.imported}, Failed: ${result.failed}`,
          variant: result.success ? "default" : "destructive",
        });

        if (result.errors.length > 0) {
          console.error("Import errors:", result.errors);
        }
      } else if (entityType === "estate_agency" || entityType === "estate_agent" || entityType === "estate_property") {
        // Estate imports send raw string cells; the backend parses numbers/bools.
        validateRequiredHeaders(entityType === "estate_property" ? ["title"] : ["name"]);
        const rows = dataRows.map((row) => ({ ...row }));
        const backend = getAuthenticatedBackend();
        const result =
          entityType === "estate_agency" ? await backend.estate.importAgencies({ rows })
          : entityType === "estate_agent" ? await backend.estate.importAgents({ rows })
          : await backend.estate.importProperties({ rows });

        toast({
          title: result.success ? "Success" : "Partial Success",
          description: `Imported: ${result.imported}, Failed: ${result.failed}`,
          variant: result.success ? "default" : "destructive",
        });

        if (result.errors.length > 0) {
          console.error("Import errors:", result.errors);
        }
      }

      onImportComplete();
      onClose();
    } catch (error) {
      console.error("Import failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to import file";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const entityLabel = entityType === "service" ? "Services"
    : entityType === "attraction" ? "Attractions"
    : entityType === "restaurant" ? "Restaurants"
    : entityType === "estate_agency" ? "Estate Agencies"
    : entityType === "estate_agent" ? "Estate Agents"
    : entityType === "estate_property" ? "Properties"
    : "Accommodations";

  const entityLower = entityType === "service" ? "services"
    : entityType === "attraction" ? "attractions"
    : entityType === "restaurant" ? "restaurants"
    : entityType === "estate_agency" ? "estate agencies"
    : entityType === "estate_agent" ? "estate agents"
    : entityType === "estate_property" ? "properties"
    : "accommodations";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import {entityLabel} from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import {entityLower}. Download the template first to see required fields and valid values.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Select CSV File</Label>
            <div className="flex items-center gap-2">
              <input
                id="file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!file || loading}>
              <Upload className="w-4 h-4 mr-2" />
              {loading ? "Importing..." : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
