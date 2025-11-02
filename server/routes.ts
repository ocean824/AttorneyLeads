import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  startScrapeSchema,
  exportRecordsSchema,
  FLORIDA_COUNTIES,
  type InsertArrestRecord,
} from "@shared/schema";
import { z } from "zod";
import { randomUUID } from "crypto";
import { calculateLeadScore } from "./lead-scoring";

export async function registerRoutes(app: Express): Promise<Server> {
  // Dashboard Stats
  app.get("/api/stats", async (req, res) => {
    try {
      const totalRecords = await storage.getTotalRecordsCount();
      const activeJobs = await storage.getActiveJobsCount();
      const lastScrapeDate = await storage.getLastScrapeDate();
      const exportCount = await storage.getTotalExportsCount();

      res.json({
        totalRecords,
        activeJobs,
        lastScrapeDate,
        exportCount,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Start Scraping Job
  app.post("/api/scrape/start", async (req, res) => {
    try {
      const validatedData = startScrapeSchema.parse(req.body);
      const jobId = randomUUID();

      // Create scrape job
      const job = await storage.createScrapeJob({
        jobId,
        counties: validatedData.counties.join(","),
        status: "running",
        recordsFound: 0,
        completedAt: null,
        errorMessage: null,
      });

      // Simulate scraping with mock data generation
      simulateScraping(job.id, validatedData.counties);

      res.json({
        jobId: job.jobId,
        message: `Scraping started for ${validatedData.counties.length} counties`,
        estimatedTime: "2-5 minutes",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else {
        console.error("Error starting scrape:", error);
        res.status(500).json({ error: "Failed to start scraping job" });
      }
    }
  });

  // Get All Scrape Jobs
  app.get("/api/scrape/jobs", async (req, res) => {
    try {
      const jobs = await storage.getScrapeJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Failed to fetch scrape jobs" });
    }
  });

  // Get Job Status
  app.get("/api/scrape/status/:jobId", async (req, res) => {
    try {
      const job = await storage.getScrapeJobByJobId(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job status:", error);
      res.status(500).json({ error: "Failed to fetch job status" });
    }
  });

  // Get Arrest Records (with pagination and filtering)
  app.get("/api/records", async (req, res) => {
    try {
      const filters = {
        county: req.query.county as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 20,
      };

      const { records, total } = await storage.getArrestRecords(filters);

      res.json({
        records,
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil(total / filters.pageSize),
      });
    } catch (error) {
      console.error("Error fetching records:", error);
      res.status(500).json({ error: "Failed to fetch arrest records" });
    }
  });

  // Get Single Arrest Record
  app.get("/api/records/:id", async (req, res) => {
    try {
      const record = await storage.getArrestRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ error: "Record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Error fetching record:", error);
      res.status(500).json({ error: "Failed to fetch arrest record" });
    }
  });

  // Export Records
  app.post("/api/records/bulk-export", async (req, res) => {
    try {
      const validatedData = exportRecordsSchema.parse(req.body);

      let records;
      if (validatedData.recordIds && validatedData.recordIds.length > 0) {
        // Export specific records
        const recordPromises = validatedData.recordIds.map((id) =>
          storage.getArrestRecord(id)
        );
        const fetchedRecords = await Promise.all(recordPromises);
        records = fetchedRecords.filter((r) => r !== undefined);
      } else {
        // Export all filtered records
        const { records: allRecords } = await storage.getArrestRecords({
          county: validatedData.filters?.county,
          dateFrom: validatedData.filters?.dateFrom,
          dateTo: validatedData.filters?.dateTo,
        });
        records = allRecords;
      }

      // Log the export
      await storage.createCrmSyncLog({
        recordCount: records.length,
        crmType: validatedData.format,
        status: "success",
        errorMessage: null,
      });

      // Generate export content
      let content: string;
      if (validatedData.format === "csv") {
        content = generateCSV(records);
      } else {
        content = JSON.stringify(records, null, 2);
      }

      res.json({
        count: records.length,
        content,
        format: validatedData.format,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else {
        console.error("Error exporting records:", error);
        res.status(500).json({ error: "Failed to export records" });
      }
    }
  });

  // Delete Arrest Record
  app.delete("/api/records/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteArrestRecord(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Record not found" });
      }
      res.json({ message: "Record deleted successfully" });
    } catch (error) {
      console.error("Error deleting record:", error);
      res.status(500).json({ error: "Failed to delete record" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to simulate scraping
async function simulateScraping(jobId: string, counties: string[]) {
  // Simulate delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    const job = await storage.getScrapeJob(jobId);
    if (!job) return;

    // Generate mock arrest records
    const recordsPerCounty = Math.floor(Math.random() * 20) + 10; // 10-30 records per county
    const mockRecords: InsertArrestRecord[] = [];

    for (const county of counties) {
      for (let i = 0; i < recordsPerCounty; i++) {
        mockRecords.push(generateMockArrestRecord(county));
      }
    }

    // Create records in storage
    await storage.createArrestRecords(mockRecords);

    // Update job status
    await storage.updateScrapeJob(jobId, {
      status: "completed",
      recordsFound: mockRecords.length,
      completedAt: new Date(),
    });
  } catch (error) {
    console.error("Error in simulated scraping:", error);
    await storage.updateScrapeJob(jobId, {
      status: "failed",
      errorMessage: "Scraping simulation failed",
      completedAt: new Date(),
    });
  }
}

// Generate mock arrest record
function generateMockArrestRecord(county: string): InsertArrestRecord {
  const firstNames = [
    "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph",
    "Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Elizabeth", "Susan", "Jessica"
  ];
  const lastNames = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas"
  ];
  const charges = [
    "DUI - First Offense",
    "Possession of Controlled Substance",
    "Domestic Battery",
    "Theft - Petit Theft",
    "Driving with Suspended License",
    "Resisting Arrest without Violence",
    "Disorderly Conduct",
    "Trespassing",
    "Battery - Simple",
    "Assault - Simple",
  ];
  const facilities = [
    `${county} County Jail`,
    `${county} Detention Center`,
    `${county} Correctional Facility`,
  ];

  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const fullName = `${firstName} ${lastName}`;
  const age = Math.floor(Math.random() * 50) + 18;
  const gender = Math.random() > 0.5 ? "Male" : "Female";
  const races = ["White", "Black", "Hispanic", "Asian", "Other"];
  const race = races[Math.floor(Math.random() * races.length)];

  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() - Math.floor(Math.random() * 30));

  const releaseDate = Math.random() > 0.3 ? new Date(bookingDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000) : null;

  const bondAmount = Math.random() > 0.2 ? `$${(Math.floor(Math.random() * 50) + 1) * 500}` : "No Bond";
  const selectedCharge = charges[Math.floor(Math.random() * charges.length)];

  // Calculate lead score based on arrest details
  const leadScore = calculateLeadScore({
    charges: selectedCharge,
    bondAmount,
    age,
    county,
  });

  return {
    inmateId: `INM${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
    fullName,
    firstName,
    lastName,
    bookingDate: bookingDate.toISOString(),
    releaseDate: releaseDate?.toISOString() || null,
    charges: selectedCharge,
    bondAmount,
    county,
    facility: facilities[Math.floor(Math.random() * facilities.length)],
    age,
    gender,
    race,
    scrapedDate: new Date().toISOString(),
    sourceUrl: `https://florida-arrests.gov/${county.toLowerCase().replace(/\s+/g, '-')}`,
    rawData: null,
    crmContactId: null,
    crmSyncDate: null,
    leadScore,
  };
}

// Generate CSV from arrest records
function generateCSV(records: any[]): string {
  if (records.length === 0) return "";

  const headers = [
    "Inmate ID",
    "Full Name",
    "First Name",
    "Last Name",
    "Booking Date",
    "Release Date",
    "Charges",
    "Bond Amount",
    "County",
    "Facility",
    "Age",
    "Gender",
    "Race",
    "Lead Score",
    "Source URL",
  ];

  const rows = records.map((record) => [
    record.inmateId || "",
    record.fullName || "",
    record.firstName || "",
    record.lastName || "",
    record.bookingDate || "",
    record.releaseDate || "",
    record.charges || "",
    record.bondAmount || "",
    record.county || "",
    record.facility || "",
    record.age || "",
    record.gender || "",
    record.race || "",
    record.leadScore || "0",
    record.sourceUrl || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
}
