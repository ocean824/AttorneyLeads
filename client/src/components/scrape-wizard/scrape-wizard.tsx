import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ChevronRight, ChevronLeft, Sparkles, Download } from "lucide-react";
import { FLORIDA_COUNTIES } from "@shared/schema";
import { z } from "zod";

const wizardSchema = z.object({
  counties: z.array(z.string()).min(1, "Select at least one county"),
  enableAI: z.boolean().default(true),
  exportFormat: z.enum(["csv", "json"]).default("csv"),
  autoExport: z.boolean().default(false),
});

type WizardFormData = z.infer<typeof wizardSchema>;

export function ScrapeWizard({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState(1);
  const { toast } = useToast();

  const form = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      counties: [],
      enableAI: true,
      exportFormat: "csv",
      autoExport: false,
    },
  });

  const startScrapeMutation = useMutation({
    mutationFn: async (data: { counties: string[]; enableAI: boolean }) => {
      return await apiRequest("POST", "/api/scrape/start", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scrape/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Scraping Started",
        description: "Your scraping job has been queued successfully.",
      });
      form.reset();
      setStep(1);
      onComplete?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start scraping job",
        variant: "destructive",
      });
    },
  });

  const selectedCounties = form.watch("counties");
  const enableAI = form.watch("enableAI");

  const progressPercentage = (step / 3) * 100;

  const nextStep = () => {
    if (step === 1 && selectedCounties.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select at least one county",
        variant: "destructive",
      });
      return;
    }
    setStep((prev) => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = form.handleSubmit((data) => {
    startScrapeMutation.mutate({
      counties: data.counties,
      enableAI: data.enableAI,
    });
  });

  const toggleCounty = (county: string) => {
    const current = selectedCounties;
    if (current.includes(county)) {
      form.setValue("counties", current.filter((c) => c !== county));
    } else {
      form.setValue("counties", [...current, county]);
    }
  };

  const selectAll = () => {
    form.setValue("counties", FLORIDA_COUNTIES);
  };

  const deselectAll = () => {
    form.setValue("counties", []);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto" data-testid="card-scrape-wizard">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Scraping Wizard</CardTitle>
            <CardDescription>
              Step {step} of 3: {step === 1 ? "Select Counties" : step === 2 ? "AI Enhancement" : "Review & Start"}
            </CardDescription>
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedCounties.length} {selectedCounties.length === 1 ? "county" : "counties"} selected
          </div>
        </div>
        <Progress value={progressPercentage} className="mt-4" data-testid="progress-wizard" />
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: County Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                  data-testid="button-select-all"
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={deselectAll}
                  data-testid="button-deselect-all"
                >
                  Deselect All
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {FLORIDA_COUNTIES.map((county) => (
                  <div
                    key={county}
                    className="flex items-center space-x-2 p-3 rounded-md border hover-elevate active-elevate-2"
                    data-testid={`checkbox-county-${county.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Checkbox
                      id={`county-${county}`}
                      checked={selectedCounties.includes(county)}
                      onCheckedChange={() => toggleCounty(county)}
                    />
                    <label 
                      htmlFor={`county-${county}`}
                      className="text-sm font-medium cursor-pointer flex-1"
                    >
                      {county}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: AI Enhancement */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div>
                    <Label htmlFor="enable-ai" className="text-base font-semibold">
                      AI Enhancement
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Automatically categorize charges, normalize names, and calculate data quality scores
                    </p>
                  </div>
                </div>
                <Switch
                  id="enable-ai"
                  checked={enableAI}
                  onCheckedChange={(checked) => form.setValue("enableAI", checked)}
                  data-testid="switch-enable-ai"
                />
              </div>

              {enableAI && (
                <div className="bg-primary/5 border-l-4 border-primary p-4 rounded">
                  <h4 className="font-semibold text-sm mb-2">AI Enhancement Features:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Charge categorization (violent, property, drug, etc.)</li>
                    <li>• Name standardization and normalization</li>
                    <li>• Data quality confidence scoring (0-100)</li>
                    <li>• Risk level assessment (low, medium, high)</li>
                    <li>• Processing time: ~3-7 minutes for 30 records</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review & Start */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Selected Counties ({selectedCounties.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCounties.map((county) => (
                      <span
                        key={county}
                        className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                        data-testid={`badge-selected-${county.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {county}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Export Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Export Format</Label>
                      <RadioGroup
                        value={form.watch("exportFormat")}
                        onValueChange={(value: "csv" | "json") => form.setValue("exportFormat", value)}
                        data-testid="radio-export-format"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="csv" id="csv" data-testid="radio-csv" />
                          <Label htmlFor="csv" className="font-normal cursor-pointer">
                            CSV (PhantomBuster Compatible)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="json" id="json" data-testid="radio-json" />
                          <Label htmlFor="json" className="font-normal cursor-pointer">
                            JSON
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <Label htmlFor="auto-export" className="font-normal cursor-pointer">
                        Auto-export after scraping completes
                      </Label>
                      <Switch
                        id="auto-export"
                        checked={form.watch("autoExport")}
                        onCheckedChange={(checked) => form.setValue("autoExport", checked)}
                        data-testid="switch-auto-export"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Summary</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium">AI Enhancement</span>
                      <span className="text-sm text-muted-foreground">
                        {enableAI ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium">Estimated Time</span>
                      <span className="text-sm text-muted-foreground">
                        {enableAI ? "3-7 minutes" : "2-5 minutes"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium">Estimated Records</span>
                      <span className="text-sm text-muted-foreground">
                        {selectedCounties.length * 10} - {selectedCounties.length * 30}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={step === 1}
              data-testid="button-prev-step"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            {step < 3 ? (
              <Button
                type="button"
                onClick={nextStep}
                data-testid="button-next-step"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={startScrapeMutation.isPending}
                data-testid="button-start-scraping"
              >
                {startScrapeMutation.isPending ? "Starting..." : "Start Scraping"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
