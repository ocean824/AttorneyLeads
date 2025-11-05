/**
 * Observability Routes
 * 
 * Provides health check and metrics endpoints for monitoring:
 * - /healthz: Liveness probe (basic DB connectivity)
 * - /readyz: Readiness probe (detailed checks)
 * - /metrics: Prometheus-compatible metrics
 */

import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { arrestRecords, scrapeJobs } from "../shared/schema";
import { logger } from "./logger";

type HealthStatus = {
  status: "ok" | "error";
  checks?: Record<string, unknown>;
};

/**
 * Register observability endpoints
 */
export function registerObservabilityRoutes(app: Express) {
  /**
   * GET /healthz
   * 
   * Liveness probe - checks if application is alive and can connect to DB
   * Used by orchestrators (K8s, Docker) to determine if container should be restarted
   * 
   * Returns:
   * - 200: Application is healthy
   * - 500: Application is unhealthy (DB connection failed)
   */
  app.get("/healthz", async (_req: Request, res: Response) => {
    try {
      // Lightweight DB connectivity check
      await db.select({ id: arrestRecords.id }).from(arrestRecords).limit(1);
      
      const payload: HealthStatus = { status: "ok" };
      res.json(payload);
    } catch (error) {
      logger.error("healthz_failed", {
        errorMessage: (error as Error).message,
      });
      
      const payload: HealthStatus = { status: "error" };
      res.status(500).json(payload);
    }
  });

  /**
   * GET /readyz
   * 
   * Readiness probe - checks if application is ready to serve traffic
   * Performs deeper checks (DB counts, environment variables)
   * Used by load balancers to determine if instance should receive traffic
   * 
   * Returns:
   * - 200: Application is ready with detailed checks
   * - 500: Application is not ready
   */
  app.get("/readyz", async (_req: Request, res: Response) => {
    try {
      // Count records in database
      const [recordsRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(arrestRecords);

      const [jobsRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(scrapeJobs);

      // Check environment variables
      const hasOpenAI = !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const hasDatabase = !!process.env.DATABASE_URL;

      const payload: HealthStatus = {
        status: "ok",
        checks: {
          database: {
            connected: true,
            recordCount: recordsRow?.count ?? 0,
            jobCount: jobsRow?.count ?? 0,
          },
          environment: {
            databaseUrl: hasDatabase,
            openaiKey: hasOpenAI,
            phantombusterKey: !!process.env.PHANTOMBUSTER_API_KEY,
            calendlyKey: !!process.env.CALENDLY_API_KEY,
            googleSheetsToken: !!process.env.GOOGLE_SHEETS_TOKEN,
          },
        },
      };

      res.json(payload);
    } catch (error) {
      logger.error("readyz_failed", {
        errorMessage: (error as Error).message,
      });
      
      const payload: HealthStatus = {
        status: "error",
        checks: {
          database: {
            connected: false,
            error: (error as Error).message,
          },
        },
      };
      
      res.status(500).json(payload);
    }
  });

  /**
   * GET /metrics
   * 
   * Prometheus metrics endpoint
   * Exposes application metrics in Prometheus text format
   * 
   * Metrics exposed:
   * - attorneyleads_up: Application up status (1 = up, 0 = down)
   * - attorneyleads_records_total: Total arrest records in database
   * - attorneyleads_scrape_jobs_total: Total scrape jobs
   * - attorneyleads_ai_enhanced_total: Total AI-enhanced records
   * 
   * Returns:
   * - 200: Metrics in Prometheus text format
   * - 500: Error generating metrics
   */
  app.get("/metrics", async (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/plain; version=0.0.4");

    try {
      // Query database for metrics
      const [recordsRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(arrestRecords);
        
      const [jobsRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(scrapeJobs);
        
      const [aiEnhancedRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(arrestRecords)
        .where(sql`${arrestRecords.aiEnhanced} = true`);

      // Generate Prometheus metrics
      const lines = [
        "# HELP attorneyleads_up Application up status",
        "# TYPE attorneyleads_up gauge",
        "attorneyleads_up 1",
        "",
        "# HELP attorneyleads_records_total Total number of arrest records",
        "# TYPE attorneyleads_records_total gauge",
        `attorneyleads_records_total ${recordsRow?.count ?? 0}`,
        "",
        "# HELP attorneyleads_scrape_jobs_total Total number of scrape jobs",
        "# TYPE attorneyleads_scrape_jobs_total gauge",
        `attorneyleads_scrape_jobs_total ${jobsRow?.count ?? 0}`,
        "",
        "# HELP attorneyleads_ai_enhanced_total Total number of AI-enhanced records",
        "# TYPE attorneyleads_ai_enhanced_total gauge",
        `attorneyleads_ai_enhanced_total ${aiEnhancedRow?.count ?? 0}`,
        "",
      ];

      res.send(lines.join("\n"));
    } catch (error) {
      logger.error("metrics_failed", {
        errorMessage: (error as Error).message,
      });

      // Return degraded metrics
      const lines = [
        "# HELP attorneyleads_up Application up status",
        "# TYPE attorneyleads_up gauge",
        "attorneyleads_up 0",
        "",
      ];

      res.status(500).send(lines.join("\n"));
    }
  });
}

/**
 * Example Prometheus scrape config:
 * 
 * ```yaml
 * scrape_configs:
 *   - job_name: 'attorneyleads'
 *     scrape_interval: 30s
 *     static_configs:
 *       - targets: ['your-replit-url.replit.dev']
 *     metrics_path: '/metrics'
 * ```
 */
