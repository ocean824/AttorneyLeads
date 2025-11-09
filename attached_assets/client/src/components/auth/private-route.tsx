
import { useEffect, useState } from "react";
import { Redirect } from "wouter";

type WhoAmI = { user: { id: string; email: string; role: "user" | "admin" } };

export function PrivateRoute({ children }: { children: JSX.Element }) {
  const [status, setStatus] = useState<"loading" | "ok" | "nope">("loading");

  useEffect(() => {
    fetch("/api/auth/whoami", { credentials: "include" })
      .then(async (r) => {
        if (r.ok) return r.json();
        throw new Error("unauth");
      })
      .then((_data: WhoAmI) => setStatus("ok"))
      .catch(() => setStatus("nope"));
  }, []);

  if (status === "loading") return <div className="p-6">Checking session…</div>;
  if (status === "nope") return <Redirect to="/login" />;
  return children;
}
