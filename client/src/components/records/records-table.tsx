import { useState } from "react";
import { Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ArrestRecord } from "@shared/schema";
import { format } from "date-fns";

function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 70) return 'destructive'; // High priority (red)
  if (score >= 40) return 'default'; // Medium priority (blue)
  return 'secondary'; // Low priority (gray)
}

function getScoreLabel(score: number): string {
  if (score >= 70) return 'High Priority';
  if (score >= 40) return 'Medium Priority';
  return 'Low Priority';
}

interface RecordsTableProps {
  records: ArrestRecord[];
  isLoading: boolean;
  selectedRecords: string[];
  onSelectionChange: (ids: string[]) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function RecordsTable({
  records,
  isLoading,
  selectedRecords,
  onSelectionChange,
  page,
  totalPages,
  onPageChange,
}: RecordsTableProps) {
  const [detailRecord, setDetailRecord] = useState<ArrestRecord | null>(null);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(records.map(r => r.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedRecords, id]);
    } else {
      onSelectionChange(selectedRecords.filter(rid => rid !== id));
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-medium text-foreground mb-2">
            No records found
          </h3>
          <p className="text-muted-foreground">
            Start a scraping job to collect arrest records or adjust your filters to see more results.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-hidden mb-6">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <Checkbox
                    checked={records.length > 0 && selectedRecords.length === records.length}
                    onCheckedChange={handleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-foreground">
                  County
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-foreground">
                  Booking Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-foreground">
                  Charges
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-foreground">
                  Bond Amount
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-foreground">
                  Lead Score
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr
                  key={record.id}
                  className={`border-b border-border hover-elevate ${
                    index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                  }`}
                  data-testid={`row-record-${record.id}`}
                >
                  <td className="px-4 py-4">
                    <Checkbox
                      checked={selectedRecords.includes(record.id)}
                      onCheckedChange={(checked) => handleSelectOne(record.id, checked as boolean)}
                      data-testid={`checkbox-record-${record.id}`}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-foreground">{record.fullName}</div>
                    {record.inmateId && (
                      <div className="text-sm text-muted-foreground">ID: {record.inmateId}</div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant="outline" className="whitespace-nowrap">
                      {record.county}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-sm text-foreground">
                    {format(new Date(record.bookingDate), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-4 py-4 text-sm text-foreground max-w-xs truncate">
                    {record.charges}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-foreground">
                    {record.bondAmount || 'N/A'}
                  </td>
                  <td className="px-4 py-4">
                    <Badge 
                      variant={getScoreBadgeVariant(record.leadScore || 0)}
                      className="font-semibold"
                      data-testid={`badge-score-${record.id}`}
                    >
                      {record.leadScore || 0}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailRecord(record)}
                      className="gap-2"
                      data-testid={`button-view-${record.id}`}
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-4 border-t border-border bg-muted/30">
          <div className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-record-details">
          <DialogHeader>
            <DialogTitle>Arrest Record Details</DialogTitle>
            <DialogDescription>
              Complete information for {detailRecord?.fullName}
            </DialogDescription>
          </DialogHeader>
          {detailRecord && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <DetailField label="Full Name" value={detailRecord.fullName} />
              <DetailField label="Inmate ID" value={detailRecord.inmateId} />
              <DetailField label="First Name" value={detailRecord.firstName} />
              <DetailField label="Last Name" value={detailRecord.lastName} />
              <DetailField label="County" value={detailRecord.county} />
              <DetailField label="Facility" value={detailRecord.facility} />
              <DetailField label="Booking Date" value={format(new Date(detailRecord.bookingDate), 'PPP')} />
              <DetailField label="Release Date" value={detailRecord.releaseDate ? format(new Date(detailRecord.releaseDate), 'PPP') : null} />
              <DetailField label="Age" value={detailRecord.age?.toString()} />
              <DetailField label="Gender" value={detailRecord.gender} />
              <DetailField label="Race" value={detailRecord.race} />
              <DetailField label="Bond Amount" value={detailRecord.bondAmount} />
              <div>
                <div className="text-sm font-semibold text-foreground mb-2">Lead Score</div>
                <Badge 
                  variant={getScoreBadgeVariant(detailRecord.leadScore || 0)}
                  className="font-semibold text-base px-3 py-1"
                >
                  {detailRecord.leadScore || 0} - {getScoreLabel(detailRecord.leadScore || 0)}
                </Badge>
              </div>
              <div className="col-span-2">
                <DetailField label="Charges" value={detailRecord.charges} />
              </div>
              <div className="col-span-2">
                <DetailField label="Source URL" value={detailRecord.sourceUrl} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold text-foreground">{label}</div>
      <div className="text-sm text-muted-foreground">{value || 'N/A'}</div>
    </div>
  );
}
