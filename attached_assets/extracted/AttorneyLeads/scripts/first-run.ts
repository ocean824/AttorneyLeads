/**
 * First-Run Initializer Script
 * 
 * Automated setup for new AttorneyLeads deployments:
 * - Checks environment variables
 * - Initializes database schema
 * - Seeds initial data
 * - Validates configuration
 * 
 * Run with: npx tsx scripts/first-run.ts
 */

import { logger } from "../server/logger";

async function firstRun() {
  console.log("\n🚀 AttorneyLeads First-Run Initializer\n");
  console.log("=" .repeat(60));
  
  let hasErrors = false;

  // Step 1: Check environment variables
  console.log("\n📋 Step 1: Checking environment variables...");
  
  const requiredVars = [
    "DATABASE_URL",
    "AI_INTEGRATIONS_OPENAI_API_KEY",
    "AI_INTEGRATIONS_OPENAI_BASE_URL",
    "SESSION_SECRET",
  ];

  const missingVars: string[] = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      console.log(`  ✗ ${varName}: MISSING`);
      missingVars.push(varName);
      hasErrors = true;
    } else {
      const value = process.env[varName]!;
      const masked = `${value.substring(0, 8)}...${value.substring(value.length - 4)}`;
      console.log(`  ✓ ${varName}: ${masked}`);
    }
  }

  if (missingVars.length > 0) {
    console.log(`\n❌ Missing required variables: ${missingVars.join(", ")}`);
    console.log("\nPlease add these to Replit Secrets:");
    console.log("  1. Click on 'Secrets' in the left sidebar");
    console.log("  2. Add each missing variable");
    console.log("  3. See .env.example for reference values\n");
    process.exit(1);
  }

  // Step 2: Test database connection
  console.log("\n🔌 Step 2: Testing database connection...");
  
  try {
    const { db } = await import("../server/db");
    const { sql } = await import("drizzle-orm");
    
    await db.execute(sql`SELECT 1 as test`);
    console.log("  ✓ Database connection successful");
  } catch (error: any) {
    console.log(`  ✗ Database connection failed: ${error.message}`);
    console.log("\nTroubleshooting:");
    console.log("  1. Verify DATABASE_URL is correct");
    console.log("  2. Ensure Neon database is active");
    console.log("  3. Check network connectivity\n");
    hasErrors = true;
  }

  if (hasErrors) {
    process.exit(1);
  }

  // Step 3: Initialize database schema
  console.log("\n📊 Step 3: Initializing database schema...");
  
  try {
    const { execSync } = await import("child_process");
    
    console.log("  Running: npm run db:push");
    execSync("npm run db:push", { 
      stdio: "inherit",
      env: process.env,
    });
    
    console.log("  ✓ Database schema initialized");
  } catch (error: any) {
    console.log(`  ⚠️  Schema push encountered issues`);
    console.log("  You may need to run: npm run db:push --force");
    console.log("  Or manually verify schema in database\n");
  }

  // Step 4: Seed initial data
  console.log("\n🌱 Step 4: Seeding database with sample data...");
  
  const shouldSeed = process.argv.includes("--seed");
  
  if (!shouldSeed) {
    console.log("  ⏭️  Skipping seed (use --seed flag to enable)");
  } else {
    try {
      const { execSync } = await import("child_process");
      
      console.log("  Running: npx tsx scripts/seed.ts");
      execSync("npx tsx scripts/seed.ts", {
        stdio: "inherit",
        env: process.env,
      });
      
      console.log("  ✓ Database seeded successfully");
    } catch (error: any) {
      console.log(`  ⚠️  Seeding encountered issues: ${error.message}`);
      console.log("  Database is ready but no sample data added");
    }
  }

  // Step 5: Test API endpoints
  console.log("\n🔍 Step 5: Testing API endpoints...");
  
  try {
    const PORT = process.env.PORT || "5000";
    const BASE_URL = `http://localhost:${PORT}`;
    
    // Give server a moment to start if running
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const healthResponse = await fetch(`${BASE_URL}/healthz`);
    
    if (healthResponse.ok) {
      console.log(`  ✓ /healthz: ${healthResponse.status}`);
    } else {
      console.log(`  ⚠️  /healthz: ${healthResponse.status}`);
    }
  } catch (error: any) {
    console.log(`  ℹ️  API endpoints not yet available (server may not be running)`);
    console.log(`  Start server with: npm run dev`);
  }

  // Step 6: Summary
  console.log("\n" + "=".repeat(60));
  console.log("\n✅ First-run initialization complete!\n");
  
  console.log("Next steps:");
  console.log("  1. Start the development server:");
  console.log("     npm run dev");
  console.log("\n  2. Open the application:");
  console.log("     Click 'Webview' or visit port 5000");
  console.log("\n  3. (Optional) Run smoke tests:");
  console.log("     npx tsx scripts/smoke-test.ts");
  console.log("\n  4. (Optional) Check environment:");
  console.log("     npx tsx scripts/envDoctor.ts");
  
  console.log("\n📚 Documentation:");
  console.log("  - Architecture: docs/ARCHITECTURE.md");
  console.log("  - Operations: docs/OPERATIONS.md");
  console.log("  - Security: docs/SECURITY.md");
  console.log("  - Deployment: docs/DEPLOY_REPLIT.md");
  
  console.log("\n🎉 AttorneyLeads is ready to use!\n");
}

// Run first-run initialization
firstRun()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error("first_run_failed", {
      errorMessage: error.message,
      stack: error.stack,
    });
    console.error("\n❌ First-run initialization failed:", error.message);
    process.exit(1);
  });
