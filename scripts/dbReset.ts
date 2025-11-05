/**
 * Database Reset Script
 * 
 * WARNING: This script drops all tables and recreates the schema.
 * Use with caution - all data will be lost!
 * 
 * Run with: npx tsx scripts/dbReset.ts --confirm
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

const args = process.argv.slice(2);
const confirmed = args.includes("--confirm");

async function resetDatabase() {
  if (!confirmed) {
    console.log("\n⚠️  WARNING: This will DELETE ALL DATA in the database!\n");
    console.log("To confirm, run:");
    console.log("  npx tsx scripts/dbReset.ts --confirm\n");
    process.exit(1);
  }

  console.log("\n💣 Database Reset - DELETING ALL DATA\n");

  try {
    // Get all table names
    console.log("Fetching table names...");
    const tables = await db.execute(sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);

    if (tables.rows.length === 0) {
      console.log("  ℹ️  No tables found, database already empty");
      return;
    }

    console.log(`  Found ${tables.rows.length} tables to drop\n`);

    // Drop all tables
    for (const row of tables.rows) {
      const tableName = row.tablename as string;
      console.log(`  Dropping table: ${tableName}...`);
      await db.execute(sql.raw(`DROP TABLE IF EXISTS "${tableName}" CASCADE`));
    }

    console.log("\n✅ All tables dropped successfully\n");

    // Recreate schema using Drizzle
    console.log("Recreating schema...");
    console.log("  Run: npm run db:push\n");
    console.log("  Or: npx drizzle-kit push\n");

    console.log("Done! Database has been reset.");
    console.log("\nNext steps:");
    console.log("  1. Run: npm run db:push");
    console.log("  2. (Optional) Run: npx tsx scripts/seed.ts\n");

  } catch (error: any) {
    console.error("\n❌ Database reset failed:", error.message);
    throw error;
  }
}

// Confirm with user one more time
if (confirmed) {
  console.log("\n" + "=".repeat(60));
  console.log("  ⚠️  FINAL WARNING ⚠️");
  console.log("=".repeat(60));
  console.log("\nThis action is IRREVERSIBLE and will:");
  console.log("  • Delete ALL arrest records");
  console.log("  • Delete ALL scrape jobs");
  console.log("  • Delete ALL CRM prospects");
  console.log("  • Delete ALL campaigns");
  console.log("  • Delete ALL scheduled meetings");
  console.log("  • Delete ALL duplicate candidates");
  console.log("\nContinuing in 5 seconds... (Ctrl+C to cancel)");
  console.log("");

  setTimeout(() => {
    resetDatabase()
      .then(() => {
        console.log("\n👋 Reset complete, exiting...");
        process.exit(0);
      })
      .catch((error) => {
        console.error("\n❌ Reset failed:", error);
        process.exit(1);
      });
  }, 5000);
} else {
  resetDatabase().catch(() => process.exit(1));
}
