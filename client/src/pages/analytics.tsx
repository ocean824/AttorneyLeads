import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Calendar, TrendingUp, Users, Award, Download } from "lucide-react";

interface AnalyticsData {
  recordsByCounty: Array<{ county: string; count: number }>;
  leadScoreDistribution: Array<{ range: string; count: number }>;
  chargeCategoryDistribution: Array<{ category: string; count: number }>;
  jobsOverTime: Array<{ date: string; total: number; completed: number; failed: number }>;
  aiStats: { totalRecords: number; aiEnhanced: number; avgConfidenceScore: number };
}

const COLORS = ["#2563EB", "#7C3AED", "#DB2777", "#DC2626", "#EA580C", "#D97706", "#CA8A04", "#65A30D", "#16A34A", "#059669"];

export default function Analytics() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { toast } = useToast();

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      const url = `/api/analytics${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const aiEnhancementRate = analytics.aiStats.totalRecords > 0
    ? Math.round((analytics.aiStats.aiEnhanced / analytics.aiStats.totalRecords) * 100)
    : 0;

  const exportAnalytics = (format: "csv" | "json") => {
    try {
      let content = "";
      let filename = "";
      let mimeType = "";

      if (format === "json") {
        content = JSON.stringify(analytics, null, 2);
        filename = `analytics-${new Date().toISOString().split("T")[0]}.json`;
        mimeType = "application/json";
      } else {
        // CSV format - export all data as multiple CSV sections
        const sections = [
          {
            title: "Records by County",
            headers: ["County", "Count"],
            rows: analytics.recordsByCounty.map(d => [d.county, d.count.toString()]),
          },
          {
            title: "Lead Score Distribution",
            headers: ["Range", "Count"],
            rows: analytics.leadScoreDistribution.map(d => [d.range, d.count.toString()]),
          },
          {
            title: "Charge Categories",
            headers: ["Category", "Count"],
            rows: analytics.chargeCategoryDistribution.map(d => [d.category, d.count.toString()]),
          },
          {
            title: "Jobs Over Time",
            headers: ["Date", "Total", "Completed", "Failed"],
            rows: analytics.jobsOverTime.map(d => [d.date, d.total.toString(), d.completed.toString(), d.failed.toString()]),
          },
        ];

        content = sections
          .map(section => {
            const sectionContent = [
              `\n${section.title}`,
              section.headers.join(","),
              ...section.rows.map(row => row.join(",")),
            ].join("\n");
            return sectionContent;
          })
          .join("\n\n");

        content = `Analytics Export - ${new Date().toISOString()}\n${content}`;
        filename = `analytics-${new Date().toISOString().split("T")[0]}.csv`;
        mimeType = "text/csv";
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Analytics data exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Visualize arrest record trends and scraping performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => exportAnalytics("csv")}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => exportAnalytics("json")}
            data-testid="button-export-json"
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Date Range Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range Filters
          </CardTitle>
          <CardDescription>Filter analytics by date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-records">
              {analytics.aiStats.totalRecords.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Arrest records collected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Enhanced</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-ai-enhanced">
              {analytics.aiStats.aiEnhanced.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {aiEnhancementRate}% of total records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-confidence">
              {analytics.aiStats.avgConfidenceScore}
            </div>
            <p className="text-xs text-muted-foreground">
              AI quality score (0-100)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Counties</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-counties-count">
              {analytics.recordsByCounty.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Florida counties scraped
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Records by County */}
        <Card>
          <CardHeader>
            <CardTitle>Records by County</CardTitle>
            <CardDescription>Distribution of arrest records across Florida counties</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.recordsByCounty.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="county" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Lead Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Score Distribution</CardTitle>
            <CardDescription>Quality scores of arrest records (0-100)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.leadScoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#7C3AED" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Charge Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Top Charge Categories</CardTitle>
            <CardDescription>
              Most common charge types (AI-enhanced records only)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.chargeCategoryDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.chargeCategoryDistribution}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {analytics.chargeCategoryDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No AI-enhanced records with charge categories
              </div>
            )}
          </CardContent>
        </Card>

        {/* Jobs Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Scraping Jobs Over Time</CardTitle>
            <CardDescription>Job success and failure rates by date</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.jobsOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.jobsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#2563EB" name="Total" />
                  <Line type="monotone" dataKey="completed" stroke="#16A34A" name="Completed" />
                  <Line type="monotone" dataKey="failed" stroke="#DC2626" name="Failed" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No scraping jobs data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
