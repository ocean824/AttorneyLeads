import { Link, useLocation } from "wouter";
import { Scale, Database, Activity, FileText, Copy, BarChart3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function Header() {
  const [me, setMe] = useState<{ email: string; role: "user" | "admin" } | null>(null);
  useEffect(() => {
    fetch("/api/auth/whoami", { credentials: "include" })
      .then(async (r) => (r.ok ? (await r.json()).user : null))
      .then((u) => setMe(u))
      .catch(() => setMe(null));
  }, []);

  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Dashboard", icon: Activity },
    { path: "/records", label: "Records", icon: Database },
    { path: "/jobs", label: "Jobs", icon: FileText },
    { path: "/duplicates", label: "Duplicates", icon: Copy },
    { path: "/analytics", label: "Analytics", icon: BarChart3 },
    { path: "/crm", label: "CRM", icon: Users },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo & Brand */}
        <Link href="/">
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
              {me.role === "admin" && (
                <Link href="/admin/users">
                  <Button variant="outline" className="mr-2">Admin</Button>
                </Link>
              )}
              <span className="text-sm mr-2">{me.email}</span>
              <Button
                variant="secondary"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                  window.location.href = "/login";
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button>Login</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
