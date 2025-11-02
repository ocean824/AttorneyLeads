import {
  type ArrestRecord,
  type InsertArrestRecord,
  type ScrapeJob,
  type InsertScrapeJob,
  type CrmSyncLog,
  type InsertCrmSyncLog,
} from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private arrestRecords: Map<string, ArrestRecord>;
  private scrapeJobs: Map<string, ScrapeJob>;
  private crmSyncLogs: Map<string, CrmSyncLog>;

  constructor() {
    this.arrestRecords = new Map();
    this.scrapeJobs = new Map();
    this.crmSyncLogs = new Map();
  }

  // Arrest Records Methods
  async getArrestRecords(filters?: {
    county?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ records: ArrestRecord[]; total: number }> {
    let records = Array.from(this.arrestRecords.values());

    // Apply filters
    if (filters?.county) {
      records = records.filter((r) => r.county === filters.county);
    }
    if (filters?.dateFrom) {
      records = records.filter(
        (r) => new Date(r.bookingDate) >= new Date(filters.dateFrom!)
      );
    }
    if (filters?.dateTo) {
      records = records.filter(
        (r) => new Date(r.bookingDate) <= new Date(filters.dateTo!)
      );
    }
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      records = records.filter(
        (r) =>
          r.fullName.toLowerCase().includes(searchLower) ||
          r.inmateId?.toLowerCase().includes(searchLower) ||
          r.charges.toLowerCase().includes(searchLower)
      );
    }

    const total = records.length;

    // Sort by booking date (newest first)
    records.sort(
      (a, b) =>
        new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
    );

    // Apply pagination
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 20;
    const start = (page - 1) * pageSize;
    const paginatedRecords = records.slice(start, start + pageSize);

    return { records: paginatedRecords, total };
  }

  async getArrestRecord(id: string): Promise<ArrestRecord | undefined> {
    return this.arrestRecords.get(id);
  }

  async createArrestRecord(
    insertRecord: InsertArrestRecord
  ): Promise<ArrestRecord> {
    const id = randomUUID();
    const record: ArrestRecord = {
      ...insertRecord,
      id,
      createdAt: new Date(),
    };
    this.arrestRecords.set(id, record);
    return record;
  }

  async createArrestRecords(
    insertRecords: InsertArrestRecord[]
  ): Promise<ArrestRecord[]> {
    const records = insertRecords.map((insertRecord) => {
      const id = randomUUID();
      const record: ArrestRecord = {
        ...insertRecord,
        id,
        createdAt: new Date(),
      };
      this.arrestRecords.set(id, record);
      return record;
    });
    return records;
  }

  async deleteArrestRecord(id: string): Promise<boolean> {
    return this.arrestRecords.delete(id);
  }

  async getTotalRecordsCount(): Promise<number> {
    return this.arrestRecords.size;
  }

  async getLastScrapeDate(): Promise<string | null> {
    const records = Array.from(this.arrestRecords.values());
    if (records.length === 0) return null;

    const sortedRecords = records.sort(
      (a, b) =>
        new Date(b.scrapedDate).getTime() - new Date(a.scrapedDate).getTime()
    );
    return sortedRecords[0].scrapedDate;
  }

  // Scrape Jobs Methods
  async getScrapeJobs(): Promise<ScrapeJob[]> {
    const jobs = Array.from(this.scrapeJobs.values());
    return jobs.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  async getScrapeJob(id: string): Promise<ScrapeJob | undefined> {
    return this.scrapeJobs.get(id);
  }

  async getScrapeJobByJobId(jobId: string): Promise<ScrapeJob | undefined> {
    return Array.from(this.scrapeJobs.values()).find(
      (job) => job.jobId === jobId
    );
  }

  async createScrapeJob(insertJob: InsertScrapeJob): Promise<ScrapeJob> {
    const id = randomUUID();
    const job: ScrapeJob = {
      ...insertJob,
      id,
      startedAt: new Date(),
      completedAt: null,
    };
    this.scrapeJobs.set(id, job);
    return job;
  }

  async updateScrapeJob(
    id: string,
    updates: Partial<Omit<ScrapeJob, "id" | "jobId" | "startedAt">>
  ): Promise<ScrapeJob | undefined> {
    const job = this.scrapeJobs.get(id);
    if (!job) return undefined;

    const updatedJob = { ...job, ...updates };
    this.scrapeJobs.set(id, updatedJob);
    return updatedJob;
  }

  async getActiveJobsCount(): Promise<number> {
    return Array.from(this.scrapeJobs.values()).filter(
      (job) => job.status === "running" || job.status === "pending"
    ).length;
  }

  // CRM Sync Log Methods
  async getCrmSyncLogs(): Promise<CrmSyncLog[]> {
    const logs = Array.from(this.crmSyncLogs.values());
    return logs.sort(
      (a, b) =>
        new Date(b.syncDate).getTime() - new Date(a.syncDate).getTime()
    );
  }

  async createCrmSyncLog(insertLog: InsertCrmSyncLog): Promise<CrmSyncLog> {
    const id = randomUUID();
    const log: CrmSyncLog = {
      ...insertLog,
      id,
      syncDate: new Date(),
    };
    this.crmSyncLogs.set(id, log);
    return log;
  }

  async getTotalExportsCount(): Promise<number> {
    return this.crmSyncLogs.size;
  }
}

export const storage = new MemStorage();
