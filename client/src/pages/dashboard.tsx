import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Download, FileText } from "lucide-react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ScrapeWizard } from "@/components/scrape-wizard/scrape-wizard";
import { RecentJobsPreview } from "@/components/dashboard/recent-jobs-preview";
import type { ArrestRecord, ScrapeJob } from "@shared/schema";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalRecords: number;
    activeJobs: number;
    lastScrapeDate: string | null;
    exportCount: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const { data: recentJobs } = useQuery<ScrapeJob[]>({
    queryKey: ["/api/scrape/jobs"],
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Attorney Leads Dashboard
          </h1>
          <p className="text-muted-foreground">
            Scrape Florida arrest records and export qualified leads for your legal practice
          </p>
        </div>

        {/* Stats Overview */}
        <StatsCards stats={stats} isLoading={statsLoading} />

        {/* Scraping Wizard */}
        <div className="mb-8">
          <ScrapeWizard />
        </div>

        {/* Recent Jobs Preview */}
        <div>
          <RecentJobsPreview jobs={recentJobs?.slice(0, 5) || []} />
        </div>
      </div>
    </div>
  );
}
