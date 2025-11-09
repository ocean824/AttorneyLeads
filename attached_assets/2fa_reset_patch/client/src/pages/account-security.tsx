
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrivateRoute } from "@/components/auth/private-route";

export default function AccountSecurity() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ qrImageUrl: string; secretBase32: string; otpauthURI: string } | null>(null);
  const [token, setToken] = useState("");

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

  return (
    <PrivateRoute>
      <div className="p-6">
        <Card className="max-w-xl">
          <CardHeader><CardTitle>Account Security</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Two‑Factor Authentication (TOTP)</div>
                <div className="text-sm text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</div>
              </div>
              {enabled ? (
                <Button variant="outline" onClick={disable}>Disable</Button>
              ) : (
                <Button onClick={start}>Enable</Button>
              )}
            </div>

            {!enabled && setup && (
              <div className="space-y-3">
                <div className="text-sm">Scan this QR in Google Authenticator, 1Password, or Authy, then enter a code:</div>
                <img src={setup.qrImageUrl} alt="TOTP QR" className="border rounded p-2 w-64 h-64" />
                <div className="text-xs break-all">Or manually enter secret: <b>{setup.secretBase32}</b></div>
                <div className="flex gap-2">
                  <input className="border rounded px-2 py-1 flex-1" placeholder="6-digit code" value={token} onChange={(e) => setToken(e.target.value)} />
                  <Button onClick={verify}>Verify</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PrivateRoute>
  );
}
