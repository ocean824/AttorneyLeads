import { useState } from "react";
import { ShieldCheck, Search, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type VerificationResponse = {
  subject: string;
  summary: string;
  fieldChecks?: Record<string, { claimed: string; verified: boolean; confidence: number; source: string }>;
  usernameResults?: Array<{ platform: string; claimed: string; verified: boolean; confidence: number; url: string }>;
  tracers?: { enabled?: boolean; matches?: Array<Record<string, unknown>>; error?: string };
  crawl?: { url: string; title: string; excerpt: string };
};

export default function PublicInfoVerifierPage() {
  const [form, setForm] = useState({
    subject: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    username: "",
  });
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [crawlResult, setCrawlResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitVerify() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/public-info/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitCrawl() {
    if (!form.website) {
      setError("Website is required for crawl.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/public-info/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: form.website, depth: 1, maxPages: 8 }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Crawl failed");
      }
      setCrawlResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Crawl failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Public Info Verifier</h1>
        <p className="text-muted-foreground mt-2">
          Verify collected public information against a controlled crawl, optional Tracers lookup, and public username presence checks.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verification inputs</CardTitle>
          <CardDescription>Enter the lead details you want the app to verify.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          {[
            ["subject", "Subject / lead label"],
            ["name", "Full name"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["website", "Website"],
            ["username", "Public username"],
          ].map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                value={(form as any)[key]}
                onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={form.address}
              onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
            />
          </div>
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <Button onClick={submitVerify} disabled={loading} className="gap-2">
              <ShieldCheck className="w-4 h-4" />
              {loading ? "Running verification..." : "Verify public info"}
            </Button>
            <Button variant="outline" onClick={submitCrawl} disabled={loading} className="gap-2">
              <Globe className="w-4 h-4" />
              Crawl website
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Search className="w-4 h-4" /> Verification result</CardTitle>
            <CardDescription>{result.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {result.fieldChecks ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Field checks</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {Object.entries(result.fieldChecks).map(([field, value]) => (
                    <Card key={field}>
                      <CardContent className="p-4 space-y-1">
                        <p className="font-medium capitalize">{field}</p>
                        <p className="text-sm text-muted-foreground">Claimed: {value.claimed}</p>
                        <p className="text-sm">Verified: {value.verified ? "Yes" : "No"}</p>
                        <p className="text-sm">Confidence: {Math.round((value.confidence ?? 0) * 100)}%</p>
                        <p className="text-xs text-muted-foreground break-all">Source: {value.source}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null}

            {result.usernameResults?.length ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Username results</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {result.usernameResults.map((item) => (
                    <Card key={`${item.platform}-${item.url}`}>
                      <CardContent className="p-4 space-y-1">
                        <p className="font-medium">{item.platform}</p>
                        <p className="text-sm">Verified: {item.verified ? "Yes" : "No"}</p>
                        <p className="text-sm">Confidence: {Math.round((item.confidence ?? 0) * 100)}%</p>
                        <a className="text-xs text-primary break-all" href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Tracers</h2>
              <Card>
                <CardContent className="p-4">
                  <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result.tracers ?? {}, null, 2)}</pre>
                </CardContent>
              </Card>
            </div>

            {result.crawl ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Primary crawl</h2>
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <p className="font-medium">{result.crawl.title}</p>
                    <a className="text-xs text-primary break-all" href={result.crawl.url} target="_blank" rel="noreferrer">{result.crawl.url}</a>
                    <p className="text-sm text-muted-foreground">{result.crawl.excerpt}</p>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {crawlResult ? (
        <Card>
          <CardHeader>
            <CardTitle>Deep crawl pages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(crawlResult, null, 2)}</pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
