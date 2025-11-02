import {
  type ArrestRecord,
  type InsertArrestRecord,
  type ScrapeJob,
  type InsertScrapeJob,
  type CrmSyncLog,
  type InsertCrmSyncLog,
  type DuplicateCandidate,
  type InsertDuplicateCandidate,
  arrestRecords,
  scrapeJobs,
  crmSyncLog,
  duplicateCandidates,
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
}

export const storage = new DbStorage();
