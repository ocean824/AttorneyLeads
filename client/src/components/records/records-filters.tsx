import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FLORIDA_COUNTIES } from "@shared/schema";

interface RecordsFiltersProps {
  filters: {
    county: string;
    dateFrom: string;
    dateTo: string;
    search: string;
  };
  onFiltersChange: (filters: any) => void;
}

export function RecordsFilters({ filters, onFiltersChange }: RecordsFiltersProps) {
  const handleClearFilters = () => {
    onFiltersChange({
      county: "",
      dateFrom: "",
      dateTo: "",
      search: "",
    });
  };

  const hasActiveFilters = filters.county || filters.dateFrom || filters.dateTo || filters.search;

  return (
    <div className="mb-6 p-6 rounded-lg border border-border bg-card">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, inmate ID, or charges..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-10"
            data-testid="input-search"
          />
        </div>

        {/* County Filter */}
        <Select
          value={filters.county}
          onValueChange={(value) => onFiltersChange({ ...filters, county: value })}
        >
          <SelectTrigger className="w-full md:w-48" data-testid="select-county-filter">
            <SelectValue placeholder="All Counties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Counties</SelectItem>
            {FLORIDA_COUNTIES.map(county => (
              <SelectItem key={county} value={county}>
                {county}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date From */}
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
          placeholder="Date From"
          className="w-full md:w-40"
          data-testid="input-date-from"
        />

        {/* Date To */}
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
          placeholder="Date To"
          className="w-full md:w-40"
          data-testid="input-date-to"
        />

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={handleClearFilters}
            className="gap-2"
            data-testid="button-clear-filters"
          >
            <X className="w-4 h-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
