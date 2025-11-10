
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

type LoginMeta = {
  requires2fa: true;
  methods: { totp: boolean; backup: boolean; fallback: { email: boolean; sms: boolean } };
  adminMustSetup2fa?: boolean;
  destinations?: { email?: string; phone?: string | null };
};

export default function Fallback2FA() {
  const [, navigate] = useLocation();
  const [sending, setSending] = useState<"email" | "sms" | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function send(channel: "email" | "sms") {
    setSending(channel);
    setError(null);
    try {
      const r = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channel }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to send code");
      setSentTo(j.to || channel);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(null);
    }
  }

  async function verify() {
    setError(null);
    const r = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error || "Invalid code");
    navigate("/");
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Verify your sign-in</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button disabled={!!sending} onClick={() => send("email")}>Send Email Code</Button>
            <Button variant="outline" disabled={!!sending} onClick={() => send("sms")}>Send SMS Code</Button>
          </div>
          {sentTo && <div className="text-sm text-muted-foreground">Code sent to {sentTo}</div>}
          <div className="flex gap-2">
            <Input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button onClick={verify}>Verify</Button>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="text-xs text-muted-foreground">Tip: You can also use a backup code.</div>
        </CardContent>
      </Card>
    </div>
  );
}
