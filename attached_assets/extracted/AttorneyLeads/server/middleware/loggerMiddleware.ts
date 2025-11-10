/**
 * HTTP Request Logging Middleware
 * 
 * Logs all HTTP requests with timing, status codes, and request IDs.
 * Adds X-Request-Id header for request tracing.
 */

import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { logger } from "../logger";

// Extend Express Request type to include requestId
declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
  }
}

/**
 * Request logging middleware
 * 
 * - Assigns unique request ID (from header or generates new UUID)
 * - Logs request method, path, status, and duration
 * - Adds X-Request-Id to response headers for tracing
 */
export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
  // Use existing request ID or generate new one
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const start = Date.now();

  // Log when response finishes
  res.on("finish", () => {
    const duration = Date.now() - start;
    
    // Only log non-static asset requests
    if (!req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      logger.info("http_request", {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
        userAgent: req.headers["user-agent"],
      });
    }
  });

  next();
}
