import type { Express, Request, Response, NextFunction } from "express";

export function registerDashboardGuard(app: Express) {
  const PROTECTED_PREFIXES = ["/dashboard", "/crm", "/records", "/jobs", "/duplicates", "/analytics", "/admin", "/account"];
  
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Only guard GET requests
    if (req.method !== "GET") return next();
    
    // Normalize path to lowercase for case-insensitive matching
    const normalizedPath = req.path.toLowerCase();
    
    // Check if path starts with any protected prefix
    const isProtectedRoute = PROTECTED_PREFIXES.some(p => normalizedPath.startsWith(p));
    if (!isProtectedRoute) return next();
    
    // Allow API routes to pass through (they have their own auth middleware)
    if (normalizedPath.startsWith("/api/")) return next();
    
    // For all other protected routes, require authentication
    // Don't check Accept header - always redirect unauthenticated requests
    const loggedIn = Boolean((req.session as any)?.user);
    if (!loggedIn) {
      return res.redirect(302, "/");
    }
    
    next();
  });
}
