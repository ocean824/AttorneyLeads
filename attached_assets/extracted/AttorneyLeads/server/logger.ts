/**
 * Structured Logger with PII Redaction
 * 
 * Provides JSON-formatted logging with automatic redaction of sensitive data.
 * All logs include timestamp, level, and optional request context.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  route?: string;
  [key: string]: unknown;
}

/**
 * Sensitive keys that should be redacted from logs
 */
const SENSITIVE_KEYS = [
  "password",
  "secret",
  "token",
  "apikey",
  "apiKey",
  "api_key",
  "authorization",
  "auth",
  "key",
  "credentials",
  "email",
  "phone",
  "phoneNumber",
  "ssn",
  "database_url",
  "DATABASE_URL",
];

/**
 * Recursively redact sensitive data from values
 */
function redact(value: unknown): unknown {
  if (typeof value === "string") {
    // Redact long high-entropy strings (likely API keys/tokens)
    if (value.length > 8 && /[A-Za-z0-9]{16,}/.test(value)) {
      return "[REDACTED]";
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const clone: Record<string, unknown> = {};
    
    for (const [k, v] of Object.entries(obj)) {
      // Check if key contains sensitive terms
      if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
        clone[k] = "[REDACTED]";
      } else {
        clone[k] = redact(v);
      }
    }
    return clone;
  }

  return value;
}

/**
 * Core log function - outputs structured JSON
 */
function log(level: LogLevel, message: string, ctx?: LogContext) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(ctx ? redact(ctx) : {}),
  };
  
  // Use console.error for error/warn, console.log for info/debug
  if (level === "error" || level === "warn") {
    console.error(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

/**
 * Structured logger with automatic PII redaction
 */
export const logger = {
  debug: (message: string, ctx?: LogContext) => log("debug", message, ctx),
  info: (message: string, ctx?: LogContext) => log("info", message, ctx),
  warn: (message: string, ctx?: LogContext) => log("warn", message, ctx),
  error: (message: string, ctx?: LogContext) => log("error", message, ctx),
};

/**
 * Example usage:
 * 
 * ```typescript
 * import { logger } from './logger';
 * 
 * logger.info("User logged in", { userId: "123", email: "test@example.com" });
 * // Output: {"level":"info","message":"User logged in","timestamp":"...","userId":"123","email":"[REDACTED]"}
 * 
 * logger.error("Database error", { 
 *   errorMessage: "Connection failed", 
 *   database_url: "postgres://..." 
 * });
 * // Output: {"level":"error","message":"Database error","timestamp":"...","errorMessage":"Connection failed","database_url":"[REDACTED]"}
 * ```
 */
