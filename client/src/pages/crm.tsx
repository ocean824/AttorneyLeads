import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  Send, 
  Calendar, 
  FileSpreadsheet, 
  Search, 
  Plus,
  Mail,
  Phone,
  Building2,
  Linkedin,
  Loader2,
} from "lucide-react";
import type { CrmProspect, ScheduledMeeting } from "@shared/schema";

export default function CRMPage() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("prospects");

  // Lead Generation Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    company: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  // Prospect Discovery State
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("Florida");

  // Google Sheets Sync State
  const [spreadsheetId, setSpreadsheetId] = useState("");

  // Fetch Prospects
  const { data: prospects = [], isLoading: prospectsLoading } = useQuery<CrmProspect[]>({
    queryKey: ["/api/crm/prospects"],
  });

  // Fetch Meetings
  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<ScheduledMeeting[]>({
    queryKey: ["/api/crm/meetings"],
  });

  // Submit Lead Form
  const submitLeadMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("/api/crm/outreach/send", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Success!",
        description: "Thank you! We'll be in touch shortly.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospects"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit form. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Discover Prospects
  const discoverProspectsMutation = useMutation({
    mutationFn: async (params: { searchQuery: string; location: string }) => {
      return await apiRequest("/api/crm/discover", {
        method: "POST",
        body: JSON.stringify({ ...params, platform: "linkedin" }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Prospect Discovery Started",
        description: `Discovering prospects... This will take ${data.estimatedTime}`,
      });
      // Poll for results
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/prospects"] });
      }, 8000);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start prospect discovery",
        variant: "destructive",
      });
    },
  });

  // Sync to Google Sheets
  const syncSheetsMutation = useMutation({
    mutationFn: async (params: { spreadsheetId: string; type: "prospects" | "records" }) => {
      const endpoint = params.type === "prospects" 
        ? "/api/crm/sheets/sync-prospects"
        : "/api/crm/sheets/sync-records";
      return await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({ spreadsheetId: params.spreadsheetId }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sync Successful",
        description: `Added ${data.rowsAdded} rows to Google Sheets`,
      });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync data to Google Sheets",
        variant: "destructive",
      });
    },
  });

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitLeadMutation.mutate(formData);
  };

  const handleDiscoverProspects = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Error",
        description: "Please enter a search query",
        variant: "destructive",
      });
      return;
    }
    discoverProspectsMutation.mutate({ searchQuery, location });
  };

  const handleSheetsSync = (type: "prospects" | "records") => {
    if (!spreadsheetId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Google Sheets ID",
        variant: "destructive",
      });
      return;
    }
    syncSheetsMutation.mutate({ spreadsheetId, type });
  };

  // --- Quick Discover (saved defaults) helpers ---
  const DEFAULTS_KEY = "crmDiscoverDefaults";

  type DiscoverDefaults = { searchQuery: string; location: string };

  const getDiscoverDefaults = (): DiscoverDefaults => {
    try {
      const raw = localStorage.getItem(DEFAULTS_KEY);
      if (raw) return JSON.parse(raw) as DiscoverDefaults;
    } catch {}
    // Safe fallback if nothing saved yet
    return { searchQuery: "Personal Injury law firms", location: "Florida" };
  };

  const handleSaveDefaults = () => {
    // Save whatever is currently typed into the inputs as the defaults
    const payload: DiscoverDefaults = { searchQuery, location };
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(payload));
    toast({ title: "Saved", description: "Defaults updated for quick discover." });
  };

  const handleQuickDiscover = () => {
    // Prevent concurrent executions
    if (discoverProspectsMutation.isPending) return;
    
    const { searchQuery: q, location: loc } = getDiscoverDefaults();
    if (!q.trim()) {
      toast({
        title: "Error",
        description: "No saved defaults. Please save search query first.",
        variant: "destructive",
      });
      return;
    }
    
    // Use the existing mutation which already handles async flow and toasts
    discoverProspectsMutation.mutate({ searchQuery: q, location: loc });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-500",
      contacted: "bg-yellow-500",
      qualified: "bg-purple-500",
      converted: "bg-green-500",
      rejected: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">CRM & Lead Generation</h1>
        <p className="text-muted-foreground">
          Manage prospects, automate outreach, and integrate with external tools
        </p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="prospects" data-testid="tab-prospects">
            <Users className="h-4 w-4 mr-2" />
            Prospects
          </TabsTrigger>
          <TabsTrigger value="lead-form" data-testid="tab-lead-form">
            <Send className="h-4 w-4 mr-2" />
            Lead Form
          </TabsTrigger>
          <TabsTrigger value="discovery" data-testid="tab-discovery">
            <Search className="h-4 w-4 mr-2" />
            Discovery
          </TabsTrigger>
          <TabsTrigger value="meetings" data-testid="tab-meetings">
            <Calendar className="h-4 w-4 mr-2" />
            Meetings
          </TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* Prospects Tab */}
        <TabsContent value="prospects">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Prospect Database</CardTitle>
                  <CardDescription>{prospects.length} total prospects</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleQuickDiscover}
                    disabled={discoverProspectsMutation.isPending}
                    data-testid="button-quick-discover"
                  >
                    {discoverProspectsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Fetching…
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Discover
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {prospectsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : prospects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No prospects yet. Use the Discovery tab or Lead Form to add prospects.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {prospects.map((prospect) => (
                    <Card key={prospect.id} className="hover-elevate" data-testid={`prospect-card-${prospect.id}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{prospect.fullName}</h3>
                              <Badge className={getStatusColor(prospect.status)}>
                                {prospect.status}
                              </Badge>
                              <Badge variant="outline">{prospect.source}</Badge>
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              {prospect.email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4" />
                                  {prospect.email}
                                </div>
                              )}
                              {prospect.company && (
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4" />
                                  {prospect.company}
                                </div>
                              )}
                              {prospect.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4" />
                                  {prospect.phone}
                                </div>
                              )}
                              {prospect.linkedinUrl && (
                                <div className="flex items-center gap-2">
                                  <Linkedin className="h-4 w-4" />
                                  <a
                                    href={prospect.linkedinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    LinkedIn Profile
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lead Generation Form Tab */}
        <TabsContent value="lead-form">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Lead Generation Form</CardTitle>
                <CardDescription>
                  Capture leads from your website or landing page
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submitted ? (
                  <div className="text-center py-8">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <h2 className="text-2xl font-semibold text-green-700 mb-2">Thank You!</h2>
                      <p className="text-green-600">We'll be in touch shortly.</p>
                      <Button
                        onClick={() => setSubmitted(false)}
                        variant="outline"
                        className="mt-4"
                        data-testid="button-submit-another"
                      >
                        Submit Another
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        required
                        value={formData.fullName}
                        onChange={handleFormChange}
                        data-testid="input-fullname"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={handleFormChange}
                        data-testid="input-email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={handleFormChange}
                        data-testid="input-company"
                      />
                    </div>
                    <div>
                      <Label htmlFor="message">Message (Optional)</Label>
                      <Input
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleFormChange}
                        data-testid="input-message"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={submitLeadMutation.isPending}
                      className="w-full"
                      data-testid="button-submit-lead"
                    >
                      {submitLeadMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Submit & Get Info"
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Prospect Discovery Tab */}
        <TabsContent value="discovery">
          <Card>
            <CardHeader>
              <CardTitle>PhantomBuster Prospect Discovery</CardTitle>
              <CardDescription>
                Automatically discover law firm prospects on LinkedIn
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="searchQuery">Search Query</Label>
                <Input
                  id="searchQuery"
                  placeholder="e.g., personal injury lawyer, criminal defense attorney"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-query"
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., Florida, Miami"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  data-testid="input-location"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleDiscoverProspects}
                  disabled={discoverProspectsMutation.isPending}
                  data-testid="button-discover-prospects"
                >
                  {discoverProspectsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Discovering...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Discover Prospects
                    </>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveDefaults}
                  data-testid="button-save-discover-defaults"
                  title="Save current search query + location as defaults for the Quick Discover button"
                >
                  Save as default
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Meetings</CardTitle>
              <CardDescription>
                {meetings.length} upcoming meetings via Calendly
              </CardDescription>
            </CardHeader>
            <CardContent>
              {meetingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : meetings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No scheduled meetings yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {meetings.map((meeting) => (
                    <Card key={meeting.id} className="hover-elevate" data-testid={`meeting-card-${meeting.id}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{meeting.prospectName}</h3>
                              <Badge>{meeting.meetingType}</Badge>
                              <Badge variant="outline">{meeting.status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{meeting.prospectEmail}</p>
                            <p className="text-sm">
                              <Calendar className="h-4 w-4 inline mr-2" />
                              {new Date(meeting.scheduledAt).toLocaleString()}
                            </p>
                            {meeting.meetingUrl && (
                              <a
                                href={meeting.meetingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline"
                              >
                                Join Meeting
                              </a>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Google Sheets Sync</CardTitle>
                <CardDescription>
                  Export prospects and arrest records to Google Sheets
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="spreadsheetId">Google Sheets ID</Label>
                  <Input
                    id="spreadsheetId"
                    placeholder="Paste spreadsheet ID from URL"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    data-testid="input-spreadsheet-id"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Find this in the URL: docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSheetsSync("prospects")}
                    disabled={syncSheetsMutation.isPending}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-sync-prospects"
                  >
                    {syncSheetsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                    )}
                    Sync Prospects
                  </Button>
                  <Button
                    onClick={() => handleSheetsSync("records")}
                    disabled={syncSheetsMutation.isPending}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-sync-records"
                  >
                    {syncSheetsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                    )}
                    Sync Records
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Calendly Integration</CardTitle>
                <CardDescription>
                  Automate meeting scheduling with prospects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Calendly integration is active. Meetings are automatically tracked when prospects schedule via your Calendly link.
                </p>
                <Button variant="outline" asChild data-testid="button-calendly-settings">
                  <a href="https://calendly.com" target="_blank" rel="noopener noreferrer">
                    <Calendar className="h-4 w-4 mr-2" />
                    Open Calendly Settings
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
