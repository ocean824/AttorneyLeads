/**
 * Database Seeding Script
 * 
 * Seeds the database with sample data for development and testing.
 * Run with: npx tsx scripts/seed.ts
 */

import { db } from "../server/db";
import { arrestRecords, scrapeJobs, crmProspects, outreachCampaigns, scheduledMeetings } from "../shared/schema";
import { calculateLeadScore, getScoreLabel } from "../server/lead-scoring";

async function seed() {
  console.log("🌱 Seeding database...\n");

  try {
    // 1. Create sample scrape jobs
    console.log("Creating scrape jobs...");
    const jobIds = [];
    
    const job1 = await db.insert(scrapeJobs).values({
      jobId: `job-seed-${Date.now()}-1`,
      counties: ["Miami-Dade", "Broward"],
      status: "completed",
      recordsFound: 25,
      aiEnrichmentEnabled: true,
      aiRecordsProcessed: 25,
      aiRecordsTotal: 25,
      startedAt: new Date(Date.now() - 86400000), // 1 day ago
      completedAt: new Date(Date.now() - 86100000), // 23.5 hours ago
      duration: 120,
    }).returning();
    
    jobIds.push(job1[0].id);
    console.log(`  ✓ Created job: ${job1[0].jobId}`);

    const job2 = await db.insert(scrapeJobs).values({
      jobId: `job-seed-${Date.now()}-2`,
      counties: ["Palm Beach", "Orange"],
      status: "completed",
      recordsFound: 18,
      aiEnrichmentEnabled: false,
      aiRecordsProcessed: 0,
      aiRecordsTotal: 0,
      startedAt: new Date(Date.now() - 7200000), // 2 hours ago
      completedAt: new Date(Date.now() - 6900000), // 1.9 hours ago
      duration: 90,
    }).returning();
    
    jobIds.push(job2[0].id);
    console.log(`  ✓ Created job: ${job2[0].jobId}`);

    // 2. Create sample arrest records
    console.log("\nCreating arrest records...");
    const sampleRecords = [
      {
        jobId: jobIds[0],
        fullName: "John Smith",
        bookingNumber: "24-MD-12345",
        bookingDate: new Date(Date.now() - 86400000),
        charges: ["Aggravated Assault", "Battery"],
        bondAmount: 50000,
        age: 32,
        gender: "M",
        race: "White",
        county: "Miami-Dade",
        facility: "Miami-Dade County Jail",
        aiEnhanced: true,
        chargeCategories: ["Violent"],
        normalizedCharges: ["Assault (Aggravated)", "Battery (Simple)"],
        riskLevel: "High",
        confidenceScore: 92,
      },
      {
        jobId: jobIds[0],
        fullName: "Maria Garcia",
        bookingNumber: "24-MD-12346",
        bookingDate: new Date(Date.now() - 82800000),
        charges: ["Possession of Controlled Substance", "Drug Paraphernalia"],
        bondAmount: 5000,
        age: 28,
        gender: "F",
        race: "Hispanic",
        county: "Miami-Dade",
        facility: "Miami-Dade County Jail",
        aiEnhanced: true,
        chargeCategories: ["Drug"],
        normalizedCharges: ["Drug Possession (Controlled Substance)"],
        riskLevel: "Medium",
        confidenceScore: 88,
      },
      {
        jobId: jobIds[0],
        fullName: "Robert Johnson",
        bookingNumber: "24-BR-45678",
        bookingDate: new Date(Date.now() - 79200000),
        charges: ["Burglary of Dwelling", "Grand Theft Auto"],
        bondAmount: 75000,
        age: 41,
        gender: "M",
        race: "Black",
        county: "Broward",
        facility: "Broward County Main Jail",
        aiEnhanced: true,
        chargeCategories: ["Property", "Violent"],
        normalizedCharges: ["Burglary (Dwelling)", "Theft (Grand - Auto)"],
        riskLevel: "High",
        confidenceScore: 95,
      },
      {
        jobId: jobIds[1],
        fullName: "Sarah Williams",
        bookingNumber: "24-PB-78901",
        bookingDate: new Date(Date.now() - 7200000),
        charges: ["DUI with Property Damage"],
        bondAmount: 2500,
        age: 26,
        gender: "F",
        race: "White",
        county: "Palm Beach",
        facility: "Palm Beach County Jail",
        aiEnhanced: false,
        chargeCategories: [],
        normalizedCharges: [],
        riskLevel: null,
        confidenceScore: null,
      },
      {
        jobId: jobIds[1],
        fullName: "Michael Brown",
        bookingNumber: "24-OR-23456",
        bookingDate: new Date(Date.now() - 3600000),
        charges: ["Domestic Battery", "Violation of Injunction"],
        bondAmount: 10000,
        age: 35,
        gender: "M",
        race: "Hispanic",
        county: "Orange",
        facility: "Orange County Jail",
        aiEnhanced: false,
        chargeCategories: [],
        normalizedCharges: [],
        riskLevel: null,
        confidenceScore: null,
      },
    ];

    for (const record of sampleRecords) {
      const leadScore = calculateLeadScore({
        charges: record.charges,
        bondAmount: record.bondAmount,
        age: record.age,
      });

      const created = await db.insert(arrestRecords).values({
        ...record,
        leadScore: leadScore.score,
        scoreLabel: leadScore.label,
      }).returning();

      console.log(`  ✓ Created record: ${created[0].fullName} (Score: ${leadScore.score}/${leadScore.label})`);
    }

    // 3. Create sample CRM prospects
    console.log("\nCreating CRM prospects...");
    const sampleProspects = [
      {
        fullName: "Jennifer Martinez",
        email: "jmartinez@smithlawgroup.com",
        company: "Smith Law Group",
        phone: "+1-305-555-0101",
        linkedinUrl: "https://linkedin.com/in/jennifermartinez",
        source: "linkedin",
        status: "contacted",
        tags: ["criminal-defense", "miami"],
        notes: "Referred by John Smith case",
        lastContactedAt: new Date(Date.now() - 172800000), // 2 days ago
      },
      {
        fullName: "David Chen",
        email: "dchen@chendefense.com",
        company: "Chen Defense Attorneys",
        phone: "+1-954-555-0202",
        linkedinUrl: "https://linkedin.com/in/davidchen",
        source: "phantombuster",
        status: "new",
        tags: ["criminal-defense", "broward"],
        notes: "PhantomBuster LinkedIn discovery - high engagement",
      },
      {
        fullName: "Lisa Thompson",
        email: "lthompson@thompsonlaw.com",
        company: "Thompson Law Firm",
        phone: "+1-561-555-0303",
        source: "manual",
        status: "meeting_scheduled",
        tags: ["criminal-defense", "palm-beach", "vip"],
        notes: "Demo scheduled for next week",
        lastContactedAt: new Date(Date.now() - 259200000), // 3 days ago
      },
    ];

    for (const prospect of sampleProspects) {
      const created = await db.insert(crmProspects).values(prospect).returning();
      console.log(`  ✓ Created prospect: ${created[0].fullName} (${created[0].status})`);
    }

    // 4. Create sample outreach campaigns
    console.log("\nCreating outreach campaigns...");
    const sampleCampaigns = [
      {
        name: "Miami Defense Attorney Outreach Q4 2025",
        platform: "email",
        status: "active",
        targetAudience: "Criminal defense attorneys in Miami-Dade County",
        messageTemplate: "Hi {name}, I noticed you handle criminal defense cases...",
        sentCount: 47,
        responseCount: 12,
      },
      {
        name: "LinkedIn Broward County Attorneys",
        platform: "linkedin",
        status: "active",
        targetAudience: "Solo practitioners and small firms in Broward",
        messageTemplate: "Hi {name}, great to connect! I work with attorneys...",
        sentCount: 23,
        responseCount: 5,
      },
    ];

    for (const campaign of sampleCampaigns) {
      const created = await db.insert(outreachCampaigns).values(campaign).returning();
      console.log(`  ✓ Created campaign: ${created[0].name} (${created[0].sentCount} sent)`);
    }

    // 5. Create sample scheduled meetings
    console.log("\nCreating scheduled meetings...");
    const sampleMeetings = [
      {
        prospectEmail: "lthompson@thompsonlaw.com",
        prospectName: "Lisa Thompson",
        meetingType: "demo",
        calendlyEventUri: "https://api.calendly.com/scheduled_events/seed-123",
        scheduledAt: new Date(Date.now() + 604800000), // 1 week from now
        status: "scheduled",
        meetingUrl: "https://zoom.us/j/123456789",
        notes: "Demo of full platform features",
      },
      {
        prospectEmail: "jmartinez@smithlawgroup.com",
        prospectName: "Jennifer Martinez",
        meetingType: "consultation",
        calendlyEventUri: "https://api.calendly.com/scheduled_events/seed-456",
        scheduledAt: new Date(Date.now() + 259200000), // 3 days from now
        status: "scheduled",
        meetingUrl: "https://meet.google.com/abc-defg-hij",
        notes: "Follow-up consultation",
      },
    ];

    for (const meeting of sampleMeetings) {
      const created = await db.insert(scheduledMeetings).values(meeting).returning();
      const date = new Date(created[0].scheduledAt).toLocaleDateString();
      console.log(`  ✓ Created meeting: ${created[0].prospectName} on ${date}`);
    }

    console.log("\n✅ Database seeded successfully!");
    console.log("\nSummary:");
    console.log(`  - 2 scrape jobs`);
    console.log(`  - 5 arrest records (3 AI-enhanced)`);
    console.log(`  - 3 CRM prospects`);
    console.log(`  - 2 outreach campaigns`);
    console.log(`  - 2 scheduled meetings`);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

// Run the seed function
seed()
  .then(() => {
    console.log("\n👋 Seeding complete, exiting...");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  });
