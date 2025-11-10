import { Database, Activity, Calendar, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsCardsProps {
  stats?: {
    totalRecords: number;
    activeJobs: number;
    lastScrapeDate: string | null;
    exportCount: number;
  };
  isLoading: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  const cards = [
    {
      title: "Total Records",
      value: stats?.totalRecords?.toLocaleString() || "0",
      icon: Database,
      color: "text-chart-1",
      testId: "stat-total-records",
    },
    {
      title: "Active Jobs",
      value: stats?.activeJobs || 0,
      icon: Activity,
      color: "text-chart-2",
      testId: "stat-active-jobs",
    },
    {
      title: "Last Scrape",
      value: stats?.lastScrapeDate 
        ? new Date(stats.lastScrapeDate).toLocaleDateString()
        : "Never",
      icon: Calendar,
      color: "text-chart-3",
      testId: "stat-last-scrape",
    },
    {
      title: "Total Exports",
      value: stats?.exportCount || 0,
      icon: Download,
      color: "text-chart-4",
      testId: "stat-export-count",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => (
        <Card key={card.title} className="p-6" data-testid={card.testId}>
          <div className="flex items-center justify-between mb-4">
            <card.icon className={`w-8 h-8 ${card.color}`} />
          </div>
          {isLoading ? (
            <>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-foreground mb-1">
                {card.value}
              </div>
              <div className="text-sm text-muted-foreground">
                {card.title}
              </div>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}
