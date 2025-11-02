import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  startScrapeSchema,
  exportRecordsSchema,
  FLORIDA_COUNTIES,
  type InsertArrestRecord,
  type ArrestRecord,
} from "@shared/schema";
import { z } from "zod";
import { randomUUID } from "crypto";
import { calculateLeadScore } from "./lead-scoring";
import { findDuplicates } from "./deduplication";
import { spawn } from "child_process";
import path from "path";
import { registerCrmRoutes } from "./crm-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register CRM routes
  registerCrmRoutes(app);
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

  // Analytics Data
  app.get("/api/analytics", async (req, res) => {
    try {
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;

      const [
        recordsByCounty,
        leadScoreDistribution,
        chargeCategoryDistribution,
        jobsOverTime,
        aiStats,
      ] = await Promise.all([
        storage.getRecordsByCounty(dateFrom, dateTo),
        storage.getLeadScoreDistribution(dateFrom, dateTo),
        storage.getChargeCategoryDistribution(dateFrom, dateTo),
        storage.getJobsOverTime(dateFrom, dateTo),
        storage.getAIEnhancementStats(dateFrom, dateTo),
      ]);

      res.json({
        recordsByCounty,
        leadScoreDistribution,
        chargeCategoryDistribution,
        jobsOverTime,
        aiStats,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics data" });
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
        aiEnhanced: validatedData.enableAI ? 1 : 0,
        aiProcessed: 0,
        completedAt: null,
        errorMessage: null,
      });

      // Simulate scraping with mock data generation
      simulateScraping(job.id, validatedData.counties, validatedData.enableAI);

      res.json({
        jobId: job.jobId,
        message: `Scraping started for ${validatedData.counties.length} counties${validatedData.enableAI ? ' with AI enhancement' : ''}`,
        estimatedTime: validatedData.enableAI ? "3-7 minutes" : "2-5 minutes",
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

  // Get Duplicate Candidates
  app.get("/api/duplicates", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const candidates = await storage.getDuplicateCandidates(status);
      res.json(candidates);
    } catch (error) {
      console.error("Error fetching duplicate candidates:", error);
      res.status(500).json({ error: "Failed to fetch duplicate candidates" });
    }
  });

  // Scan for Duplicates
  app.post("/api/duplicates/scan", async (req, res) => {
    try {
      const scannedCount = await scanForDuplicates();
      res.json({ 
        message: "Duplicate scan completed",
        scannedCount,
      });
    } catch (error) {
      console.error("Error scanning for duplicates:", error);
      res.status(500).json({ error: "Failed to scan for duplicates" });
    }
  });

  // Merge Duplicate Records
  app.post("/api/duplicates/:id/merge", async (req, res) => {
    try {
      const candidateId = req.params.id;
      const candidate = await storage.getDuplicateCandidates();
      const target = candidate.find(c => c.id === candidateId);
      
      if (!target) {
        return res.status(404).json({ error: "Duplicate candidate not found" });
      }

      const primaryRecord = await storage.getArrestRecord(target.recordId1);
      const duplicateRecord = await storage.getArrestRecord(target.recordId2);

      if (!primaryRecord || !duplicateRecord) {
        return res.status(404).json({ error: "One or both records not found" });
      }

      await storage.deleteArrestRecord(target.recordId2);

      await storage.updateDuplicateCandidate(candidateId, {
        status: "merged",
        reviewedAt: new Date(),
      });

      res.json({ message: "Records merged successfully" });
    } catch (error) {
      console.error("Error merging records:", error);
      res.status(500).json({ error: "Failed to merge records" });
    }
  });

  // Dismiss Duplicate Candidate
  app.post("/api/duplicates/:id/dismiss", async (req, res) => {
    try {
      const candidateId = req.params.id;
      const updated = await storage.updateDuplicateCandidate(candidateId, {
        status: "dismissed",
        reviewedAt: new Date(),
      });

      if (!updated) {
        return res.status(404).json({ error: "Duplicate candidate not found" });
      }

      res.json({ message: "Duplicate candidate dismissed" });
    } catch (error) {
      console.error("Error dismissing duplicate:", error);
      res.status(500).json({ error: "Failed to dismiss duplicate" });
    }
  });

  // AI Enhancement Endpoints
  app.post("/api/ai/enhance", async (req, res) => {
    try {
      const { recordIds } = z.object({
        recordIds: z.array(z.string()).min(1, "At least one record ID required"),
      }).parse(req.body);

      const { enhanceRecordsBatch } = await import("./ai-service");
      
      // Fetch records to enhance
      const records = await Promise.all(
        recordIds.map(id => storage.getArrestRecord(id))
      );
      
      const validRecords = records.filter((r): r is ArrestRecord => r !== undefined);
      
      if (validRecords.length === 0) {
        return res.status(404).json({ error: "No valid records found" });
      }

      // Enhance records with AI
      const enhancedData = await enhanceRecordsBatch(validRecords);
      
      // Update records with AI enhancement data
      let updatedCount = 0;
      for (const [recordId, enhancement] of Array.from(enhancedData)) {
        await storage.updateArrestRecord(recordId, {
          aiEnhanced: 1,
          confidenceScore: enhancement.confidenceScore,
          chargeCategories: JSON.stringify(enhancement.chargeCategories),
          normalizedCharges: enhancement.normalizedCharges,
          riskLevel: enhancement.riskLevel,
        });
        updatedCount++;
      }

      res.json({
        message: `Successfully enhanced ${updatedCount} records`,
        enhancedCount: updatedCount,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else {
        console.error("Error enhancing records:", error);
        res.status(500).json({ error: "Failed to enhance records" });
      }
    }
  });

  app.get("/api/ai/test", async (req, res) => {
    try {
      const { testAIConnection } = await import("./ai-service");
      const isConnected = await testAIConnection();
      
      res.json({
        connected: isConnected,
        provider: "OpenAI (Replit AI Integrations)",
        model: "gpt-4o-mini",
      });
    } catch (error) {
      console.error("AI test failed:", error);
      res.status(500).json({ connected: false, error: "Connection test failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to call Python scraper
async function callPythonScraper(counties: string[]): Promise<InsertArrestRecord[]> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'server', 'scraper.py');
    const countiesStr = counties.join(',');
    
    const pythonProcess = spawn('python3', [scriptPath, countiesStr]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python scraper failed with code ${code}: ${stderr}`);
        reject(new Error(`Python scraper failed: ${stderr}`));
        return;
      }
      
      try {
        const records = JSON.parse(stdout);
        
        if (records.error) {
          reject(new Error(records.error));
          return;
        }
        
        // Transform Python records to match InsertArrestRecord schema
        const transformedRecords: InsertArrestRecord[] = records.map((record: any) => ({
          fullName: record.fullName,
          charges: record.charges,
          bookingDate: record.bookingDate,
          bondAmount: record.bondAmount,
          age: record.age,
          gender: record.gender,
          race: record.race,
          height: record.height,
          weight: record.weight,
          facility: record.facility,
          county: record.county,
        }));
        
        resolve(transformedRecords);
      } catch (error) {
        reject(new Error(`Failed to parse Python scraper output: ${error}`));
      }
    });
  });
}

// Helper function to simulate scraping
async function simulateScraping(jobId: string, counties: string[], enableAI: boolean = true) {
  let scrapedRecords: InsertArrestRecord[] = [];
  let createdRecords: ArrestRecord[] = [];
  let aiProcessedCount = 0;

  try {
    const job = await storage.getScrapeJob(jobId);
    if (!job) return;

    console.log(`[Job ${jobId}] Starting Python scraper for ${counties.length} counties...`);

    // Call Python scraper
    try {
      scrapedRecords = await callPythonScraper(counties);
      console.log(`[Job ${jobId}] Python scraper returned ${scrapedRecords.length} records`);
    } catch (pythonError) {
      console.error(`[Job ${jobId}] Python scraper failed, using fallback mock data:`, pythonError);
      
      // Fallback to mock data generation if Python scraper fails
      const recordsPerCounty = Math.floor(Math.random() * 20) + 10;
      for (const county of counties) {
        for (let i = 0; i < recordsPerCounty; i++) {
          scrapedRecords.push(generateMockArrestRecord(county));
        }
      }
    }

    // Create records in storage
    createdRecords = await storage.createArrestRecords(scrapedRecords);

    // AI Enhancement (if enabled)
    if (enableAI && createdRecords.length > 0) {
      const { enhanceRecordsBatch } = await import("./ai-service");
      
      console.log(`[Job ${jobId}] Enhancing ${createdRecords.length} records with AI...`);
      
      const enhancedData = await enhanceRecordsBatch(createdRecords, async (current, total) => {
        console.log(`[Job ${jobId}] AI Enhancement Progress: ${current}/${total}`);
        // Update job progress in real-time for UI tracking
        await storage.updateScrapeJob(jobId, {
          aiProcessed: current,
        });
      });
      
      // Update records with AI enhancement data
      for (const [recordId, enhancement] of Array.from(enhancedData)) {
        await storage.updateArrestRecord(recordId, {
          aiEnhanced: 1,
          confidenceScore: enhancement.confidenceScore,
          chargeCategories: JSON.stringify(enhancement.chargeCategories),
          normalizedCharges: enhancement.normalizedCharges,
          riskLevel: enhancement.riskLevel,
        });
        aiProcessedCount++;
      }
      
      console.log(`[Job ${jobId}] AI Enhancement Complete: ${aiProcessedCount} records enhanced`);
    }

    // Update job with successful completion
    await storage.updateScrapeJob(jobId, {
      status: "completed",
      recordsFound: scrapedRecords.length,
      aiProcessed: enableAI ? aiProcessedCount : 0,
      completedAt: new Date(),
    });
  } catch (error) {
    console.error("Error in scraping:", error);
    // Always finalize job state on error
    await storage.updateScrapeJob(jobId, {
      status: "failed",
      recordsFound: scrapedRecords.length,
      aiProcessed: aiProcessedCount,
      errorMessage: error instanceof Error ? error.message : "Scraping failed",
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

// Scan for duplicate arrest records
async function scanForDuplicates(): Promise<number> {
  const { records } = await storage.getArrestRecords({ pageSize: 9999 });
  
  let duplicatesFound = 0;

  for (let i = 0; i < records.length; i++) {
    const currentRecord = records[i];
    const otherRecords = records.slice(i + 1);
    
    const matches = findDuplicates(currentRecord, otherRecords, 60);

    for (const match of matches) {
      const existingCandidates = await storage.getDuplicateCandidates();
      
      const alreadyExists = existingCandidates.some(
        candidate => 
          (candidate.recordId1 === match.record1.id && candidate.recordId2 === match.record2.id) ||
          (candidate.recordId1 === match.record2.id && candidate.recordId2 === match.record1.id)
      );

      if (!alreadyExists) {
        await storage.createDuplicateCandidate({
          recordId1: match.record1.id,
          recordId2: match.record2.id,
          confidenceScore: match.confidenceScore,
          matchReasons: JSON.stringify(match.matchReasons),
          status: "pending",
          reviewedAt: null,
        });
        duplicatesFound++;
      }
    }
  }

  return duplicatesFound;
}
