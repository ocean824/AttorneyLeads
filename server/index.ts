import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { loggerMiddleware } from "./middleware/loggerMiddleware";
import { securityHeaders } from "./middleware/securityHeaders";
import { rateLimiter } from "./middleware/rateLimiter";
import { registerDashboardGuard } from "./middleware/protectDashboard";
import { registerObservabilityRoutes } from "./observability";
import { registerAdminRoutes } from "./admin-routes";
import { registerAdminBootstrap } from "./admin-bootstrap";
import { logger } from "./logger";

const app = express();

// Keep rawBody support for webhooks (e.g. Calendly, etc.)
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

// --- Global middlewares (logging, security, rate limiting) ---

app.use(loggerMiddleware);
app.use(securityHeaders);
app.use(rateLimiter);

// --- Observability routes (/healthz, /readyz, /metrics) ---
registerObservabilityRoutes(app);

// --- Main async bootstrap (session + API routes + Vite/static + listener) ---
(async () => {
  try {
    // Setup session before routes
    const { setupSession } = await import('./session');
    setupSession(app);
    
    // Protect /dashboard route (redirect unauthenticated GET requests)
    registerDashboardGuard(app);
    
    // Register admin routes and bootstrap
    registerAdminRoutes(app);
    registerAdminBootstrap(app);
    
    // Register /api routes and get the underlying HTTP server
    const server = await registerRoutes(app);

    // Central error handler – last in the chain
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const code = err.code || "INTERNAL_ERROR";
      const requestId = (req as any).requestId as string | undefined;

      logger.error("unhandled_error", {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: status,
        code,
        errorName: err.name,
        errorMessage: err.message,
      });

      res.status(status).json({
        code,
        message: status === 500 ? "Internal server error" : err.message,
        details: undefined,
        requestId,
      });
    });

    // Vite dev server vs static build
    // (same behavior as before, but moved after middlewares/observability)
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Always serve on PORT (default 5000), host 0.0.0.0 for Replit
    const port = parseInt(process.env.PORT || "5000", 10);
    server.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`serving on port ${port}`);
      },
    );
  } catch (err) {
    logger.error("server_start_failed", {
      errorMessage: (err as Error).message,
    });
    process.exit(1);
  }
})();
