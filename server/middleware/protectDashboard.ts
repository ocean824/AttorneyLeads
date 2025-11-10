
import type { Express, Request, Response, NextFunction } from "express";

export function registerDashboardGuard(app: Express) {
  // Any HTML navigation into these prefixes requires an authenticated session
  const PROTECTED_PREFIXES = ["/dashboard", "/crm", "/records", "/jobs", "/duplicates", "/analytics", "/admin"];

  app.use((req: Request, res: Response, next: NextFunction) => {
    const isHtml = (req.headers["accept"] || "").toString().includes("text/html");
    if (req.method === "GET" && isHtml && PROTECTED_PREFIXES.some(p => req.path.startsWith(p))) {
      const loggedIn = !!(req.session as any)?.user;
      if (!loggedIn) {
        // Landing page at "/" contains the login panel
        return res.redirect(302, "/");
      }
    }
    next();
  });
}
