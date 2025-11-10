import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter } from "lucide-react";
import { JobCard } from "@/components/jobs/job-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScrapeJob } from "@shared/schema";

export default function Jobs() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: jobs, isLoading } = useQuery<ScrapeJob[]>({
    queryKey: ["/api/scrape/jobs"],
    refetchInterval: 3000, // Poll every 3 seconds for real-time updates
  });

  const filteredJobs = jobs?.filter(job => 
    statusFilter === "all" || job.status === statusFilter
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Scraping Jobs
          </h1>
          <p className="text-muted-foreground">
            Monitor and review all scraping job history
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filter by status:</span>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Jobs Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-lg border border-border bg-card p-6 animate-pulse">
                <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredJobs && filteredJobs.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredJobs.map(job => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
              <Filter className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No jobs found</h3>
            <p className="text-muted-foreground max-w-md">
              {statusFilter === "all" 
                ? "Start your first scraping job from the dashboard to see results here."
                : `No jobs with status "${statusFilter}". Try changing the filter.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
