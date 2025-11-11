import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, bigint, index, json } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
});

// CRM Sync Log Table
export const crmSyncLog = pgTable("crm_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordCount: integer("record_count").notNull(),
  syncDate: timestamp("sync_date", { withTimezone: true }).defaultNow().notNull(),
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
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Outreach Campaigns Table
export const outreachCampaigns = pgTable("outreach_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  template: text("template").notNull(), // Message template with {{tokens}}
  status: text("status").notNull().default("draft"), // draft, active, paused, completed
  sentCount: integer("sent_count").default(0).notNull(),
  responseCount: integer("response_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Scheduled Meetings Table (Calendly integration)
export const scheduledMeetings = pgTable("scheduled_meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  prospectId: text("prospect_id"), // Reference to crm_prospects
  prospectEmail: text("prospect_email").notNull(),
  prospectName: text("prospect_name").notNull(),
  meetingType: text("meeting_type").notNull().default("demo"), // demo, consultation, follow_up
  calendlyEventUri: text("calendly_event_uri"), // Calendly event ID
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled, no_show
  meetingUrl: text("meeting_url"), // Zoom/Google Meet link
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // 2FA columns
  totpEnabled: integer("totp_enabled").notNull().default(0), // 0 = disabled, 1 = enabled
  totpSecretEnc: text("totp_secret_enc"), // AES-GCM encrypted TOTP secret
  // SMS fallback for 2FA
  phone: varchar("phone", { length: 32 }), // Phone number for SMS OTP
  // Billing & subscription columns
  plan: varchar("plan", { length: 20 }).notNull().default("free"), // 'free' | 'basic' | 'standard' | 'pro' | 'elite'
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  subscriptionStatus: varchar("subscription_status", { length: 50 }), // 'active' | 'canceled' | 'past_due' | 'trialing' | null
  subscriptionCurrentPeriodEnd: integer("subscription_current_period_end"), // Unix timestamp
});

// Password Reset Tokens Table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 256 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// User Backup Codes Table (for 2FA recovery)
export const userBackupCodes = pgTable("user_backup_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: varchar("code_hash", { length: 256 }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// User Trusted Devices Table (for "Trust this device" feature)
export const userTrustedDevices = pgTable("user_trusted_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 256 }).notNull().unique(),
  label: varchar("label", { length: 255 }), // Device name/label
  expiresAt: integer("expires_at").notNull(), // Unix timestamp (seconds)
  lastUsedAt: integer("last_used_at"), // Unix timestamp (seconds)
  createdAt: integer("created_at").notNull().default(sql`extract(epoch from now())::int`),
});

// Express Session Table (managed by connect-pg-simple)
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { withTimezone: true }).notNull(),
}, (table) => ({
  expireIdx: index("IDX_session_expire").on(table.expire),
}));

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

export const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterUserRequest = z.infer<typeof registerUserSchema>;
export type RequestPasswordResetRequest = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;

// ===================== ENHANCED SCRAPER TABLES =====================

// Arrest Documents Table (affidavits, offense reports)
export const arrestDocuments = pgTable("arrest_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  arrestRecordId: varchar("arrest_record_id").notNull().references(() => arrestRecords.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(), // affidavit, offense_report, booking_sheet, mugshot
  documentUrl: text("document_url"), // URL to original document
  localPath: text("local_path"), // Path to downloaded document
  fileSize: bigint("file_size", { mode: "number" }), // Bytes
  mimeType: text("mime_type"), // application/pdf, image/jpeg, etc.
  retrievalStatus: text("retrieval_status").notNull().default("pending"), // pending, success, failed, not_found
  verificationStatus: text("verification_status").notNull().default("pending"), // pending, verified, mismatch
  verificationNotes: text("verification_notes"), // AI verification details
  retryCount: integer("retry_count").default(0).notNull(),
  lastRetryAt: timestamp("last_retry_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  metadata: text("metadata"), // JSON with additional document info
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  arrestRecordIdIdx: index("arrest_documents_arrest_record_id_idx").on(table.arrestRecordId),
  retrievalStatusIdx: index("arrest_documents_retrieval_status_idx").on(table.retrievalStatus),
  verificationStatusIdx: index("arrest_documents_verification_status_idx").on(table.verificationStatus),
}));

// Court Dockets Table
export const courtDockets = pgTable("court_dockets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  arrestRecordId: varchar("arrest_record_id").notNull().references(() => arrestRecords.id, { onDelete: "cascade" }),
  caseNumber: text("case_number"),
  courtName: text("court_name"),
  filingDate: text("filing_date"),
  status: text("status"), // pending, active, closed, dismissed
  charges: text("charges"), // JSON array of charges with details
  disposition: text("disposition"), // guilty, not_guilty, plea_deal, dismissed
  sentencingDetails: text("sentencing_details"), // JSON with sentencing info
  docketUrl: text("docket_url"), // URL to court docket
  retrievalStatus: text("retrieval_status").notNull().default("pending"), // pending, success, failed, not_found
  matchConfidence: integer("match_confidence"), // 0-100 confidence score
  matchReason: text("match_reason"), // Explanation of match logic
  retryCount: integer("retry_count").default(0).notNull(),
  lastRetryAt: timestamp("last_retry_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  arrestRecordIdIdx: index("court_dockets_arrest_record_id_idx").on(table.arrestRecordId),
  retrievalStatusIdx: index("court_dockets_retrieval_status_idx").on(table.retrievalStatus),
  statusIdx: index("court_dockets_status_idx").on(table.status),
}));

// Agent Interactions Table (AI agent chat history)
export const agentInteractions = pgTable("agent_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(), // Group related messages
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  arrestRecordId: varchar("arrest_record_id").references(() => arrestRecords.id, { onDelete: "set null" }), // Optional context
  role: text("role").notNull(), // user, assistant, system
  message: text("message").notNull(),
  model: text("model"), // gpt-4o-mini, etc.
  tokensUsed: integer("tokens_used"),
  actionTaken: text("action_taken"), // crm_delivery, code_explanation, verification_check
  actionResult: text("action_result"), // JSON with action outcome
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("agent_interactions_session_id_idx").on(table.sessionId),
  userIdIdx: index("agent_interactions_user_id_idx").on(table.userId),
  arrestRecordIdIdx: index("agent_interactions_arrest_record_id_idx").on(table.arrestRecordId),
}));

// CRM Delivery Logs Table
export const deliveryLogs = pgTable("delivery_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deliveryType: text("delivery_type").notNull(), // internal, webhook, email
  destination: text("destination").notNull(), // URL for webhook, email address, or "internal_ui"
  recordIds: text("record_ids").notNull(), // JSON array of arrest record IDs
  payloadHash: varchar("payload_hash", { length: 64 }), // SHA-256 hash of payload
  status: text("status").notNull().default("pending"), // pending, success, failed, retrying
  httpStatusCode: integer("http_status_code"), // For webhook deliveries
  responseBody: text("response_body"), // Response from webhook
  retryCount: integer("retry_count").default(0).notNull(),
  maxRetries: integer("max_retries").default(3).notNull(),
  lastRetryAt: timestamp("last_retry_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  triggeredBy: varchar("triggered_by"), // user_id who triggered delivery
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  deliveryTypeIdx: index("delivery_logs_delivery_type_idx").on(table.deliveryType),
  statusIdx: index("delivery_logs_status_idx").on(table.status),
  triggeredByIdx: index("delivery_logs_triggered_by_idx").on(table.triggeredBy),
}));

// Notification History Table
export const notificationHistory = pgTable("notification_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notificationType: text("notification_type").notNull(), // daily_digest, toast, email_summary, agent_log
  channel: text("channel").notNull(), // email, in_app, log
  recipient: text("recipient"), // Email address or user_id
  subject: text("subject"),
  message: text("message").notNull(),
  templateUsed: text("template_used"), // Template identifier
  metadata: text("metadata"), // JSON with notification context (arrest count, date range, etc.)
  status: text("status").notNull().default("pending"), // pending, sent, failed
  sentAt: timestamp("sent_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  notificationTypeIdx: index("notification_history_notification_type_idx").on(table.notificationType),
  channelIdx: index("notification_history_channel_idx").on(table.channel),
  statusIdx: index("notification_history_status_idx").on(table.status),
}));

// Insert Schemas for Enhanced Scraper tables
export const insertArrestDocumentSchema = createInsertSchema(arrestDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCourtDocketSchema = createInsertSchema(courtDockets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentInteractionSchema = createInsertSchema(agentInteractions).omit({
  id: true,
  createdAt: true,
});

export const insertDeliveryLogSchema = createInsertSchema(deliveryLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const insertNotificationHistorySchema = createInsertSchema(notificationHistory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
});

// Appointment Slots Table - Admin-defined availability
export const appointmentSlots = pgTable("appointment_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: varchar("start_time", { length: 5 }).notNull(), // HH:MM format (24-hour)
  endTime: varchar("end_time", { length: 5 }).notNull(), // HH:MM format (24-hour)
  duration: integer("duration").notNull().default(30), // Slot duration in minutes
  timezone: varchar("timezone", { length: 100 }).notNull().default("America/New_York"), // IANA timezone
  isActive: integer("is_active").notNull().default(1), // 0 = disabled, 1 = enabled
  maxBookings: integer("max_bookings").notNull().default(1), // Max concurrent bookings per slot
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Appointment Bookings Table - Visitor bookings
export const appointmentBookings = pgTable("appointment_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slotId: varchar("slot_id").references(() => appointmentSlots.id, { onDelete: "cascade" }),
  appointmentDate: varchar("appointment_date", { length: 10 }).notNull(), // YYYY-MM-DD format
  appointmentTime: varchar("appointment_time", { length: 5 }).notNull(), // HH:MM format (24-hour)
  visitorName: varchar("visitor_name", { length: 255 }).notNull(),
  visitorEmail: varchar("visitor_email", { length: 255 }).notNull(),
  visitorPhone: varchar("visitor_phone", { length: 32 }),
  visitorTimezone: varchar("visitor_timezone", { length: 100 }).notNull(), // IANA timezone
  caseType: varchar("case_type", { length: 100 }), // e.g., "DUI", "Traffic", "Criminal"
  notes: text("notes"),
  status: varchar("status", { length: 20 }).notNull().default("confirmed"), // confirmed, cancelled, completed, no_show
  confirmationSent: integer("confirmation_sent").notNull().default(0), // 0 = not sent, 1 = sent
  reminderSent: integer("reminder_sent").notNull().default(0), // 0 = not sent, 1 = sent
  sessionId: varchar("session_id", { length: 255 }), // Link to chat session
  arrestRecordId: varchar("arrest_record_id", { length: 255 }).references(() => arrestRecords.id, { onDelete: "set null" }), // Optional link to arrest record
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  dateIdx: index("appointment_bookings_date_idx").on(table.appointmentDate),
  statusIdx: index("appointment_bookings_status_idx").on(table.status),
}));

// Insert Schemas for Appointments
export const insertAppointmentSlotSchema = createInsertSchema(appointmentSlots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppointmentBookingSchema = createInsertSchema(appointmentBookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for Enhanced Scraper tables
export type ArrestDocument = typeof arrestDocuments.$inferSelect;
export type InsertArrestDocument = z.infer<typeof insertArrestDocumentSchema>;

export type CourtDocket = typeof courtDockets.$inferSelect;
export type InsertCourtDocket = z.infer<typeof insertCourtDocketSchema>;

export type AgentInteraction = typeof agentInteractions.$inferSelect;
export type InsertAgentInteraction = z.infer<typeof insertAgentInteractionSchema>;

export type DeliveryLog = typeof deliveryLogs.$inferSelect;
export type InsertDeliveryLog = z.infer<typeof insertDeliveryLogSchema>;

export type NotificationHistory = typeof notificationHistory.$inferSelect;
export type InsertNotificationHistory = z.infer<typeof insertNotificationHistorySchema>;

// API Schemas for Enhanced Scraper endpoints

export const chatMessageSchema = z.object({
  sessionId: z.string().optional(), // Create new session if not provided
  message: z.string().min(1),
  arrestRecordId: z.string().optional(), // Optional context
});

export const deliverToCrmSchema = z.object({
  recordIds: z.array(z.string()).min(1),
  deliveryType: z.enum(["internal", "webhook"]),
  webhookUrl: z.string().url().optional(), // Required for webhook type
});

export const sendNotificationSchema = z.object({
  notificationType: z.enum(["daily_digest", "toast", "email_summary", "agent_log"]),
  channel: z.enum(["email", "in_app", "log"]),
  recipient: z.string().optional(),
  message: z.string().min(1),
});

export const generateExportSchema = z.object({
  format: z.enum(["pdf", "csv"]),
  recordIds: z.array(z.string()).optional(),
  groupBy: z.enum(["date", "county", "none"]).default("date"),
  includeDocuments: z.boolean().default(true),
  filters: z.object({
    county: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }).optional(),
});

export type ChatMessageRequest = z.infer<typeof chatMessageSchema>;
export type DeliverToCrmRequest = z.infer<typeof deliverToCrmSchema>;
export type SendNotificationRequest = z.infer<typeof sendNotificationSchema>;
export type GenerateExportRequest = z.infer<typeof generateExportSchema>;

// Appointment types
export type AppointmentSlot = typeof appointmentSlots.$inferSelect;
export type InsertAppointmentSlot = z.infer<typeof insertAppointmentSlotSchema>;

export type AppointmentBooking = typeof appointmentBookings.$inferSelect;
export type InsertAppointmentBooking = z.infer<typeof insertAppointmentBookingSchema>;
