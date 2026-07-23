import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export type SortField = "name" | "created_at" | "is_active" | "province" | "is_duplicate";
export type SortOrder = "asc" | "desc";

interface SortControlsProps {
  sortBy: SortField;
  sortOrder: SortOrder;
  onSortChange: (sortBy: SortField, sortOrder: SortOrder) => void;
}

export default function SortControls({ sortBy, sortOrder, onSortChange }: SortControlsProps) {
  const sortOptions: { value: SortField; label: string }[] = [
    { value: "name", label: "Name (A-Z)" },
    { value: "created_at", label: "Latest Loaded" },
    { value: "is_active", label: "Status" },
    { value: "province", label: "Province" },
    { value: "is_duplicate", label: "Duplicate Status" },
  ];

  const toggleSortOrder = () => {
    onSortChange(sortBy, sortOrder === "asc" ? "desc" : "asc");
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Sort by:</span>
      <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortField, sortOrder)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={toggleSortOrder}
        className="h-10 w-10 p-0"
        title={sortOrder === "asc" ? "Sort Ascending" : "Sort Descending"}
      >
        {sortOrder === "asc" ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
