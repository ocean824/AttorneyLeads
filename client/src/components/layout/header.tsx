import { Link, useLocation } from "wouter";
import { Scale, Database, Activity, FileText, Copy, BarChart3, Users, Bot, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function Header() {
  const [me, setMe] = useState<{ email: string; role: "user" | "admin" } | null>(null);
  const [location] = useLocation();

  useEffect(() => {
    fetch("/api/auth/whoami", { credentials: "include" })
      .then(async (r) => (r.ok ? (await r.json()).user : null))
      .then((u) => setMe(u))
      .catch(() => setMe(null));
  }, [location]);

  // Hide header entirely on landing when user is not logged in
  if (!me && (location === "/" || location === "/login")) {
    return null;
  }

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: Activity },
    { path: "/records", label: "Records", icon: Database },
    { path: "/jobs", label: "Jobs", icon: FileText },
    { path: "/duplicates", label: "Duplicates", icon: Copy },
    { path: "/analytics", label: "Analytics", icon: BarChart3 },
    { path: "/crm", label: "CRM", icon: Users },
    ...(me?.role === "admin" ? [{ path: "/admin/tools/agent", label: "Agent", icon: Bot }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo & Brand */}
        <Link href="/dashboard">
          <div className="flex items-center gap-2 hover-elevate active-elevate-2 px-3 py-2 rounded-md -ml-3 cursor-pointer">
            <Scale className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
              Attorney Leads
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location === path;
            return (
              <Link key={path} href={path}>
                <Button
                  variant="ghost"
                  className={cn(
                    "gap-2",
                    isActive && "bg-accent text-accent-foreground"
                  )}
                  data-testid={`link-${label.toLowerCase()}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Button>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          {me ? (
            <>
              <Link href="/billing">
                <Button variant="ghost" className="gap-2" data-testid="link-billing">
                  <CreditCard className="w-4 h-4" />
                  Billing
                </Button>
              </Link>
              <Link href="/account/security">
                <Button variant="outline" data-testid="link-account">Account</Button>
              </Link>
              {me.role === "admin" && (
                <Link href="/admin/users">
                  <Button variant="outline">Admin</Button>
                </Link>
              )}
              <span className="text-sm mr-2">{me.email}</span>
              <Button
                variant="secondary"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                  window.location.href = "/";
                }}
                data-testid="button-logout"
              >
                Logout
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button data-testid="button-login">Login</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
