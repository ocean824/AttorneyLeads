
import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function TwoFA() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/totp/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Invalid code");
      }
      
      // If user wants to trust this device, register it
      if (trustDevice) {
        try {
          const deviceLabel = `${navigator.platform || "Unknown"} - ${new Date().toLocaleDateString()}`;
          await fetch("/api/auth/trusted-devices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ label: deviceLabel }),
          });
        } catch (err) {
          // Don't block login if device trust fails
          console.error("Failed to trust device:", err);
        }
      }
      
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Two‑Factor Authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">6‑digit code</label>
              <Input 
                inputMode="numeric" 
                pattern="[0-9]*" 
                value={token} 
                onChange={(e) => setToken(e.target.value)} 
                required 
                data-testid="input-totp-code"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="trust-device" 
                checked={trustDevice}
                onCheckedChange={(checked) => setTrustDevice(checked === true)}
                data-testid="checkbox-trust-device"
              />
              <Label htmlFor="trust-device" className="text-sm cursor-pointer">
                Trust this device for 30 days
              </Label>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button 
              type="submit" 
              disabled={busy} 
              className="w-full"
              data-testid="button-verify"
            >
              {busy ? "Verifying…" : "Verify"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
