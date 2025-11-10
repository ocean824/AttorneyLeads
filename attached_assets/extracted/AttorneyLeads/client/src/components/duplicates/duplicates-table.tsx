import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DuplicateReviewModal } from "./duplicate-review-modal";
import type { DuplicateCandidate, ArrestRecord } from "@shared/schema";

interface DuplicatesTableProps {
  candidates: DuplicateCandidate[];
  isLoading: boolean;
}

export function DuplicatesTable({ candidates, isLoading }: DuplicatesTableProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<DuplicateCandidate | null>(null);

  const getConfidenceBadge = (score: number) => {
    if (score >= 90) {
      return <Badge variant="destructive" data-testid={`badge-confidence-high`}>High ({score}%)</Badge>;
    } else if (score >= 70) {
      return <Badge variant="default" data-testid={`badge-confidence-medium`}>Medium ({score}%)</Badge>;
    } else {
      return <Badge variant="secondary" data-testid={`badge-confidence-low`}>Low ({score}%)</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="default" data-testid={`badge-status-pending`}>Pending</Badge>;
      case "merged":
        return <Badge variant="secondary" data-testid={`badge-status-merged`}>Merged</Badge>;
      case "dismissed":
        return <Badge variant="secondary" data-testid={`badge-status-dismissed`}>Dismissed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-12 border rounded-md bg-card">
        <p className="text-muted-foreground">No duplicate candidates found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Click "Scan for Duplicates" to check for potential matches
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Confidence</TableHead>
              <TableHead>Match Reasons</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((candidate) => {
              const reasons = JSON.parse(candidate.matchReasons || "[]");
              const reasonsText = reasons.map((r: any) => r.factor).join(", ");

              return (
                <TableRow key={candidate.id} data-testid={`row-duplicate-${candidate.id}`}>
                  <TableCell>
                    {getConfidenceBadge(candidate.confidenceScore)}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <span className="text-sm text-muted-foreground truncate block">
                      {reasonsText || "No details"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(candidate.status)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(candidate.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCandidate(candidate)}
                      data-testid={`button-review-${candidate.id}`}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedCandidate && (
        <DuplicateReviewModal
          candidate={selectedCandidate}
          open={!!selectedCandidate}
          onOpenChange={(open: boolean) => !open && setSelectedCandidate(null)}
        />
      )}
    </>
  );
}
