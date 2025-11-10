
import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
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
        navigate("/2fa");
      } else {
        navigate("/");
      }
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
          <CardTitle>Sign in</CardTitle>
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
            <Button type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
