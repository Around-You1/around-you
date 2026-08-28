import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown } from "lucide-react";
import { SA_PROVINCES } from "../lib/saRegions";

export type SortField = "name" | "created_at" | "is_active" | "province" | "is_duplicate" | "rep_code";
export type SortOrder = "asc" | "desc";
export type ProvinceSubSort = "name" | "created_at" | "rep_code";

// SortState carries every control's value. Base modes (name/created_at/…) use
// sortOrder; "rep_code" uses repCodeFilter; "province" uses province + subSort.
export interface SortState {
  sortBy: SortField;
  sortOrder: SortOrder;
  repCodeFilter: string;
  province: string;
  provinceSubSort: ProvinceSubSort;
}

export const DEFAULT_SORT_STATE: SortState = {
  sortBy: "created_at",
  sortOrder: "desc",
  repCodeFilter: "",
  province: "",
  provinceSubSort: "name",
};

// Minimal shape the client-side sorter needs — every partner list type
// (restaurant/service/attraction/accommodation) already exposes these.
interface Sortable {
  name: string;
  province?: string;
  createdAt?: string;
  officialRepCode?: string;
  isActive?: boolean;
  isDuplicate?: boolean;
}

// applySortState filters + orders a fully-loaded list client-side, so the same
// rules work identically across all four partner tabs.
export function applySortState<T extends Sortable>(items: T[], s: SortState): T[] {
  const out = [...items];
  const byName = (a: T, b: T) => (a.name || "").localeCompare(b.name || "");
  const byNewest = (a: T, b: T) => (b.createdAt || "").localeCompare(a.createdAt || "");
  const byRep = (a: T, b: T) =>
    (a.officialRepCode || "").localeCompare(b.officialRepCode || "") || byName(a, b);

  if (s.sortBy === "rep_code") {
    const q = s.repCodeFilter.trim().toLowerCase();
    const filtered = q ? out.filter((i) => (i.officialRepCode || "").toLowerCase() === q) : out;
    return filtered.sort(byRep);
  }

  if (s.sortBy === "province") {
    const filtered = s.province ? out.filter((i) => (i.province || "") === s.province) : out;
    const sub =
      s.provinceSubSort === "created_at" ? byNewest : s.provinceSubSort === "rep_code" ? byRep : byName;
    // Group by province first (when showing all provinces), then apply sub-sort.
    return filtered.sort((a, b) => (a.province || "").localeCompare(b.province || "") || sub(a, b));
  }

  const dir = s.sortOrder === "asc" ? 1 : -1;
  return out.sort((a, b) => {
    let cmp = 0;
    switch (s.sortBy) {
      case "name": cmp = byName(a, b); break;
      case "created_at": cmp = (a.createdAt || "").localeCompare(b.createdAt || ""); break;
      case "is_active": cmp = Number(!!a.isActive) - Number(!!b.isActive); break;
      case "is_duplicate": cmp = Number(!!a.isDuplicate) - Number(!!b.isDuplicate); break;
    }
    return cmp * dir;
  });
}

interface SortControlsProps {
  state: SortState;
  onChange: (state: SortState) => void;
}

export default function SortControls({ state, onChange }: SortControlsProps) {
  const sortOptions: { value: SortField; label: string }[] = [
    { value: "name", label: "Name (A-Z)" },
    { value: "created_at", label: "Latest Loaded" },
    { value: "is_active", label: "Status" },
    { value: "province", label: "Province" },
    { value: "is_duplicate", label: "Duplicate Status" },
    { value: "rep_code", label: "Rep Code" },
  ];

  const set = (patch: Partial<SortState>) => onChange({ ...state, ...patch });
  const isSimple = state.sortBy !== "province" && state.sortBy !== "rep_code";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Sort by:</span>
      <Select value={state.sortBy} onValueChange={(v) => set({ sortBy: v as SortField })}>
        <SelectTrigger className="w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isSimple && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => set({ sortOrder: state.sortOrder === "asc" ? "desc" : "asc" })}
          className="h-10 w-10 p-0"
          title={state.sortOrder === "asc" ? "Sort Ascending" : "Sort Descending"}
        >
          {state.sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
        </Button>
      )}

      {state.sortBy === "rep_code" && (
        <Input
          value={state.repCodeFilter}
          onChange={(e) => set({ repCodeFilter: e.target.value })}
          placeholder="Enter rep code"
          className="w-[160px] font-mono"
        />
      )}

      {state.sortBy === "province" && (
        <>
          <Select value={state.province || "__all"} onValueChange={(v) => set({ province: v === "__all" ? "" : v })}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="All provinces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All provinces</SelectItem>
              {SA_PROVINCES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={state.provinceSubSort} onValueChange={(v) => set({ provinceSubSort: v as ProvinceSubSort })}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Alphabetical</SelectItem>
              <SelectItem value="created_at">Latest Loaded</SelectItem>
              <SelectItem value="rep_code">Rep Code</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
}
