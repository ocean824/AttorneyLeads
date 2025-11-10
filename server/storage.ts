import {
  type ArrestRecord,
  type InsertArrestRecord,
  type ScrapeJob,
  type InsertScrapeJob,
  type CrmSyncLog,
  type InsertCrmSyncLog,
  type DuplicateCandidate,
  type InsertDuplicateCandidate,
  type CrmProspect,
  type InsertCrmProspect,
  type OutreachCampaign,
  type InsertOutreachCampaign,
  type ScheduledMeeting,
  type InsertScheduledMeeting,
  type ArrestDocument,
  type InsertArrestDocument,
  type CourtDocket,
  type InsertCourtDocket,
  type AgentInteraction,
  type InsertAgentInteraction,
  type DeliveryLog,
  type InsertDeliveryLog,
  type NotificationHistory,
  type InsertNotificationHistory,
  arrestRecords,
  scrapeJobs,
  crmSyncLog,
  duplicateCandidates,
  crmProspects,
  outreachCampaigns,
  scheduledMeetings,
  arrestDocuments,
  courtDockets,
  agentInteractions,
  deliveryLogs,
  notificationHistory,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, or, like, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Arrest Records
  getArrestRecords(filters?: {
    county?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ records: ArrestRecord[]; total: number }>;
  getArrestRecord(id: string): Promise<ArrestRecord | undefined>;
  createArrestRecord(record: InsertArrestRecord): Promise<ArrestRecord>;
  createArrestRecords(records: InsertArrestRecord[]): Promise<ArrestRecord[]>;
  updateArrestRecord(
    id: string,
    updates: Partial<Omit<ArrestRecord, "id" | "createdAt">>
  ): Promise<ArrestRecord | undefined>;
  deleteArrestRecord(id: string): Promise<boolean>;
  getTotalRecordsCount(): Promise<number>;
  getLastScrapeDate(): Promise<string | null>;

  // Scrape Jobs
  getScrapeJobs(): Promise<ScrapeJob[]>;
  getScrapeJob(id: string): Promise<ScrapeJob | undefined>;
  getScrapeJobByJobId(jobId: string): Promise<ScrapeJob | undefined>;
  createScrapeJob(job: InsertScrapeJob): Promise<ScrapeJob>;
  updateScrapeJob(
    id: string,
    updates: Partial<Omit<ScrapeJob, "id" | "jobId" | "startedAt">>
  ): Promise<ScrapeJob | undefined>;
  getActiveJobsCount(): Promise<number>;

  // CRM Sync Log
  getCrmSyncLogs(): Promise<CrmSyncLog[]>;
  createCrmSyncLog(log: InsertCrmSyncLog): Promise<CrmSyncLog>;
  getTotalExportsCount(): Promise<number>;

  // Duplicate Candidates
  getDuplicateCandidates(status?: string): Promise<DuplicateCandidate[]>;
  createDuplicateCandidate(candidate: InsertDuplicateCandidate): Promise<DuplicateCandidate>;
  updateDuplicateCandidate(
    id: string,
    updates: Partial<Omit<DuplicateCandidate, "id" | "createdAt">>
  ): Promise<DuplicateCandidate | undefined>;
  getPendingDuplicatesCount(): Promise<number>;

  // Analytics
  getRecordsByCounty(dateFrom?: string, dateTo?: string): Promise<Array<{ county: string; count: number }>>;
  getLeadScoreDistribution(dateFrom?: string, dateTo?: string): Promise<Array<{ range: string; count: number }>>;
  getChargeCategoryDistribution(dateFrom?: string, dateTo?: string): Promise<Array<{ category: string; count: number }>>;
  getJobsOverTime(dateFrom?: string, dateTo?: string): Promise<Array<{ date: string; total: number; completed: number; failed: number }>>;
  getAIEnhancementStats(dateFrom?: string, dateTo?: string): Promise<{ totalRecords: number; aiEnhanced: number; avgConfidenceScore: number }>;

  // CRM Prospects
  getCrmProspects(filters?: { status?: string; source?: string }): Promise<CrmProspect[]>;
  getCrmProspect(id: string): Promise<CrmProspect | undefined>;
  createCrmProspect(prospect: InsertCrmProspect): Promise<CrmProspect>;
  updateCrmProspect(id: string, updates: Partial<Omit<CrmProspect, "id" | "createdAt">>): Promise<CrmProspect | undefined>;
  deleteCrmProspect(id: string): Promise<boolean>;

  // Outreach Campaigns
  getOutreachCampaigns(): Promise<OutreachCampaign[]>;
  getOutreachCampaign(id: string): Promise<OutreachCampaign | undefined>;
  createOutreachCampaign(campaign: InsertOutreachCampaign): Promise<OutreachCampaign>;
  updateOutreachCampaign(id: string, updates: Partial<Omit<OutreachCampaign, "id" | "createdAt">>): Promise<OutreachCampaign | undefined>;

  // Scheduled Meetings
  getScheduledMeetings(filters?: { status?: string }): Promise<ScheduledMeeting[]>;
  getScheduledMeeting(id: string): Promise<ScheduledMeeting | undefined>;
  createScheduledMeeting(meeting: InsertScheduledMeeting): Promise<ScheduledMeeting>;
  updateScheduledMeeting(id: string, updates: Partial<Omit<ScheduledMeeting, "id" | "createdAt">>): Promise<ScheduledMeeting | undefined>;

  // Arrest Documents
  getArrestDocuments(arrestRecordId: string): Promise<ArrestDocument[]>;
  getArrestDocument(id: string): Promise<ArrestDocument | undefined>;
  createArrestDocument(document: InsertArrestDocument): Promise<ArrestDocument>;
  updateArrestDocument(id: string, updates: Partial<Omit<ArrestDocument, "id" | "createdAt">>): Promise<ArrestDocument | undefined>;

  // Court Dockets
  getCourtDockets(arrestRecordId: string): Promise<CourtDocket[]>;
  getCourtDocket(id: string): Promise<CourtDocket | undefined>;
  createCourtDocket(docket: InsertCourtDocket): Promise<CourtDocket>;
  updateCourtDocket(id: string, updates: Partial<Omit<CourtDocket, "id" | "createdAt">>): Promise<CourtDocket | undefined>;

  // Agent Interactions
  getAgentInteractions(sessionId?: string, arrestRecordId?: string, userId?: string): Promise<AgentInteraction[]>;
  createAgentInteraction(interaction: InsertAgentInteraction): Promise<AgentInteraction>;
  deleteAgentInteractions(sessionId: string): Promise<number>;
  getSessionOwner(sessionId: string): Promise<string | null>;

  // Delivery Logs
  getDeliveryLogs(filters?: { deliveryType?: string; status?: string }): Promise<DeliveryLog[]>;
  getDeliveryLog(id: string): Promise<DeliveryLog | undefined>;
  createDeliveryLog(log: InsertDeliveryLog): Promise<DeliveryLog>;
  updateDeliveryLog(id: string, updates: Partial<Omit<DeliveryLog, "id" | "createdAt">>): Promise<DeliveryLog | undefined>;

  // Notification History
  getNotificationHistory(filters?: { notificationType?: string; channel?: string }): Promise<NotificationHistory[]>;
  createNotificationHistory(notification: InsertNotificationHistory): Promise<NotificationHistory>;
  updateNotificationHistory(id: string, updates: Partial<Omit<NotificationHistory, "id" | "createdAt">>): Promise<NotificationHistory | undefined>;
}

export class DbStorage implements IStorage {
  // Arrest Records Methods
  async getArrestRecords(filters?: {
    county?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ records: ArrestRecord[]; total: number }> {
    const conditions = [];

    if (filters?.county) {
      conditions.push(eq(arrestRecords.county, filters.county));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(arrestRecords.bookingDate, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(arrestRecords.bookingDate, filters.dateTo));
    }
    if (filters?.search) {
      const searchLower = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${arrestRecords.fullName}) LIKE ${searchLower}`,
          sql`LOWER(${arrestRecords.inmateId}) LIKE ${searchLower}`,
          sql`LOWER(${arrestRecords.charges}) LIKE ${searchLower}`
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(arrestRecords)
      .where(whereClause);

    // Get paginated records
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const records = await db
      .select()
      .from(arrestRecords)
      .where(whereClause)
      .orderBy(desc(arrestRecords.bookingDate))
      .limit(pageSize)
      .offset(offset);

    return { records, total: count };
  }

  async getArrestRecord(id: string): Promise<ArrestRecord | undefined> {
    const [record] = await db
      .select()
      .from(arrestRecords)
      .where(eq(arrestRecords.id, id))
      .limit(1);

    return record;
  }

  async createArrestRecord(
    insertRecord: InsertArrestRecord
  ): Promise<ArrestRecord> {
    const [record] = await db
      .insert(arrestRecords)
      .values(insertRecord)
      .returning();

    return record;
  }

  async createArrestRecords(
    insertRecords: InsertArrestRecord[]
  ): Promise<ArrestRecord[]> {
    if (insertRecords.length === 0) return [];

    const records = await db
      .insert(arrestRecords)
      .values(insertRecords)
      .returning();

    return records;
  }

  async updateArrestRecord(
    id: string,
    updates: Partial<Omit<ArrestRecord, "id" | "createdAt">>
  ): Promise<ArrestRecord | undefined> {
    const result = await db
      .update(arrestRecords)
      .set(updates)
      .where(eq(arrestRecords.id, id))
      .returning();

    return result[0];
  }

  async deleteArrestRecord(id: string): Promise<boolean> {
    const result = await db
      .delete(arrestRecords)
      .where(eq(arrestRecords.id, id))
      .returning();

    return result.length > 0;
  }

  async getTotalRecordsCount(): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(arrestRecords);

    return count;
  }

  async getLastScrapeDate(): Promise<string | null> {
    const [record] = await db
      .select({ scrapedDate: arrestRecords.scrapedDate })
      .from(arrestRecords)
      .orderBy(desc(arrestRecords.scrapedDate))
      .limit(1);

    return record?.scrapedDate || null;
  }

  // Scrape Jobs Methods
  async getScrapeJobs(): Promise<ScrapeJob[]> {
    const jobs = await db
      .select()
      .from(scrapeJobs)
      .orderBy(desc(scrapeJobs.startedAt));

    return jobs;
  }

  async getScrapeJob(id: string): Promise<ScrapeJob | undefined> {
    const [job] = await db
      .select()
      .from(scrapeJobs)
      .where(eq(scrapeJobs.id, id))
      .limit(1);

    return job;
  }

  async getScrapeJobByJobId(jobId: string): Promise<ScrapeJob | undefined> {
    const [job] = await db
      .select()
      .from(scrapeJobs)
      .where(eq(scrapeJobs.jobId, jobId))
      .limit(1);

    return job;
  }

  async createScrapeJob(insertJob: InsertScrapeJob): Promise<ScrapeJob> {
    const [job] = await db.insert(scrapeJobs).values(insertJob).returning();

    return job;
  }

  async updateScrapeJob(
    id: string,
    updates: Partial<Omit<ScrapeJob, "id" | "jobId" | "startedAt">>
  ): Promise<ScrapeJob | undefined> {
    const [job] = await db
      .update(scrapeJobs)
      .set(updates)
      .where(eq(scrapeJobs.id, id))
      .returning();

    return job;
  }

  async getActiveJobsCount(): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scrapeJobs)
      .where(or(eq(scrapeJobs.status, "running"), eq(scrapeJobs.status, "pending"))!);

    return count;
  }

  // CRM Sync Log Methods
  async getCrmSyncLogs(): Promise<CrmSyncLog[]> {
    const logs = await db
      .select()
      .from(crmSyncLog)
      .orderBy(desc(crmSyncLog.syncDate));

    return logs;
  }

  async createCrmSyncLog(insertLog: InsertCrmSyncLog): Promise<CrmSyncLog> {
    const [log] = await db.insert(crmSyncLog).values(insertLog).returning();

    return log;
  }

  async getTotalExportsCount(): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmSyncLog);

    return count;
  }

  // Duplicate Candidates Methods
  async getDuplicateCandidates(status?: string): Promise<DuplicateCandidate[]> {
    const whereClause = status ? eq(duplicateCandidates.status, status) : undefined;

    const candidates = await db
      .select()
      .from(duplicateCandidates)
      .where(whereClause)
      .orderBy(desc(duplicateCandidates.confidenceScore), desc(duplicateCandidates.createdAt));

    return candidates;
  }

  async createDuplicateCandidate(
    insertCandidate: InsertDuplicateCandidate
  ): Promise<DuplicateCandidate> {
    const [candidate] = await db
      .insert(duplicateCandidates)
      .values(insertCandidate)
      .returning();

    return candidate;
  }

  async updateDuplicateCandidate(
    id: string,
    updates: Partial<Omit<DuplicateCandidate, "id" | "createdAt">>
  ): Promise<DuplicateCandidate | undefined> {
    const [candidate] = await db
      .update(duplicateCandidates)
      .set(updates)
      .where(eq(duplicateCandidates.id, id))
      .returning();

    return candidate;
  }

  async getPendingDuplicatesCount(): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(duplicateCandidates)
      .where(eq(duplicateCandidates.status, "pending"));

    return count;
  }

  // Analytics Methods
  async getRecordsByCounty(dateFrom?: string, dateTo?: string): Promise<Array<{ county: string; count: number }>> {
    const conditions = [];
    if (dateFrom) conditions.push(gte(arrestRecords.scrapedDate, dateFrom));
    if (dateTo) conditions.push(lte(arrestRecords.scrapedDate, dateTo));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({
        county: arrestRecords.county,
        count: sql<number>`count(*)::int`,
      })
      .from(arrestRecords)
      .where(whereClause)
      .groupBy(arrestRecords.county)
      .orderBy(desc(sql<number>`count(*)`));

    return result;
  }

  async getLeadScoreDistribution(dateFrom?: string, dateTo?: string): Promise<Array<{ range: string; count: number }>> {
    const conditions = [];
    if (dateFrom) conditions.push(gte(arrestRecords.scrapedDate, dateFrom));
    if (dateTo) conditions.push(lte(arrestRecords.scrapedDate, dateTo));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({
        range: sql<string>`
          CASE 
            WHEN ${arrestRecords.leadScore} >= 80 THEN '80-100'
            WHEN ${arrestRecords.leadScore} >= 60 THEN '60-79'
            WHEN ${arrestRecords.leadScore} >= 40 THEN '40-59'
            WHEN ${arrestRecords.leadScore} >= 20 THEN '20-39'
            ELSE '0-19'
          END
        `,
        count: sql<number>`count(*)::int`,
      })
      .from(arrestRecords)
      .where(whereClause)
      .groupBy(sql`
        CASE 
          WHEN ${arrestRecords.leadScore} >= 80 THEN '80-100'
          WHEN ${arrestRecords.leadScore} >= 60 THEN '60-79'
          WHEN ${arrestRecords.leadScore} >= 40 THEN '40-59'
          WHEN ${arrestRecords.leadScore} >= 20 THEN '20-39'
          ELSE '0-19'
        END
      `);

    const ranges = ['80-100', '60-79', '40-59', '20-39', '0-19'];
    return ranges.map(range => {
      const found = result.find(r => r.range === range);
      return { range, count: found?.count || 0 };
    });
  }

  async getChargeCategoryDistribution(dateFrom?: string, dateTo?: string): Promise<Array<{ category: string; count: number }>> {
    const conditions = [eq(arrestRecords.aiEnhanced, 1)];
    if (dateFrom) conditions.push(gte(arrestRecords.scrapedDate, dateFrom));
    if (dateTo) conditions.push(lte(arrestRecords.scrapedDate, dateTo));

    const records = await db
      .select({ chargeCategories: arrestRecords.chargeCategories })
      .from(arrestRecords)
      .where(and(...conditions));

    const categoryCount: Record<string, number> = {};
    records.forEach(record => {
      if (record.chargeCategories) {
        try {
          const categories = JSON.parse(record.chargeCategories) as string[];
          categories.forEach(cat => {
            categoryCount[cat] = (categoryCount[cat] || 0) + 1;
          });
        } catch (e) {
          // Skip invalid JSON
        }
      }
    });

    return Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  async getJobsOverTime(dateFrom?: string, dateTo?: string): Promise<Array<{ date: string; total: number; completed: number; failed: number }>> {
    const conditions = [];
    if (dateFrom) conditions.push(gte(sql<string>`${scrapeJobs.startedAt}::date::text`, dateFrom));
    if (dateTo) conditions.push(lte(sql<string>`${scrapeJobs.startedAt}::date::text`, dateTo));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({
        date: sql<string>`${scrapeJobs.startedAt}::date::text`,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(CASE WHEN ${scrapeJobs.status} = 'completed' THEN 1 END)::int`,
        failed: sql<number>`count(CASE WHEN ${scrapeJobs.status} = 'failed' THEN 1 END)::int`,
      })
      .from(scrapeJobs)
      .where(whereClause)
      .groupBy(sql`${scrapeJobs.startedAt}::date`)
      .orderBy(sql`${scrapeJobs.startedAt}::date`);

    return result;
  }

  async getAIEnhancementStats(dateFrom?: string, dateTo?: string): Promise<{ totalRecords: number; aiEnhanced: number; avgConfidenceScore: number }> {
    const conditions = [];
    if (dateFrom) conditions.push(gte(arrestRecords.scrapedDate, dateFrom));
    if (dateTo) conditions.push(lte(arrestRecords.scrapedDate, dateTo));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [stats] = await db
      .select({
        totalRecords: sql<number>`count(*)::int`,
        aiEnhanced: sql<number>`count(CASE WHEN ${arrestRecords.aiEnhanced} = 1 THEN 1 END)::int`,
        avgConfidenceScore: sql<number>`COALESCE(AVG(CASE WHEN ${arrestRecords.confidenceScore} IS NOT NULL THEN ${arrestRecords.confidenceScore} END), 0)::int`,
      })
      .from(arrestRecords)
      .where(whereClause);

    return stats;
  }

  // CRM Prospects Methods
  async getCrmProspects(filters?: { status?: string; source?: string }): Promise<CrmProspect[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(crmProspects.status, filters.status));
    }
    if (filters?.source) {
      conditions.push(eq(crmProspects.source, filters.source));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return await db.select().from(crmProspects).where(whereClause).orderBy(desc(crmProspects.createdAt));
  }

  async getCrmProspect(id: string): Promise<CrmProspect | undefined> {
    const [prospect] = await db.select().from(crmProspects).where(eq(crmProspects.id, id));
    return prospect;
  }

  async createCrmProspect(prospect: InsertCrmProspect): Promise<CrmProspect> {
    const [created] = await db.insert(crmProspects).values(prospect).returning();
    return created;
  }

  async updateCrmProspect(id: string, updates: Partial<Omit<CrmProspect, "id" | "createdAt">>): Promise<CrmProspect | undefined> {
    const [updated] = await db.update(crmProspects).set(updates).where(eq(crmProspects.id, id)).returning();
    return updated;
  }

  async deleteCrmProspect(id: string): Promise<boolean> {
    const result = await db.delete(crmProspects).where(eq(crmProspects.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Outreach Campaigns Methods
  async getOutreachCampaigns(): Promise<OutreachCampaign[]> {
    return await db.select().from(outreachCampaigns).orderBy(desc(outreachCampaigns.createdAt));
  }

  async getOutreachCampaign(id: string): Promise<OutreachCampaign | undefined> {
    const [campaign] = await db.select().from(outreachCampaigns).where(eq(outreachCampaigns.id, id));
    return campaign;
  }

  async createOutreachCampaign(campaign: InsertOutreachCampaign): Promise<OutreachCampaign> {
    const [created] = await db.insert(outreachCampaigns).values(campaign).returning();
    return created;
  }

  async updateOutreachCampaign(id: string, updates: Partial<Omit<OutreachCampaign, "id" | "createdAt">>): Promise<OutreachCampaign | undefined> {
    const [updated] = await db.update(outreachCampaigns).set(updates).where(eq(outreachCampaigns.id, id)).returning();
    return updated;
  }

  // Scheduled Meetings Methods
  async getScheduledMeetings(filters?: { status?: string }): Promise<ScheduledMeeting[]> {
    const whereClause = filters?.status ? eq(scheduledMeetings.status, filters.status) : undefined;
    return await db.select().from(scheduledMeetings).where(whereClause).orderBy(desc(scheduledMeetings.scheduledAt));
  }

  async getScheduledMeeting(id: string): Promise<ScheduledMeeting | undefined> {
    const [meeting] = await db.select().from(scheduledMeetings).where(eq(scheduledMeetings.id, id));
    return meeting;
  }

  async createScheduledMeeting(meeting: InsertScheduledMeeting): Promise<ScheduledMeeting> {
    const [created] = await db.insert(scheduledMeetings).values(meeting).returning();
    return created;
  }

  async updateScheduledMeeting(id: string, updates: Partial<Omit<ScheduledMeeting, "id" | "createdAt">>): Promise<ScheduledMeeting | undefined> {
    const [updated] = await db.update(scheduledMeetings).set(updates).where(eq(scheduledMeetings.id, id)).returning();
    return updated;
  }

  // Arrest Documents Methods
  async getArrestDocuments(arrestRecordId: string): Promise<ArrestDocument[]> {
    return await db
      .select()
      .from(arrestDocuments)
      .where(eq(arrestDocuments.arrestRecordId, arrestRecordId))
      .orderBy(desc(arrestDocuments.createdAt));
  }

  async getArrestDocument(id: string): Promise<ArrestDocument | undefined> {
    const [document] = await db
      .select()
      .from(arrestDocuments)
      .where(eq(arrestDocuments.id, id))
      .limit(1);
    return document;
  }

  async createArrestDocument(document: InsertArrestDocument): Promise<ArrestDocument> {
    const [created] = await db
      .insert(arrestDocuments)
      .values(document)
      .returning();
    return created;
  }

  async updateArrestDocument(
    id: string,
    updates: Partial<Omit<ArrestDocument, "id" | "createdAt">>
  ): Promise<ArrestDocument | undefined> {
    const [updated] = await db
      .update(arrestDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(arrestDocuments.id, id))
      .returning();
    return updated;
  }

  // Court Dockets Methods
  async getCourtDockets(arrestRecordId: string): Promise<CourtDocket[]> {
    return await db
      .select()
      .from(courtDockets)
      .where(eq(courtDockets.arrestRecordId, arrestRecordId))
      .orderBy(desc(courtDockets.createdAt));
  }

  async getCourtDocket(id: string): Promise<CourtDocket | undefined> {
    const [docket] = await db
      .select()
      .from(courtDockets)
      .where(eq(courtDockets.id, id))
      .limit(1);
    return docket;
  }

  async createCourtDocket(docket: InsertCourtDocket): Promise<CourtDocket> {
    const [created] = await db
      .insert(courtDockets)
      .values(docket)
      .returning();
    return created;
  }

  async updateCourtDocket(
    id: string,
    updates: Partial<Omit<CourtDocket, "id" | "createdAt">>
  ): Promise<CourtDocket | undefined> {
    const [updated] = await db
      .update(courtDockets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(courtDockets.id, id))
      .returning();
    return updated;
  }

  // Agent Interactions Methods (oldest first for chronological conversation)
  async getAgentInteractions(sessionId?: string, arrestRecordId?: string, userId?: string): Promise<AgentInteraction[]> {
    const conditions = [];
    if (sessionId) {
      conditions.push(eq(agentInteractions.sessionId, sessionId));
    }
    if (arrestRecordId) {
      conditions.push(eq(agentInteractions.arrestRecordId, arrestRecordId));
    }
    if (userId) {
      conditions.push(eq(agentInteractions.userId, userId));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    return await db
      .select()
      .from(agentInteractions)
      .where(whereClause)
      .orderBy(agentInteractions.createdAt); // ASC for conversation flow
  }

  async createAgentInteraction(interaction: InsertAgentInteraction): Promise<AgentInteraction> {
    const [created] = await db
      .insert(agentInteractions)
      .values(interaction)
      .returning();
    return created;
  }

  async deleteAgentInteractions(sessionId: string): Promise<number> {
    const result = await db
      .delete(agentInteractions)
      .where(eq(agentInteractions.sessionId, sessionId));
    return result.rowCount || 0;
  }

  async getSessionOwner(sessionId: string): Promise<string | null> {
    const [interaction] = await db
      .select({ userId: agentInteractions.userId })
      .from(agentInteractions)
      .where(eq(agentInteractions.sessionId, sessionId))
      .limit(1);
    return interaction?.userId || null;
  }

  // Delivery Logs Methods
  async getDeliveryLogs(filters?: { deliveryType?: string; status?: string }): Promise<DeliveryLog[]> {
    const conditions = [];
    if (filters?.deliveryType) {
      conditions.push(eq(deliveryLogs.deliveryType, filters.deliveryType));
    }
    if (filters?.status) {
      conditions.push(eq(deliveryLogs.status, filters.status));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    return await db
      .select()
      .from(deliveryLogs)
      .where(whereClause)
      .orderBy(desc(deliveryLogs.createdAt));
  }

  async getDeliveryLog(id: string): Promise<DeliveryLog | undefined> {
    const [log] = await db
      .select()
      .from(deliveryLogs)
      .where(eq(deliveryLogs.id, id))
      .limit(1);
    return log;
  }

  async createDeliveryLog(log: InsertDeliveryLog): Promise<DeliveryLog> {
    const [created] = await db
      .insert(deliveryLogs)
      .values(log)
      .returning();
    return created;
  }

  async updateDeliveryLog(
    id: string,
    updates: Partial<Omit<DeliveryLog, "id" | "createdAt">>
  ): Promise<DeliveryLog | undefined> {
    const [updated] = await db
      .update(deliveryLogs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(deliveryLogs.id, id))
      .returning();
    return updated;
  }

  // Notification History Methods
  async getNotificationHistory(filters?: { notificationType?: string; channel?: string }): Promise<NotificationHistory[]> {
    const conditions = [];
    if (filters?.notificationType) {
      conditions.push(eq(notificationHistory.notificationType, filters.notificationType));
    }
    if (filters?.channel) {
      conditions.push(eq(notificationHistory.channel, filters.channel));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    return await db
      .select()
      .from(notificationHistory)
      .where(whereClause)
      .orderBy(desc(notificationHistory.createdAt));
  }

  async createNotificationHistory(notification: InsertNotificationHistory): Promise<NotificationHistory> {
    const [created] = await db
      .insert(notificationHistory)
      .values(notification)
      .returning();
    return created;
  }

  async updateNotificationHistory(
    id: string,
    updates: Partial<Omit<NotificationHistory, "id" | "createdAt">>
  ): Promise<NotificationHistory | undefined> {
    const [updated] = await db
      .update(notificationHistory)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notificationHistory.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DbStorage();
