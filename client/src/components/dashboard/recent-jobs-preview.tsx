import { Link } from "wouter";
import { ArrowRight, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ScrapeJob } from "@shared/schema";
import { format } from "date-fns";

interface RecentJobsPreviewProps {
  jobs: ScrapeJob[];
}

export function RecentJobsPreview({ jobs }: RecentJobsPreviewProps) {
  if (!jobs || jobs.length === 0) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            No scraping jobs yet
          </h3>
          <p className="text-muted-foreground max-w-md mb-6">
            Start your first scraping job above to begin collecting attorney leads from Florida arrest records.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
          Recent Scraping Jobs
        </h2>
        <Link href="/jobs">
          <Button variant="outline" size="sm" className="gap-2" data-testid="link-view-all-jobs">
            View All
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between p-4 rounded-lg border border-border hover-elevate"
            data-testid={`job-preview-${job.id}`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Badge
                  variant={
                    job.status === "completed" ? "default" :
                    job.status === "running" ? "secondary" :
                    job.status === "failed" ? "destructive" :
                    "outline"
                  }
                  data-testid={`badge-status-${job.status}`}
                >
                  {job.status}
                </Badge>
                <span className="text-sm font-medium text-foreground">
                  {job.counties.split(',').join(', ')}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Started: {format(new Date(job.startedAt), 'MMM dd, yyyy HH:mm')}
                </span>
                <span>
                  Records: {job.recordsFound.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
