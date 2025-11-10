/**
 * Environment Doctor Script
 * 
 * Checks environment configuration and validates all required secrets are set.
 * Run with: npx tsx scripts/envDoctor.ts
 */

const REQUIRED_VARS = [
  "DATABASE_URL",
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
  "SESSION_SECRET",
];

const OPTIONAL_VARS = [
  "PHANTOMBUSTER_API_KEY",
  "CALENDLY_API_KEY",
  "CALENDLY_USER_URI",
  "GOOGLE_SHEETS_TOKEN",
  "PORT",
  "NODE_ENV",
];

interface CheckResult {
  variable: string;
  present: boolean;
  value?: string;
  valid?: boolean;
  error?: string;
}

function checkEnvVar(name: string): CheckResult {
  const value = process.env[name];
  const present = !!value;

  if (!present) {
    return { variable: name, present: false };
  }

  // Basic validation based on variable name
  let valid = true;
  let error: string | undefined;

  switch (name) {
    case "DATABASE_URL":
      valid = value.startsWith("postgres://");
      if (!valid) error = "Must start with postgres://";
      break;

    case "AI_INTEGRATIONS_OPENAI_API_KEY":
      valid = value.startsWith("sk-");
      if (!valid) error = "Must start with sk-";
      break;

    case "AI_INTEGRATIONS_OPENAI_BASE_URL":
      valid = value.startsWith("https://");
      if (!valid) error = "Must be a valid HTTPS URL";
      break;

    case "SESSION_SECRET":
      valid = value.length >= 32;
      if (!valid) error = "Should be at least 32 characters";
      break;

    case "PORT":
      const port = parseInt(value, 10);
      valid = !isNaN(port) && port > 0 && port < 65536;
      if (!valid) error = "Must be a valid port number";
      break;

    case "CALENDLY_USER_URI":
      valid = value.includes("https://api.calendly.com/users/");
      if (!valid) error = "Must be a valid Calendly user URI";
      break;
  }

  // Mask sensitive values
  let maskedValue = value;
  if (name.includes("KEY") || name.includes("SECRET") || name.includes("TOKEN") || name === "DATABASE_URL") {
    maskedValue = `${value.substring(0, 8)}...${value.substring(value.length - 4)}`;
  }

  return { variable: name, present, value: maskedValue, valid, error };
}

async function testDatabaseConnection(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    console.log("  ⚠️  Skipping database test (DATABASE_URL not set)");
    return false;
  }

  try {
    console.log("  Testing database connection...");
    const { db } = await import("../server/db");
    const { sql } = await import("drizzle-orm");
    
    // Simple query to test connection
    await db.execute(sql`SELECT 1 as test`);
    console.log("  ✓ Database connection successful");
    return true;
  } catch (error: any) {
    console.log(`  ✗ Database connection failed: ${error.message}`);
    return false;
  }
}

async function testOpenAIConnection(): Promise<boolean> {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    console.log("  ⚠️  Skipping OpenAI test (API key not set)");
    return false;
  }

  try {
    console.log("  Testing OpenAI connection...");
    const response = await fetch(`${process.env.AI_INTEGRATIONS_OPENAI_BASE_URL}/models`, {
      headers: {
        "Authorization": `Bearer ${process.env.AI_INTEGRATIONS_OPENAI_API_KEY}`,
      },
    });

    if (response.ok) {
      console.log("  ✓ OpenAI connection successful");
      return true;
    } else {
      console.log(`  ✗ OpenAI connection failed: HTTP ${response.status}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ✗ OpenAI connection failed: ${error.message}`);
    return false;
  }
}

async function runDiagnostics() {
  console.log("\n🔬 Environment Doctor - Checking configuration...\n");

  // Check required variables
  console.log("Required Variables:");
  console.log("==================");
  const requiredResults = REQUIRED_VARS.map(checkEnvVar);
  
  requiredResults.forEach(result => {
    if (!result.present) {
      console.log(`  ✗ ${result.variable}: NOT SET`);
    } else if (result.valid === false) {
      console.log(`  ⚠️  ${result.variable}: ${result.value} (${result.error})`);
    } else {
      console.log(`  ✓ ${result.variable}: ${result.value}`);
    }
  });

  // Check optional variables
  console.log("\nOptional Variables:");
  console.log("===================");
  const optionalResults = OPTIONAL_VARS.map(checkEnvVar);
  
  optionalResults.forEach(result => {
    if (!result.present) {
      console.log(`  - ${result.variable}: not set (optional)`);
    } else if (result.valid === false) {
      console.log(`  ⚠️  ${result.variable}: ${result.value} (${result.error})`);
    } else {
      console.log(`  ✓ ${result.variable}: ${result.value}`);
    }
  });

  // Connection tests
  console.log("\nConnection Tests:");
  console.log("=================");
  const dbOk = await testDatabaseConnection();
  const aiOk = await testOpenAIConnection();

  // Summary
  console.log("\nSummary:");
  console.log("========");
  
  const requiredMissing = requiredResults.filter(r => !r.present).length;
  const requiredInvalid = requiredResults.filter(r => r.present && r.valid === false).length;
  const optionalSet = optionalResults.filter(r => r.present).length;

  if (requiredMissing > 0) {
    console.log(`  ✗ ${requiredMissing} required variable(s) missing`);
  } else {
    console.log(`  ✓ All required variables set`);
  }

  if (requiredInvalid > 0) {
    console.log(`  ⚠️  ${requiredInvalid} variable(s) have validation warnings`);
  }

  console.log(`  ℹ️  ${optionalSet}/${OPTIONAL_VARS.length} optional variables set`);

  // Recommendations
  console.log("\nRecommendations:");
  console.log("================");

  if (requiredMissing > 0) {
    console.log("  1. Add missing required variables to Replit Secrets");
    console.log("  2. See .env.example for reference");
  }

  if (!dbOk) {
    console.log("  - Fix database connection (check DATABASE_URL)");
    console.log("  - Run: npm run db:push to initialize schema");
  }

  if (!aiOk) {
    console.log("  - Fix OpenAI connection (check API key and base URL)");
  }

  if (optionalSet < OPTIONAL_VARS.length) {
    console.log("  - Consider adding optional integrations for full functionality:");
    optionalResults.filter(r => !r.present).forEach(r => {
      console.log(`    • ${r.variable}`);
    });
  }

  console.log("\n");

  // Exit code
  if (requiredMissing > 0 || !dbOk) {
    console.log("❌ Environment check failed\n");
    process.exit(1);
  } else {
    console.log("✅ Environment check passed\n");
    process.exit(0);
  }
}

// Run diagnostics
runDiagnostics().catch((error) => {
  console.error("\n❌ Environment doctor failed:", error);
  process.exit(1);
});
