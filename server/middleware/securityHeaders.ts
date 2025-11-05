/**
 * Security Headers Middleware
 * 
 * Applies security headers to all HTTP responses to protect against
 * common web vulnerabilities (clickjacking, XSS, MIME sniffing, etc.)
 */

import type { Request, Response, NextFunction } from "express";

/**
 * Security headers middleware
 * 
 * Headers applied:
 * - X-Frame-Options: Prevents clickjacking
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - Referrer-Policy: Controls referrer information
 * - Cross-Origin-Opener-Policy: Isolates browsing context
 * - Cross-Origin-Embedder-Policy: Requires CORP for cross-origin resources
 * - Content-Security-Policy: Restricts resource loading
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Cross-Origin policies for isolation
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  
  // Content Security Policy (CSP)
  // Note: Adjust based on your frontend requirements
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // unsafe-inline needed for Vite dev
    "style-src 'self' 'unsafe-inline'",  // unsafe-inline for inline styles
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://*.replit.com https://*.replit.dev",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  
  res.setHeader("Content-Security-Policy", cspDirectives.join("; "));
  
  next();
}

/**
 * For production, consider tightening CSP:
 * - Remove 'unsafe-inline' from script-src and style-src
 * - Use nonces or hashes for inline scripts/styles
 * - Restrict connect-src to only required domains
 * - Add report-uri for CSP violation reporting
 */
