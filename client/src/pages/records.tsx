import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecordsTable } from "@/components/records/records-table";
import { RecordsFilters } from "@/components/records/records-filters";
import { ExportModal } from "@/components/export/export-modal";
import type { ArrestRecord } from "@shared/schema";

export default function Records() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    county: "",
    dateFrom: "",
    dateTo: "",
    search: "",
  });
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const { data, isLoading } = useQuery<{
    records: ArrestRecord[];
    total: number;
    page: number;
    pageSize: number;
  }>({
    queryKey: ["/api/records", page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        ...(filters.county && { county: filters.county }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
        ...(filters.search && { search: filters.search }),
      });
      
      const res = await fetch(`/api/records?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch records');
      return res.json();
    },
  });

  const handleExport = () => {
    setExportModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Arrest Records
            </h1>
            <p className="text-muted-foreground">
              {data?.total || 0} total records available
            </p>
          </div>
          <Button
            onClick={handleExport}
            size="default"
            className="gap-2"
            data-testid="button-export"
          >
            <Download className="w-4 h-4" />
            Export Records
          </Button>
        </div>

        {/* Filters */}
        <RecordsFilters
          filters={filters}
          onFiltersChange={setFilters}
        />

        {/* Records Table */}
        <RecordsTable
          records={data?.records || []}
          isLoading={isLoading}
          selectedRecords={selectedRecords}
          onSelectionChange={setSelectedRecords}
          page={page}
          totalPages={Math.ceil((data?.total || 0) / (data?.pageSize || 20))}
          onPageChange={setPage}
        />

        {/* Export Modal */}
        <ExportModal
          open={exportModalOpen}
          onOpenChange={setExportModalOpen}
          selectedRecordIds={selectedRecords}
          filters={filters}
        />
      </div>
    </div>
  );
}
