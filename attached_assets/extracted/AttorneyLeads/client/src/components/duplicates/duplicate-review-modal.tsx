import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { MergeIcon, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DuplicateCandidate, ArrestRecord } from "@shared/schema";

interface DuplicateReviewModalProps {
  candidate: DuplicateCandidate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DuplicateReviewModal({
  candidate,
  open,
  onOpenChange,
}: DuplicateReviewModalProps) {
  const { toast } = useToast();

  const { data: record1, isLoading: loading1 } = useQuery<ArrestRecord>({
    queryKey: ["/api/records", candidate.recordId1],
    queryFn: async () => {
      const res = await fetch(`/api/records/${candidate.recordId1}`);
      if (!res.ok) throw new Error("Failed to fetch record");
      return res.json();
    },
    enabled: open,
  });

  const { data: record2, isLoading: loading2 } = useQuery<ArrestRecord>({
    queryKey: ["/api/records", candidate.recordId2],
    queryFn: async () => {
      const res = await fetch(`/api/records/${candidate.recordId2}`);
      if (!res.ok) throw new Error("Failed to fetch record");
      return res.json();
    },
    enabled: open,
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/duplicates/${candidate.id}/merge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast({
        title: "Records Merged",
        description: "Duplicate record has been removed",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Merge Failed",
        description: "Failed to merge records",
        variant: "destructive",
      });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/duplicates/${candidate.id}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/duplicates"] });
      toast({
        title: "Duplicate Dismissed",
        description: "These records will not be flagged as duplicates",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Dismiss Failed",
        description: "Failed to dismiss duplicate",
        variant: "destructive",
      });
    },
  });

  const reasons = JSON.parse(candidate.matchReasons || "[]");
  const isLoading = loading1 || loading2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Potential Duplicate</DialogTitle>
          <DialogDescription>
            Compare these records and decide whether to merge or dismiss
          </DialogDescription>
        </DialogHeader>

        {/* Confidence Score */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-md">
          <div>
            <span className="text-sm text-muted-foreground">Confidence Score:</span>
            <Badge variant="destructive" className="ml-2">
              {candidate.confidenceScore}%
            </Badge>
          </div>
          <div className="flex-1">
            <span className="text-sm text-muted-foreground">Match Reasons:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {reasons.map((reason: any, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {reason.factor}: {reason.score}pts
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Side-by-side comparison */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Record 1 */}
            <div className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Record 1</h3>
                <Badge variant="default">Primary</Badge>
              </div>
              {record1 && <RecordDetails record={record1} />}
            </div>

            {/* Record 2 */}
            <div className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Record 2</h3>
                <Badge variant="secondary">Duplicate</Badge>
              </div>
              {record2 && <RecordDetails record={record2} />}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => dismissMutation.mutate()}
            disabled={dismissMutation.isPending || candidate.status !== "pending"}
            data-testid="button-dismiss"
          >
            <X className="w-4 h-4 mr-2" />
            {dismissMutation.isPending ? "Dismissing..." : "Not Duplicates"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => mergeMutation.mutate()}
            disabled={mergeMutation.isPending || candidate.status !== "pending"}
            data-testid="button-merge"
          >
            <MergeIcon className="w-4 h-4 mr-2" />
            {mergeMutation.isPending ? "Merging..." : "Merge Records"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordDetails({ record }: { record: ArrestRecord }) {
  return (
    <div className="space-y-2 text-sm">
      <div>
        <span className="text-muted-foreground">Name:</span>
        <p className="font-medium">{record.fullName}</p>
      </div>
      <div>
        <span className="text-muted-foreground">Inmate ID:</span>
        <p>{record.inmateId || "N/A"}</p>
      </div>
      <div>
        <span className="text-muted-foreground">Booking Date:</span>
        <p>{format(new Date(record.bookingDate), "MMM d, yyyy h:mm a")}</p>
      </div>
      <div>
        <span className="text-muted-foreground">Charges:</span>
        <p>{record.charges}</p>
      </div>
      <div>
        <span className="text-muted-foreground">Bond Amount:</span>
        <p>{record.bondAmount || "N/A"}</p>
      </div>
      <div>
        <span className="text-muted-foreground">County:</span>
        <p>{record.county}</p>
      </div>
      <div>
        <span className="text-muted-foreground">Facility:</span>
        <p>{record.facility || "N/A"}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-muted-foreground">Age:</span>
          <p>{record.age || "N/A"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Gender:</span>
          <p>{record.gender || "N/A"}</p>
        </div>
      </div>
      <div>
        <span className="text-muted-foreground">Race:</span>
        <p>{record.race || "N/A"}</p>
      </div>
      <div>
        <span className="text-muted-foreground">Lead Score:</span>
        <Badge variant={record.leadScore >= 70 ? "destructive" : record.leadScore >= 40 ? "default" : "secondary"}>
          {record.leadScore}
        </Badge>
      </div>
    </div>
  );
}
