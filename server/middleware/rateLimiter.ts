/**
 * Rate Limiting Middleware
 * 
 * In-memory rate limiter based on IP address and route.
 * For production multi-node deployments, replace with Redis or similar.
 */

import type { Request, Response, NextFunction } from "express";
import { routeRateLimits, type RateLimitConfig } from "../../config/rateLimits";

type BucketKey = string;

interface BucketState {
  count: number;
  windowStart: number;
}

// In-memory storage of rate limit buckets
const buckets = new Map<BucketKey, BucketState>();

/**
 * Create a route key for rate limit lookup
 */
function makeRouteKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/**
 * Get rate limit config for a route, falling back to DEFAULT
 */
function getConfig(method: string, path: string): RateLimitConfig {
  const key = makeRouteKey(method, path);
  
  if (routeRateLimits[key]) {
    return routeRateLimits[key];
  }
  
  // Check for wildcard patterns
  // e.g., "GET /api/records/:id" matches "GET /api/records/*"
  const wildcardKey = key.replace(/\/[^/]+$/, "/*");
  if (routeRateLimits[wildcardKey]) {
    return routeRateLimits[wildcardKey];
  }
  
  return routeRateLimits.DEFAULT;
}

/**
 * Extract client IP from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  
  return req.ip || "unknown";
}

/**
 * Clean up old buckets to prevent memory leak
 * Runs periodically to remove expired windows
 */
function cleanupBuckets() {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour
  
  for (const [key, state] of buckets.entries()) {
    if (now - state.windowStart > maxAge) {
      buckets.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupBuckets, 5 * 60 * 1000);

/**
 * Rate limiting middleware
 * 
 * Uses sliding window algorithm based on IP + route
 * Returns 429 Too Many Requests when limit exceeded
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const ip = getClientIp(req);
  const config = getConfig(req.method, req.path);
  
  // Create unique bucket key
  const bucketKey: BucketKey = `${ip}:${req.method}:${req.path}`;
  const existing = buckets.get(bucketKey);

  // First request in window
  if (!existing) {
    buckets.set(bucketKey, { count: 1, windowStart: now });
    return next();
  }

  // Window has expired, reset
  if (now - existing.windowStart > config.windowMs) {
    existing.count = 1;
    existing.windowStart = now;
    buckets.set(bucketKey, existing);
    return next();
  }

  // Within window, check limit
  if (existing.count >= config.max) {
    const retryAfterSeconds = Math.ceil(
      (existing.windowStart + config.windowMs - now) / 1000
    );
    
    res.setHeader("Retry-After", retryAfterSeconds.toString());
    res.setHeader("X-RateLimit-Limit", config.max.toString());
    res.setHeader("X-RateLimit-Remaining", "0");
    res.setHeader("X-RateLimit-Reset", new Date(existing.windowStart + config.windowMs).toISOString());
    
    return res.status(429).json({
      code: "RATE_LIMITED",
      message: "Too many requests, please slow down.",
      retryAfterSeconds,
    });
  }

  // Increment and allow
  existing.count += 1;
  buckets.set(bucketKey, existing);
  
  // Add rate limit headers
  res.setHeader("X-RateLimit-Limit", config.max.toString());
  res.setHeader("X-RateLimit-Remaining", (config.max - existing.count).toString());
  res.setHeader("X-RateLimit-Reset", new Date(existing.windowStart + config.windowMs).toISOString());
  
  return next();
}

/**
 * Note: This is an in-memory implementation suitable for single-node deployments.
 * For production with multiple nodes, use:
 * - Redis-backed rate limiting (e.g., rate-limit-redis)
 * - Postgres-backed counters
 * - API Gateway rate limiting
 */
