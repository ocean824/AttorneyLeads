import { db } from "./db";
import { arrestRecords } from "@shared/schema";
import { calculateLeadScore } from "./lead-scoring";
import { eq } from "drizzle-orm";

async function updateExistingScores() {
  console.log("Fetching all arrest records...");
  const records = await db.select().from(arrestRecords);
  
  console.log(`Found ${records.length} records. Updating scores...`);
  
  let updated = 0;
  for (const record of records) {
    const score = calculateLeadScore({
      charges: record.charges,
      bondAmount: record.bondAmount,
      age: record.age,
      county: record.county,
    });
    
    await db
      .update(arrestRecords)
      .set({ leadScore: score })
      .where(eq(arrestRecords.id, record.id));
    
    updated++;
    if (updated % 10 === 0) {
      console.log(`Updated ${updated}/${records.length} records...`);
    }
  }
  
  console.log(`✅ Successfully updated ${updated} records with lead scores`);
  process.exit(0);
}

updateExistingScores().catch((error) => {
  console.error("Error updating scores:", error);
  process.exit(1);
});
