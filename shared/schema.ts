import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Arrest Records Table
export const arrestRecords = pgTable("arrest_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inmateId: text("inmate_id"),
  fullName: text("full_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  bookingDate: text("booking_date").notNull(),
  releaseDate: text("release_date"),
  charges: text("charges").notNull(),
  bondAmount: text("bond_amount"),
  county: text("county").notNull(),
  facility: text("facility"),
  age: integer("age"),
  gender: text("gender"),
  race: text("race"),
  scrapedDate: text("scraped_date").notNull(),
  sourceUrl: text("source_url"),
  rawData: text("raw_data"),
  crmContactId: text("crm_contact_id"),
  crmSyncDate: text("crm_sync_date"),
  leadScore: integer("lead_score").default(0).notNull(),
  aiEnhanced: integer("ai_enhanced").default(0).notNull(), // 0 = false, 1 = true (SQLite compatibility)
  confidenceScore: integer("confidence_score"), // 0-100 data quality score
  chargeCategories: text("charge_categories"), // JSON array of charge classifications
  normalizedCharges: text("normalized_charges"), // AI-standardized charge text
  riskLevel: text("risk_level"), // low, medium, high
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Scrape Jobs Table
export const scrapeJobs = pgTable("scrape_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: text("job_id").notNull().unique(),
  counties: text("counties").notNull(), // Comma-separated county names
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  recordsFound: integer("records_found").default(0).notNull(),
  aiEnhanced: integer("ai_enhanced").default(1).notNull(), // 0 = false, 1 = true
  aiProcessed: integer("ai_processed").default(0).notNull(), // Count of AI-enhanced records
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
});

// CRM Sync Log Table
export const crmSyncLog = pgTable("crm_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordCount: integer("record_count").notNull(),
  syncDate: timestamp("sync_date").defaultNow().notNull(),
  crmType: text("crm_type"), // csv, salesforce, hubspot, etc.
  status: text("status").notNull(), // success, failed
  errorMessage: text("error_message"),
});

// Duplicate Candidates Table
export const duplicateCandidates = pgTable("duplicate_candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordId1: text("record_id_1").notNull(),
  recordId2: text("record_id_2").notNull(),
  confidenceScore: integer("confidence_score").notNull(), // 0-100
  matchReasons: text("match_reasons").notNull(), // JSON array of match factors
  status: text("status").notNull().default("pending"), // pending, merged, dismissed
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas
export const insertArrestRecordSchema = createInsertSchema(arrestRecords).omit({
  id: true,
  createdAt: true,
});

export const insertScrapeJobSchema = createInsertSchema(scrapeJobs).omit({
  id: true,
  startedAt: true,
});

export const insertCrmSyncLogSchema = createInsertSchema(crmSyncLog).omit({
  id: true,
  syncDate: true,
});

export const insertDuplicateCandidateSchema = createInsertSchema(duplicateCandidates).omit({
  id: true,
  createdAt: true,
});

// Types
export type ArrestRecord = typeof arrestRecords.$inferSelect;
export type InsertArrestRecord = z.infer<typeof insertArrestRecordSchema>;

export type ScrapeJob = typeof scrapeJobs.$inferSelect;
export type InsertScrapeJob = z.infer<typeof insertScrapeJobSchema>;

export type CrmSyncLog = typeof crmSyncLog.$inferSelect;
export type InsertCrmSyncLog = z.infer<typeof insertCrmSyncLogSchema>;

export type DuplicateCandidate = typeof duplicateCandidates.$inferSelect;
export type InsertDuplicateCandidate = z.infer<typeof insertDuplicateCandidateSchema>;

// API Request/Response Types
export const startScrapeSchema = z.object({
  counties: z.array(z.string()).min(1, "At least one county must be selected"),
});

export type StartScrapeRequest = z.infer<typeof startScrapeSchema>;

export const exportRecordsSchema = z.object({
  recordIds: z.array(z.string()).optional(),
  format: z.enum(["csv", "json"]).default("csv"),
  filters: z.object({
    county: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }).optional(),
});

export type ExportRecordsRequest = z.infer<typeof exportRecordsSchema>;

// Florida Counties (commonly used for attorney leads)
export const FLORIDA_COUNTIES = [
  "Miami-Dade",
  "Broward",
  "Palm Beach",
  "Hillsborough",
  "Orange",
  "Pinellas",
  "Duval",
  "Lee",
  "Polk",
  "Brevard",
  "Volusia",
  "Pasco",
  "Seminole",
  "Sarasota",
  "Manatee",
  "Collier",
  "Osceola",
  "Marion",
  "Escambia",
  "Lake",
] as const;

export type FloridaCounty = typeof FLORIDA_COUNTIES[number];
