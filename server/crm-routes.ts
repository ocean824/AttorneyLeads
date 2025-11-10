import type { Express } from "express";
import { storage } from "./storage";
import { 
  createProspectSchema,
  updateProspectSchema,
  sendOutreachSchema,
  scheduleMeetingSchema,
  syncSheetsSchema,
  type InsertCrmProspect 
} from "@shared/schema";
import { phantomBusterService } from "./phantombuster-service";
import { calendlyService } from "./calendly-service";
import { googleSheetsService } from "./sheets-service";
import { ensureAuthed } from "./middleware/ensureAdmin";

export function registerCrmRoutes(app: Express) {
  // All CRM endpoints require an authenticated session
  app.use("/api/crm", ensureAuthed);

  // Prospects Management
  app.get("/api/crm/prospects", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const source = req.query.source as string | undefined;
      const prospects = await storage.getCrmProspects({ status, source });
      res.json(prospects);
    } catch (error) {
      console.error("Error fetching prospects:", error);
      res.status(500).json({ error: "Failed to fetch prospects" });
    }
  });

  app.post("/api/crm/prospects", async (req, res) => {
    try {
      const validatedData = createProspectSchema.parse(req.body);
      const prospect: InsertCrmProspect = {
        fullName: validatedData.fullName,
        email: validatedData.email || null,
        company: validatedData.company || null,
        phone: validatedData.phone || null,
        linkedinUrl: null,
        source: validatedData.source || "manual",
        status: "new",
        tags: validatedData.tags ? JSON.stringify(validatedData.tags) : null,
        notes: null,
        lastContactedAt: null,
      };
      const created = await storage.createCrmProspect(prospect);
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating prospect:", error);
      res.status(400).json({ error: "Failed to create prospect" });
    }
  });

  app.patch("/api/crm/prospects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateProspectSchema.parse(req.body);
      const updated = await storage.updateCrmProspect(id, validatedData);
      if (!updated) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating prospect:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update prospect" });
    }
  });

  app.delete("/api/crm/prospects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCrmProspect(id);
      if (!deleted) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting prospect:", error);
      res.status(500).json({ error: "Failed to delete prospect" });
    }
  });

  // PhantomBuster Prospect Discovery
  app.post("/api/crm/discover", async (req, res) => {
    try {
      const { searchQuery, location, platform } = req.body;
      
      if (!searchQuery || !location) {
        return res.status(400).json({ error: "searchQuery and location are required" });
      }
      
      // Launch PhantomBuster agent
      const { containerId } = await phantomBusterService.launchProspectDiscovery({
        searchQuery,
        location,
        platform: platform || "linkedin",
      });

      res.json({ 
        message: "Prospect discovery started", 
        containerId,
        estimatedTime: "5-10 seconds"
      });

      // Process results asynchronously (don't block response)
      (async () => {
        try {
          // Wait for scraping to complete
          await new Promise(resolve => setTimeout(resolve, 5000));
          const prospects = await phantomBusterService.fetchResults(containerId);
          
          // Deduplicate by email before saving
          const existingProspects = await storage.getCrmProspects();
          const existingEmails = new Set(existingProspects.map(p => p.email?.toLowerCase()).filter(Boolean));
          
          for (const prospect of prospects) {
            const prospectEmail = prospect.email?.toLowerCase();
            if (!prospectEmail || existingEmails.has(prospectEmail)) {
              continue; // Skip duplicates
            }
            await storage.createCrmProspect(prospect as InsertCrmProspect);
            existingEmails.add(prospectEmail);
          }
        } catch (error) {
          console.error("Error fetching PhantomBuster results:", error);
        }
      })();
    } catch (error) {
      console.error("Error launching prospect discovery:", error);
      res.status(500).json({ error: "Failed to start prospect discovery" });
    }
  });

  // Outreach System
  app.post("/api/crm/outreach/send", async (req, res) => {
    try {
      const validatedData = sendOutreachSchema.parse(req.body);
      
      // Create prospect from form submission
      const prospect: InsertCrmProspect = {
        fullName: validatedData.fullName,
        email: validatedData.email,
        company: validatedData.company || null,
        phone: null,
        linkedinUrl: null,
        source: "form_submission",
        status: "contacted",
        tags: null,
        notes: validatedData.message || null,
        lastContactedAt: new Date(),
      };
      
      const created = await storage.createCrmProspect(prospect);
      
      // In production, integrate with email service (SendGrid, etc.)
      console.log(`📧 [OUTREACH] Would send email to ${validatedData.email}`);
      console.log(`📧 [OUTREACH] Message: ${validatedData.message || "Default template"}`);
      
      res.json({ 
        success: true, 
        message: "Outreach sent successfully",
        prospectId: created.id
      });
    } catch (error) {
      console.error("Error sending outreach:", error);
      res.status(400).json({ error: "Failed to send outreach" });
    }
  });

  // Campaigns
  app.get("/api/crm/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getOutreachCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  app.post("/api/crm/campaigns", async (req, res) => {
    try {
      const campaign = await storage.createOutreachCampaign(req.body);
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(400).json({ error: "Failed to create campaign" });
    }
  });

  // Meetings/Scheduling
  app.get("/api/crm/meetings", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const meetings = await storage.getScheduledMeetings({ status });
      res.json(meetings);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.post("/api/crm/meetings/schedule", async (req, res) => {
    try {
      const validatedData = scheduleMeetingSchema.parse(req.body);
      
      // Create Calendly scheduling link
      const { schedulingUrl } = await calendlyService.createSchedulingLink({
        prospectEmail: validatedData.prospectEmail,
        prospectName: validatedData.prospectName,
        eventType: validatedData.meetingType,
      });
      
      // Save meeting to database
      const meeting = await storage.createScheduledMeeting({
        prospectId: null,
        prospectEmail: validatedData.prospectEmail,
        prospectName: validatedData.prospectName,
        meetingType: validatedData.meetingType,
        scheduledAt: new Date(validatedData.scheduledAt),
        status: "scheduled",
        meetingUrl: schedulingUrl,
        calendlyEventUri: null,
        notes: null,
      });
      
      res.json({ 
        success: true, 
        meeting,
        schedulingUrl 
      });
    } catch (error) {
      console.error("Error scheduling meeting:", error);
      res.status(400).json({ error: "Failed to schedule meeting" });
    }
  });

  app.get("/api/crm/calendly/events", async (req, res) => {
    try {
      const eventTypes = await calendlyService.getEventTypes();
      res.json(eventTypes);
    } catch (error) {
      console.error("Error fetching Calendly events:", error);
      res.status(500).json({ error: "Failed to fetch event types" });
    }
  });

  // Google Sheets Sync
  app.post("/api/crm/sheets/sync-prospects", async (req, res) => {
    try {
      const validatedData = syncSheetsSchema.parse(req.body);
      
      const prospects = await storage.getCrmProspects();
      const result = await googleSheetsService.appendProspects({
        spreadsheetId: validatedData.spreadsheetId,
        sheetName: validatedData.sheetName,
        prospects,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Error syncing prospects to Sheets:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to sync prospects" });
    }
  });

  app.post("/api/crm/sheets/sync-records", async (req, res) => {
    try {
      const validatedData = syncSheetsSchema.parse(req.body);
      
      const { records } = await storage.getArrestRecords({ pageSize: 1000 });
      const result = await googleSheetsService.appendArrestRecords({
        spreadsheetId: validatedData.spreadsheetId,
        sheetName: validatedData.sheetName,
        records,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Error syncing records to Sheets:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to sync records" });
    }
  });
}
