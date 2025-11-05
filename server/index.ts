import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { loggerMiddleware } from "./middleware/loggerMiddleware";
import { securityHeaders } from "./middleware/securityHeaders";
import { rateLimiter } from "./middleware/rateLimiter";
import { registerObservabilityRoutes } from "./observability";
import { logger } from "./logger";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Body parsing middleware
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Observability & security middleware (applied to all routes)
app.use(loggerMiddleware);
app.use(securityHeaders);
app.use(rateLimiter);

(async () => {
  // Register observability routes first (no auth required)
  registerObservabilityRoutes(app);
  
  // Register application routes
  const server = await registerRoutes(app);

  // Global error handler
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error with context
    logger.error("unhandled_error", {
      requestId: req.requestId,
      path: req.path,
      method: req.method,
      status,
      errorMessage: message,
      stack: err.stack,
    });

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
