/**
 * Rate Limiting Configuration
 * 
 * Defines rate limits for API endpoints to prevent abuse and ensure
 * fair usage. Limits are expressed in requests per time window.
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

/**
 * Rate limit presets
 */
export const rateLimitPresets = {
  /**
   * Strict rate limit for expensive operations
   * 10 requests per 15 minutes
   */
  strict: {
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many requests, please try again later",
  } as RateLimitConfig,

  /**
   * Moderate rate limit for normal API usage
   * 100 requests per 15 minutes
   */
  moderate: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please slow down",
  } as RateLimitConfig,

  /**
   * Lenient rate limit for read-only operations
   * 300 requests per 15 minutes
   */
  lenient: {
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: "Too many requests, please try again in a few minutes",
  } as RateLimitConfig,

  /**
   * Very strict for authentication attempts
   * 5 requests per hour
   */
  auth: {
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: "Too many login attempts, please try again later",
    skipSuccessfulRequests: true, // Only count failed attempts
  } as RateLimitConfig,
};

/**
 * Route-specific rate limits
 */
export const routeRateLimits: Record<string, RateLimitConfig> = {
  // Scraping (expensive operations)
  "/api/scrape/start": {
    ...rateLimitPresets.strict,
    max: 20, // 20 scrapes per 15 minutes
    message: "You can only start 20 scrape jobs per 15 minutes",
  },

  // Read-only polling endpoints (lenient)
  "/api/scrape/jobs": {
    ...rateLimitPresets.lenient,
    max: 500, // 500 requests per 15 minutes (frontend polls this)
  },

  "/api/stats": {
    ...rateLimitPresets.lenient,
    max: 500, // 500 requests per 15 minutes (dashboard polls this)
  },

  "/api/duplicates/scan": {
    ...rateLimitPresets.strict,
    max: 5, // 5 scans per 15 minutes
    message: "You can only scan for duplicates 5 times per 15 minutes",
  },

  // AI operations (rate limited by OpenAI but we add our own too)
  "/api/ai/test": {
    ...rateLimitPresets.moderate,
    max: 20,
  },

  // CRM Discovery (expensive PhantomBuster operations)
  "/api/crm/discover": {
    ...rateLimitPresets.strict,
    max: 10, // 10 discovery jobs per 15 minutes
    message: "You can only launch 10 prospect discovery jobs per 15 minutes",
  },

  // Outreach (prevent spam)
  "/api/crm/outreach/send": {
    ...rateLimitPresets.strict,
    max: 50, // 50 emails per 15 minutes
    message: "You can only send 50 outreach emails per 15 minutes",
  },

  // Meetings (moderate limit)
  "/api/crm/meetings/schedule": {
    ...rateLimitPresets.moderate,
    max: 30,
  },

  // Sheets sync (moderate limit)
  "/api/crm/sheets/sync-prospects": {
    ...rateLimitPresets.moderate,
    max: 10,
    message: "You can only sync to Google Sheets 10 times per 15 minutes",
  },

  "/api/crm/sheets/sync-records": {
    ...rateLimitPresets.moderate,
    max: 10,
    message: "You can only sync to Google Sheets 10 times per 15 minutes",
  },

  // Bulk export (moderate limit)
  "/api/records/bulk-export": {
    ...rateLimitPresets.moderate,
    max: 20,
  },

  // Record deletion (moderate limit to prevent accidents)
  "/api/records/:id": {
    ...rateLimitPresets.moderate,
    max: 50,
  },

  // Duplicate merge (moderate limit)
  "/api/duplicates/:id/merge": {
    ...rateLimitPresets.moderate,
    max: 100, // Allow many merges but prevent abuse
  },
};

/**
 * Global API rate limit (fallback for all routes)
 */
export const globalRateLimit: RateLimitConfig = {
  ...rateLimitPresets.lenient,
  max: 500, // 500 requests per 15 minutes for all endpoints combined
  message: "Too many API requests, please slow down",
};

/**
 * Get rate limit config for a specific route
 * Returns both the config and the matched pattern for bucket keying
 */
export function getRateLimitForRoute(route: string): { config: RateLimitConfig; pattern: string } {
  // Check for exact match first
  if (routeRateLimits[route]) {
    return { config: routeRateLimits[route], pattern: route };
  }

  // Check for parameterized routes (e.g., /api/records/:id)
  for (const [pattern, config] of Object.entries(routeRateLimits)) {
    if (matchRoute(pattern, route)) {
      return { config, pattern };
    }
  }

  // Default to moderate preset with generic pattern
  return { config: rateLimitPresets.moderate, pattern: route };
}

/**
 * Simple route matching for parameterized routes
 */
function matchRoute(pattern: string, route: string): boolean {
  const patternParts = pattern.split('/');
  const routeParts = route.split('/');

  if (patternParts.length !== routeParts.length) {
    return false;
  }

  return patternParts.every((part, i) => {
    if (part.startsWith(':')) return true; // Parameter match
    return part === routeParts[i];
  });
}

/**
 * Example usage with express-rate-limit:
 * 
 * ```typescript
 * import rateLimit from 'express-rate-limit';
 * import { globalRateLimit, routeRateLimits } from '@/config/rateLimits';
 * 
 * // Apply global rate limit to all API routes
 * app.use('/api/', rateLimit(globalRateLimit));
 * 
 * // Apply specific rate limit to scrape endpoint
 * app.post('/api/scrape/start', rateLimit(routeRateLimits['/api/scrape/start']), async (req, res) => {
 *   // Handler
 * });
 * ```
 * 
 * Recommended: Install express-rate-limit:
 * ```bash
 * npm install express-rate-limit
 * ```
 */
