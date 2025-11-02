import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Database, FileText, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FLORIDA_COUNTIES, type StartScrapeRequest } from "@shared/schema";
import { Link } from "wouter";

export function ScrapeActionPanel() {
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const startScrapeMutation = useMutation({
    mutationFn: async (data: StartScrapeRequest) => {
      return await apiRequest("POST", "/api/scrape/start", data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Scraping job started",
        description: `Job ${data.jobId} is now running. Monitor progress in the Jobs page.`,
      });
      setSelectedCounties([]);
      queryClient.invalidateQueries({ queryKey: ["/api/scrape/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start scraping",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCountyToggle = (county: string) => {
    setSelectedCounties(prev =>
      prev.includes(county)
        ? prev.filter(c => c !== county)
        : [...prev, county]
    );
  };

  const handleSelectAll = () => {
    setSelectedCounties(
      selectedCounties.length === FLORIDA_COUNTIES.length
        ? []
        : [...FLORIDA_COUNTIES]
    );
  };

  const handleStartScrape = () => {
    if (selectedCounties.length === 0) {
      toast({
        title: "No counties selected",
        description: "Please select at least one county to scrape.",
        variant: "destructive",
      });
      return;
    }

    startScrapeMutation.mutate({ counties: selectedCounties });
  };

  return (
    <Card className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Start New Scraping Job
        </h2>
        <p className="text-muted-foreground">
          Select counties to scrape arrest records from Florida public databases
        </p>
      </div>

      {/* County Selection */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Label className="text-base font-semibold">
            Select Counties ({selectedCounties.length} selected)
          </Label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            data-testid="button-select-all-counties"
          >
            {selectedCounties.length === FLORIDA_COUNTIES.length ? "Deselect All" : "Select All"}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-64 overflow-y-auto p-4 rounded-lg border border-border bg-muted/30">
          {FLORIDA_COUNTIES.map(county => (
            <div key={county} className="flex items-center gap-2">
              <Checkbox
                id={`county-${county}`}
                checked={selectedCounties.includes(county)}
                onCheckedChange={() => handleCountyToggle(county)}
                data-testid={`checkbox-county-${county.toLowerCase().replace(/\s+/g, '-')}`}
              />
              <Label
                htmlFor={`county-${county}`}
                className="text-sm font-normal cursor-pointer"
              >
                {county}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          onClick={handleStartScrape}
          disabled={startScrapeMutation.isPending || selectedCounties.length === 0}
          size="default"
          className="gap-2 flex-1"
          data-testid="button-start-scrape"
        >
          <Play className="w-4 h-4" />
          {startScrapeMutation.isPending ? "Starting..." : "Start Scraping Job"}
        </Button>

        <Link href="/records">
          <Button variant="outline" className="gap-2 flex-1" data-testid="button-view-records">
            <Database className="w-4 h-4" />
            View All Records
          </Button>
        </Link>

        <Link href="/jobs">
          <Button variant="outline" className="gap-2 flex-1" data-testid="button-view-jobs">
            <Activity className="w-4 h-4" />
            Job History
          </Button>
        </Link>
      </div>

      {/* Helper Text */}
      {selectedCounties.length > 0 && (
        <div className="mt-4 p-4 rounded-md bg-primary/10 border border-primary/20">
          <p className="text-sm text-foreground">
            <span className="font-medium">Estimated time:</span> 5-15 minutes for {selectedCounties.length} {selectedCounties.length === 1 ? 'county' : 'counties'}
          </p>
        </div>
      )}
    </Card>
  );
}
