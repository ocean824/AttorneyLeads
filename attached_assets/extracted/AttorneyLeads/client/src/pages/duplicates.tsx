import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Scan, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DuplicatesTable } from "@/components/duplicates/duplicates-table";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DuplicateCandidate } from "@shared/schema";

export default function Duplicates() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const { data: candidates = [], isLoading } = useQuery<DuplicateCandidate[]>({
    queryKey: ["/api/duplicates", filter],
    queryFn: async () => {
      const params = filter === "pending" ? "?status=pending" : "";
      const res = await fetch(`/api/duplicates${params}`);
      if (!res.ok) throw new Error("Failed to fetch duplicates");
      return res.json();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/duplicates/scan");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/duplicates"] });
      toast({
        title: "Scan Complete",
        description: `Found ${data.scannedCount} potential duplicates`,
      });
    },
    onError: () => {
      toast({
        title: "Scan Failed",
        description: "Failed to scan for duplicates",
        variant: "destructive",
      });
    },
  });

  const pendingCount = candidates.filter(c => c.status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Duplicate Detection
            </h1>
            <p className="text-muted-foreground">
              Review and manage potential duplicate arrest records
            </p>
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-sm text-muted-foreground">
                  {pendingCount} pending {pendingCount === 1 ? "duplicate" : "duplicates"} awaiting review
                </span>
              </div>
            )}
          </div>
          <Button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            size="default"
            className="gap-2"
            data-testid="button-scan-duplicates"
          >
            <Scan className="w-4 h-4" />
            {scanMutation.isPending ? "Scanning..." : "Scan for Duplicates"}
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            onClick={() => setFilter("pending")}
            data-testid="button-filter-pending"
          >
            Pending
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingCount}
              </Badge>
            )}
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            data-testid="button-filter-all"
          >
            All
            <Badge variant="secondary" className="ml-2">
              {candidates.length}
            </Badge>
          </Button>
        </div>

        {/* Duplicates Table */}
        <DuplicatesTable
          candidates={candidates}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
