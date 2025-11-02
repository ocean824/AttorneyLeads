import { Clock, CheckCircle, XCircle, Loader2, Database } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ScrapeJob } from "@shared/schema";
import { format } from "date-fns";

interface JobCardProps {
  job: ScrapeJob;
}

export function JobCard({ job }: JobCardProps) {
  const getStatusIcon = () => {
    switch (job.status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-destructive" />;
      case "running":
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    switch (job.status) {
      case "completed":
        return "default";
      case "running":
        return "secondary";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const counties = job.counties.split(',');
  const duration = job.completedAt
    ? Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000 / 60)
    : null;

  return (
    <Card className="p-6 hover-elevate" data-testid={`card-job-${job.id}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">
                Job {job.jobId.slice(0, 8)}
              </h3>
              <Badge variant={getStatusVariant()} data-testid={`badge-job-status-${job.status}`}>
                {job.status}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {format(new Date(job.startedAt), 'PPp')}
            </div>
          </div>
        </div>
      </div>

      {/* Counties */}
      <div className="mb-4">
        <div className="text-sm font-medium text-foreground mb-2">Counties:</div>
        <div className="flex flex-wrap gap-2">
          {counties.map(county => (
            <Badge key={county} variant="outline" className="text-xs">
              {county.trim()}
            </Badge>
          ))}
        </div>
      </div>

      {/* Progress/Stats */}
      {job.status === "running" && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">In Progress...</span>
            <span className="text-sm text-muted-foreground">
              {job.recordsFound} records found
            </span>
          </div>
          <Progress value={undefined} className="h-2" />
        </div>
      )}

      {/* Results */}
      <div className="grid grid-cols-2 gap-4 p-4 rounded-md bg-muted/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Records Found</span>
          </div>
          <div className="text-2xl font-bold text-foreground" data-testid={`text-records-found-${job.id}`}>
            {job.recordsFound.toLocaleString()}
          </div>
        </div>
        {duration !== null && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Duration</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {duration}m
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {job.status === "failed" && job.errorMessage && (
        <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20">
          <div className="text-sm font-medium text-destructive mb-1">Error:</div>
          <div className="text-sm text-destructive/90">{job.errorMessage}</div>
        </div>
      )}
    </Card>
  );
}
