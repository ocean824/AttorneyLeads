/**
 * Smoke Test Script
 * 
 * Performs basic health checks on the API to ensure all core endpoints are functional.
 * Run with: npx tsx scripts/smoke-test.ts
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

async function test(name: string, testFn: () => Promise<void>) {
  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ name, passed: true, duration });
    console.log(`✓ ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({ name, passed: false, error: error.message, duration });
    console.log(`✗ ${name} (${duration}ms)`);
    console.log(`  Error: ${error.message}`);
  }
}

async function fetchJSON(path: string, options?: RequestInit) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function runSmokeTests() {
  console.log(`\n🔍 Running smoke tests against ${BASE_URL}\n`);

  // Core Endpoints
  await test("GET /api/stats", async () => {
    const data = await fetchJSON("/api/stats");
    if (typeof data.totalRecords !== "number") throw new Error("Invalid stats response");
  });

  await test("GET /api/analytics", async () => {
    const data = await fetchJSON("/api/analytics");
    if (!data.recordsByCounty) throw new Error("Missing recordsByCounty");
  });

  // Scraping Endpoints
  await test("GET /api/scrape/jobs", async () => {
    const data = await fetchJSON("/api/scrape/jobs");
    if (!Array.isArray(data)) throw new Error("Expected array of jobs");
  });

  // Records Endpoints
  await test("GET /api/records", async () => {
    const data = await fetchJSON("/api/records");
    if (!data.records || !Array.isArray(data.records)) throw new Error("Invalid records response");
    if (typeof data.total !== "number") throw new Error("Missing total count");
  });

  await test("GET /api/records?county=Miami-Dade", async () => {
    const data = await fetchJSON("/api/records?county=Miami-Dade");
    if (!data.records) throw new Error("Invalid filtered response");
  });

  await test("GET /api/records?page=1&pageSize=10", async () => {
    const data = await fetchJSON("/api/records?page=1&pageSize=10");
    if (data.records.length > 10) throw new Error("Pagination not working");
  });

  // Duplicate Endpoints
  await test("GET /api/duplicates", async () => {
    const data = await fetchJSON("/api/duplicates");
    if (!Array.isArray(data)) throw new Error("Expected array of duplicates");
  });

  await test("GET /api/duplicates?status=pending", async () => {
    const data = await fetchJSON("/api/duplicates?status=pending");
    if (!Array.isArray(data)) throw new Error("Invalid filtered duplicates");
  });

  // AI Endpoints
  await test("GET /api/ai/test", async () => {
    const data = await fetchJSON("/api/ai/test");
    if (data.status !== "ok" && data.status !== "error") {
      throw new Error("Invalid AI test response");
    }
  });

  // CRM Endpoints
  await test("GET /api/crm/prospects", async () => {
    const data = await fetchJSON("/api/crm/prospects");
    if (!Array.isArray(data)) throw new Error("Expected array of prospects");
  });

  await test("GET /api/crm/campaigns", async () => {
    const data = await fetchJSON("/api/crm/campaigns");
    if (!Array.isArray(data)) throw new Error("Expected array of campaigns");
  });

  await test("GET /api/crm/meetings", async () => {
    const data = await fetchJSON("/api/crm/meetings");
    if (!Array.isArray(data)) throw new Error("Expected array of meetings");
  });

  await test("GET /api/crm/calendly/events", async () => {
    const data = await fetchJSON("/api/crm/calendly/events");
    if (!Array.isArray(data)) throw new Error("Expected array of event types");
  });

  // Print summary
  console.log("\n" + "=".repeat(60));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`\nSummary: ${passed}/${total} tests passed`);
  
  if (failed > 0) {
    console.log(`\n❌ ${failed} test(s) failed:\n`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}`);
      console.log(`    ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log(`\n✅ All smoke tests passed!\n`);
    
    // Performance summary
    const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / total;
    const slowest = results.reduce((max, r) => Math.max(max, r.duration || 0), 0);
    
    console.log(`Performance:`);
    console.log(`  - Average response time: ${avgDuration.toFixed(0)}ms`);
    console.log(`  - Slowest endpoint: ${slowest}ms`);
    
    process.exit(0);
  }
}

// Run tests
runSmokeTests().catch((error) => {
  console.error("\n❌ Smoke tests failed to run:", error);
  process.exit(1);
});
