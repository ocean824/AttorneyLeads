
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrivateRoute } from "@/components/auth/private-route";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Download, Smartphone } from "lucide-react";

export default function AccountSecurity() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ qrImageUrl: string; secretBase32: string; otpauthURI: string } | null>(null);
  const [token, setToken] = useState("");
  const [phone, setPhone] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);

  async function loadStatus() {
    const res = await fetch("/api/auth/totp/status", { method: "POST", credentials: "include" });
    if (res.ok) {
      const j = await res.json();
      setEnabled(!!j.enabled);
    }
  }
  useEffect(() => { loadStatus(); }, []);

  async function start() {
    const res = await fetch("/api/auth/totp/setup/start", { method: "POST", credentials: "include" });
    if (res.ok) setSetup(await res.json());
  }
  async function verify() {
    const res = await fetch("/api/auth/totp/setup/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      setSetup(null);
      setToken("");
      setEnabled(true);
    }
  }
  async function disable() {
    const pwd = prompt("Confirm your password to disable 2FA");
    if (!pwd) return;
    const res = await fetch("/api/auth/totp/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password: pwd }),
    });
    if (res.ok) setEnabled(false);
  }

  async function savePhone() {
    const r = await fetch("/api/account/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phone }),
    });
    if (!r.ok) alert("Invalid phone");
  }

  async function generateCodes() {
    const r = await fetch("/api/auth/backup-codes/generate", {
      method: "POST",
      credentials: "include",
    });
    if (r.ok) {
      const j = await r.json();
      setCodes(j.codes);
    }
  }

  async function downloadPDF() {
    if (!codes || codes.length === 0) {
      alert("Please generate backup codes first");
      return;
    }
    
    try {
      const r = await fetch("/api/auth/backup-codes/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ codes }),
      });
      
      if (!r.ok) {
        alert("Failed to generate PDF");
        return;
      }
      
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-codes-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download PDF:", err);
      alert("Failed to download PDF");
    }
  }

  return (
    <PrivateRoute>
      <div className="p-6 space-y-6 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Two‑Factor Authentication (TOTP)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</div>
            {enabled ? (
              <Button variant="outline" onClick={disable}>Disable</Button>
            ) : (
              <Button onClick={start}>Enable</Button>
            )}
            {!enabled && setup && (
              <div className="space-y-3">
                <img src={setup.qrImageUrl} alt="TOTP QR" className="border rounded p-2 w-64 h-64" />
                <div className="text-xs break-all">Secret: <b>{setup.secretBase32}</b></div>
                <div className="flex gap-2">
                  <Input placeholder="6-digit code" value={token} onChange={(e) => setToken(e.target.value)} />
                  <Button onClick={verify}>Verify</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Fallback Contact</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">Add a phone number for SMS codes (optional).</div>
            <div className="flex gap-2">
              <Input placeholder="+1 555 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Button onClick={savePhone}>Save</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Backup Codes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">Generate one-time codes to use if you lose your device.</div>
            <div className="flex gap-2">
              <Button onClick={generateCodes} data-testid="button-generate-codes">Generate / Regenerate</Button>
              {codes && codes.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={downloadPDF}
                  data-testid="button-download-pdf"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              )}
            </div>
            {codes && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {codes.map((c) => (
                  <code key={c} className="border rounded px-2 py-1">{c}</code>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Trusted Devices</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Manage devices that can skip 2FA verification for 30 days.
            </div>
            <Link href="/account/devices">
              <Button variant="outline" data-testid="link-manage-devices">
                <Smartphone className="mr-2 h-4 w-4" />
                Manage Devices
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </PrivateRoute>
  );
}
