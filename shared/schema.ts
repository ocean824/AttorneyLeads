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
  scrapedDate: text("scraped_date").default(sql`CURRENT_DATE::text`).notNull(),
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
  enableAI: z.boolean().default(true), // Enable AI enhancement by default
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

// CRM Prospects Table (for lead generation campaigns)
export const crmProspects = pgTable("crm_prospects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email"),
  company: text("company"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  source: text("source").notNull(), // phantombuster, manual, form_submission
  status: text("status").notNull().default("new"), // new, contacted, qualified, converted, rejected
  tags: text("tags"), // JSON array of tags
  notes: text("notes"),
  lastContactedAt: timestamp("last_contacted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Outreach Campaigns Table
export const outreachCampaigns = pgTable("outreach_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  template: text("template").notNull(), // Message template with {{tokens}}
  status: text("status").notNull().default("draft"), // draft, active, paused, completed
  sentCount: integer("sent_count").default(0).notNull(),
  responseCount: integer("response_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Scheduled Meetings Table (Calendly integration)
export const scheduledMeetings = pgTable("scheduled_meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  prospectId: text("prospect_id"), // Reference to crm_prospects
  prospectEmail: text("prospect_email").notNull(),
  prospectName: text("prospect_name").notNull(),
  meetingType: text("meeting_type").notNull().default("demo"), // demo, consultation, follow_up
  calendlyEventUri: text("calendly_event_uri"), // Calendly event ID
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled, no_show
  meetingUrl: text("meeting_url"), // Zoom/Google Meet link
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas for CRM tables
export const insertCrmProspectSchema = createInsertSchema(crmProspects).omit({
  id: true,
  createdAt: true,
});

export const insertOutreachCampaignSchema = createInsertSchema(outreachCampaigns).omit({
  id: true,
  createdAt: true,
});

export const insertScheduledMeetingSchema = createInsertSchema(scheduledMeetings).omit({
  id: true,
  createdAt: true,
});

// Types for CRM tables
export type CrmProspect = typeof crmProspects.$inferSelect;
export type InsertCrmProspect = z.infer<typeof insertCrmProspectSchema>;

export type OutreachCampaign = typeof outreachCampaigns.$inferSelect;
export type InsertOutreachCampaign = z.infer<typeof insertOutreachCampaignSchema>;

export type ScheduledMeeting = typeof scheduledMeetings.$inferSelect;
export type InsertScheduledMeeting = z.infer<typeof insertScheduledMeetingSchema>;

// API Schemas for CRM endpoints
export const createProspectSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().default("manual"),
  tags: z.array(z.string()).optional(),
});

export const sendOutreachSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  company: z.string().optional(),
  message: z.string().optional(),
});

export const scheduleMeetingSchema = z.object({
  prospectEmail: z.string().email(),
  prospectName: z.string().min(1),
  meetingType: z.enum(["demo", "consultation", "follow_up"]).default("demo"),
  scheduledAt: z.string(), // ISO date string
});

export const updateProspectSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  company: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  status: z.enum(["new", "contacted", "qualified", "converted", "rejected"]).optional(),
  tags: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lastContactedAt: z.coerce.date().nullable().optional(),
});

export const syncSheetsSchema = z.object({
  spreadsheetId: z.string().min(1),
  sheetName: z.string().optional(),
});

export type CreateProspectRequest = z.infer<typeof createProspectSchema>;
export type SendOutreachRequest = z.infer<typeof sendOutreachSchema>;
export type ScheduleMeetingRequest = z.infer<typeof scheduleMeetingSchema>;
export type UpdateProspectRequest = z.infer<typeof updateProspectSchema>;
export type SyncSheetsRequest = z.infer<typeof syncSheetsSchema>;

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

// ===================== USERS / AUTH =====================
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("user"), // 'user' | 'admin'
  isActive: integer("is_active").notNull().default(1),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // 2FA columns
  totpEnabled: integer("totp_enabled").notNull().default(0), // 0 = disabled, 1 = enabled
  totpSecretEnc: text("totp_secret_enc"), // AES-GCM encrypted TOTP secret
  // SMS fallback for 2FA
  phone: varchar("phone", { length: 32 }), // Phone number for SMS OTP
});

// Password Reset Tokens Table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 256 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Backup Codes Table (for 2FA recovery)
export const userBackupCodes = pgTable("user_backup_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: varchar("code_hash", { length: 256 }).notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Trusted Devices Table (for "Trust this device" feature)
export const userTrustedDevices = pgTable("user_trusted_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 256 }).notNull().unique(),
  label: varchar("label", { length: 255 }), // Device name/label
  expiresAt: timestamp("expires_at").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export type UserBackupCode = typeof userBackupCodes.$inferSelect;
export type InsertUserBackupCode = typeof userBackupCodes.$inferInsert;

export type UserTrustedDevice = typeof userTrustedDevices.$inferSelect;
export type InsertUserTrustedDevice = typeof userTrustedDevices.$inferInsert;

// Runtime validation helpers
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, "Password must be at least 12 characters"),
  role: z.enum(["user", "admin"]).default("user"),
});

export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterUserRequest = z.infer<typeof registerUserSchema>;
