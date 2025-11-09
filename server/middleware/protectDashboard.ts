
import type { Express, Request, Response, NextFunction } from "express";

export function registerDashboardGuard(app: Express) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isHtml = (req.headers["accept"] || "").toString().includes("text/html");
    if (req.method === "GET" && isHtml && req.path.startsWith("/dashboard")) {
      const loggedIn = !!(req.session as any)?.user;
      if (!loggedIn) {
        return res.redirect(302, "/login");
      }
    }
    next();
  });
}
