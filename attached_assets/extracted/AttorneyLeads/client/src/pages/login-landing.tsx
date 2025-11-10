
import { FormEvent, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from "@/components/ui/card";

export default function LoginLanding() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/whoami", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => navigate("/dashboard"))
      .catch(() => {});
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Login failed");
      if (j.requires2fa) {
        if (j.adminMustSetup2fa) navigate("/2fa?mode=setup");
        else if (j.methods?.totp) navigate("/2fa");
        else navigate("/2fa-fallback");
      } else {
        if (j.user?.role === "admin") navigate("/admin/users");
        else navigate("/dashboard");
      }
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-white">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-center">Sign in to Attorney Lead Gen</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm mb-1">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="flex justify-between items-center">
              <a className="text-sm underline" href="/forgot">Forgot password?</a>
              {error && <div className="text-sm text-red-600">{error}</div>}
            </div>
            <Button type="submit" disabled={busy} className="w-full" data-testid="button-submit">{busy ? "Signing in…" : "Sign in"}</Button>
          </form>
        </CardContent>
        <CardFooter>
          <div className="w-full text-center text-xs text-muted-foreground">
            Admin? <a href="/login?admin=1" className="underline">Admin login</a>
          </div>
        </CardFooter>
      
  <div className="mt-4 text-center text-xs text-muted-foreground">
    <a href="/login" className="underline hover:no-underline">Admin Login</a>
  </div>
</Card>
    </div>
  );
}
