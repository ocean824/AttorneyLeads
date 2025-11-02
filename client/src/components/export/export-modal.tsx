import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileJson } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ExportRecordsRequest } from "@shared/schema";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRecordIds?: string[];
  filters?: {
    county?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export function ExportModal({
  open,
  onOpenChange,
  selectedRecordIds,
  filters,
}: ExportModalProps) {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const { toast } = useToast();

  const exportMutation = useMutation({
    mutationFn: async (data: ExportRecordsRequest) => {
      const response = await apiRequest("POST", "/api/records/bulk-export", data);
      return response;
    },
    onSuccess: (data: any) => {
      // Trigger download
      const blob = new Blob([data.content], {
        type: format === "csv" ? "text/csv" : "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `arrest-records-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: `${data.count} records exported as ${format.toUpperCase()}`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    const exportData: ExportRecordsRequest = {
      format,
      recordIds: selectedRecordIds && selectedRecordIds.length > 0 ? selectedRecordIds : undefined,
      filters: filters && (filters.county || filters.dateFrom || filters.dateTo) ? filters : undefined,
    };

    exportMutation.mutate(exportData);
  };

  const exportCount = selectedRecordIds && selectedRecordIds.length > 0
    ? selectedRecordIds.length
    : "all filtered";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-export">
        <DialogHeader>
          <DialogTitle>Export Arrest Records</DialogTitle>
          <DialogDescription>
            Choose your export format for PhantomBuster and CRM integration
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Export Count */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="text-sm font-medium text-foreground mb-1">
              Records to export:
            </div>
            <div className="text-2xl font-bold text-foreground">
              {exportCount} records
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">
              Export Format
            </Label>
            <RadioGroup value={format} onValueChange={(value: "csv" | "json") => setFormat(value)}>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-border hover-elevate">
                  <RadioGroupItem value="csv" id="csv" data-testid="radio-format-csv" />
                  <Label htmlFor="csv" className="flex items-center gap-3 cursor-pointer flex-1">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="font-medium text-foreground">CSV (Recommended)</div>
                      <div className="text-sm text-muted-foreground">
                        PhantomBuster-compatible spreadsheet format
                      </div>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border border-border hover-elevate">
                  <RadioGroupItem value="json" id="json" data-testid="radio-format-json" />
                  <Label htmlFor="json" className="flex items-center gap-3 cursor-pointer flex-1">
                    <FileJson className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-foreground">JSON</div>
                      <div className="text-sm text-muted-foreground">
                        Structured data for API integration
                      </div>
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Preview Info */}
          <div className="text-sm text-muted-foreground">
            The export will include: Full name, booking date, charges, bond amount, county, facility, and contact information.
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-export"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="gap-2"
            data-testid="button-confirm-export"
          >
            <Download className="w-4 h-4" />
            {exportMutation.isPending ? "Exporting..." : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
