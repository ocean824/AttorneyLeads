# AttorneyLeads Operations

## Environment Variables

| Name                          | Required | Description                                       |
|-------------------------------|----------|---------------------------------------------------|
| `DATABASE_URL`                | Yes      | Postgres connection string (Neon recommended).    |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Yes  | OpenAI API key via Replit AI Integrations.        |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Yes | OpenAI base URL (Replit AI proxy).                |
| `PHANTOMBUSTER_API_KEY`       | Optional | PhantomBuster API key for prospect discovery.     |
| `PHANTOM_AGENT_ID`            | Optional | Specific PhantomBuster container/agent ID.        |
| `CALENDLY_API_KEY`            | Optional | Calendly API key.                                 |
| `CALENDLY_USER_URI`           | Optional | Calendly user URI for scheduling.                 |
| `GOOGLE_SHEETS_TOKEN`         | Optional | OAuth token/secret for Sheets integration.        |
| `SESSION_SECRET`              | Yes      | Secret for Express session signing.               |
| `PORT`                        | No       | HTTP port (defaults to 5000 on Replit).          |
| `NODE_ENV`                    | No       | Runtime environment (development/production).     |

> **Note**: Secrets are stored in Replit's Secrets panel; never commit `.env` to git.

## Logging & Error Handling

### Current Implementation

- Server logs to stdout using Vite's logger and `console.error`
- Express has a final error handler in `server/index.ts` that:
  - Derives HTTP status from `err.status` or `err.statusCode`
  - Sends JSON response with `{ message }` 
  - Re-throws errors for Replit logging system

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "details": {}
}
```

### Recommended Improvements

**Structured Error Responses**:
```json
{
  "code": "DUPLICATE_NOT_FOUND",
  "message": "The duplicate candidate with ID xyz was not found",
  "details": { "candidateId": "xyz" },
  "requestId": "req_abc123",
  "timestamp": "2025-11-02T20:00:00Z"
}
```

**Typed Error Classes**:
```typescript
class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public status: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
  }
}

// Usage
throw new AppError('RECORD_NOT_FOUND', 'Arrest record not found', 404, { id });
```

**Centralized Error Middleware**:
```typescript
app.use((err: Error, req, res, next) => {
  const requestId = req.headers['x-request-id'] || generateId();
  
  if (err instanceof AppError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
  
  // Fallback for unexpected errors
  console.error('Unexpected error:', err);
  return res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    requestId,
    timestamp: new Date().toISOString()
  });
});
```

## Basic Runbooks

### Server Won't Start

**Symptoms**: Application fails to start, shows port binding errors or database connection errors.

**Diagnosis**:
1. Check Replit console for startup errors
2. Verify `DATABASE_URL` is set in Secrets panel
3. Check for port 5000 conflicts

**Resolution**:
```bash
# Verify environment variables
echo $DATABASE_URL  # Should show postgres://...

# Test database connection
npx drizzle-kit push

# Restart workflow
npm run dev
```

### Scrape Jobs Failing

**Symptoms**: Jobs show "failed" status, no records created, Python errors in logs.

**Diagnosis**:
1. Check logs for `/api/scrape/start` requests
2. Look for Python traceback errors
3. Verify county website accessibility

**Resolution**:
```bash
# Check Python dependencies
python -c "import requests; import bs4; print('OK')"

# Test scraper manually
python server/scraper.py Miami-Dade

# Inspect server logs
grep "scraper.py" /tmp/logs/*.log
```

**Common Causes**:
- County website changed HTML structure → Update selectors in `server/scraper.py`
- CAPTCHA introduced → Need Selenium or manual intervention
- Network timeout → Increase timeout values
- Python dependencies missing → Run Python package install

### AI Enrichment Failing

**Symptoms**: Records created but `aiEnhanced: false`, AI job progress stuck at 0%.

**Diagnosis**:
1. Call `/api/ai/test` endpoint to verify OpenAI connection
2. Check for OpenAI API errors in logs
3. Verify API key and base URL are correct

**Resolution**:
```bash
# Test AI endpoint via curl
curl http://localhost:5000/api/ai/test

# Check secrets
echo $AI_INTEGRATIONS_OPENAI_API_KEY  # Should show sk-...
echo $AI_INTEGRATIONS_OPENAI_BASE_URL # Should show https://...

# Inspect AI service logs
grep "ai-service" /tmp/logs/*.log
```

**Common Causes**:
- Invalid API key → Get fresh key from Replit AI Integrations
- Rate limit exceeded → Reduce batch size in `ai-service.ts`
- Model not available → Check OpenAI status page
- Network timeout → Increase fetch timeout

### Duplicate Detection Not Finding Matches

**Symptoms**: Known duplicates not detected, confidence scores all below threshold.

**Diagnosis**:
1. Check duplicate candidates table for entries
2. Review confidence score calculations
3. Verify name normalization logic

**Resolution**:
```typescript
// Adjust confidence threshold (currently 60%)
// In server/deduplication.ts:
const CONFIDENCE_THRESHOLD = 50; // Lower to find more matches

// Check Levenshtein distance implementation
// Test with known duplicate names
```

**Common Causes**:
- Names too different → Improve normalization (strip Jr/Sr, standardize)
- Threshold too high → Lower from 60% to 50%
- Booking dates too far apart → Increase time window from 48h to 7 days

### Database Migration Issues

**Symptoms**: Schema mismatch errors, column not found, type conflicts.

**Diagnosis**:
1. Compare `shared/schema.ts` with actual database schema
2. Check for pending migrations

**Resolution**:
```bash
# Force push schema changes (data loss warning)
npm run db:push --force

# Or use Drizzle Kit introspection
npx drizzle-kit introspect

# Backup first if production data exists
pg_dump $DATABASE_URL > backup.sql
```

**Prevention**:
- Never manually edit database schema
- Always update `shared/schema.ts` first
- Use `npm run db:push` for development
- Use proper migrations for production

### CRM Integrations Not Working

**Symptoms**: Mock data displayed, no real PhantomBuster/Calendly/Sheets data.

**Diagnosis**:
1. Check console for service warnings
2. Verify API keys in Secrets panel
3. Test each integration endpoint individually

**Resolution**:
```bash
# PhantomBuster
curl -X POST http://localhost:5000/api/crm/discover \
  -H "Content-Type: application/json" \
  -d '{"searchQuery":"attorney","location":"Florida","platform":"linkedin"}'

# Calendly
curl http://localhost:5000/api/crm/calendly/events

# Google Sheets
curl -X POST http://localhost:5000/api/crm/sheets/sync-prospects \
  -H "Content-Type: application/json" \
  -d '{"spreadsheetId":"abc123","sheetName":"Prospects"}'
```

**Common Causes**:
- Missing API keys → Add to Secrets panel
- Invalid credentials → Regenerate tokens
- Calendly missing USER_URI → Add both API_KEY and USER_URI
- Network restrictions → Replit sandbox blocks some external APIs

## Monitoring Checklist

### Daily Checks
- [ ] Any scrape jobs in "failed" status?
- [ ] AI enrichment coverage above 80%?
- [ ] Duplicate candidates queue manageable (<50 pending)?
- [ ] CRM meetings scheduled this week?

### Weekly Checks
- [ ] Database size growth acceptable?
- [ ] Export logs showing successful syncs?
- [ ] No error spikes in logs?
- [ ] Integration services responding?

### Monthly Checks
- [ ] Review analytics trends (counties, scores, charges)
- [ ] Audit duplicate merge/dismiss ratios
- [ ] Check campaign performance metrics
- [ ] Update county scrapers if website changes detected

## Replit "First Run" Checklist

Setting up AttorneyLeads from scratch on Replit:

1. **Clone/Fork Repl**
   - Open https://replit.com
   - Import from GitHub or fork existing Repl

2. **Configure Secrets** (Secrets panel in left sidebar)
   ```
   DATABASE_URL=postgres://... (from Neon)
   AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
   AI_INTEGRATIONS_OPENAI_BASE_URL=https://...
   SESSION_SECRET=random-string-here
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Initialize Database**
   ```bash
   npm run db:push
   ```

5. **Start Application**
   ```bash
   npm run dev
   ```

6. **Verify Setup**
   - Open webview at `/`
   - Check dashboard loads
   - Call `/api/stats` - should return JSON
   - Test AI: `/api/ai/test` - should return `{ status: 'ok' }`

7. **Optional: Configure CRM Integrations**
   - Add PhantomBuster API key
   - Add Calendly API key + User URI
   - Add Google Sheets token

8. **Run Test Scrape**
   - Navigate to scraping wizard
   - Select 1-2 counties
   - Enable AI enhancement
   - Monitor job progress

## Performance Tuning

### Database Optimization

**Add Indexes** (if not already present):
```sql
CREATE INDEX idx_arrest_records_booking_date ON arrest_records(booking_date);
CREATE INDEX idx_arrest_records_county ON arrest_records(county);
CREATE INDEX idx_arrest_records_lead_score ON arrest_records(lead_score);
CREATE INDEX idx_crm_prospects_email ON crm_prospects(email);
CREATE INDEX idx_crm_prospects_status ON crm_prospects(status);
```

**Query Optimization**:
- Always use pagination for list endpoints
- Add `LIMIT` clauses to prevent full table scans
- Use `COUNT(*)` sparingly, cache counts when possible

### API Performance

**Response Caching** (recommended):
```typescript
// Cache stats for 5 minutes
const statsCache = { data: null, expires: 0 };

app.get('/api/stats', async (req, res) => {
  if (statsCache.expires > Date.now()) {
    return res.json(statsCache.data);
  }
  
  const stats = await storage.getStats();
  statsCache.data = stats;
  statsCache.expires = Date.now() + 5 * 60 * 1000;
  res.json(stats);
});
```

**Rate Limiting** (see `config/rateLimits.ts`):
```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', apiLimiter);
```

### Python Scraper Optimization

**Parallel County Scraping**:
```typescript
// Instead of sequential
for (const county of counties) {
  await scrapeCounty(county);
}

// Use parallel (with limit)
const results = await Promise.allSettled(
  counties.map(county => scrapeCounty(county))
);
```

**Increase Scraper Concurrency**:
```python
# In scraper.py
import concurrent.futures

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    futures = [executor.submit(scrape_page, url) for url in urls]
    results = [f.result() for f in futures]
```

## Backup & Recovery

### Database Backups

**Manual Backup**:
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

**Restore from Backup**:
```bash
psql $DATABASE_URL < backup_20251102.sql
```

### Automated Backups (Neon)
- Neon provides automatic daily backups
- Restore via Neon console
- Point-in-time recovery available on paid plans

### Export Critical Data
```typescript
// Export all prospects to JSON
const prospects = await storage.getCrmProspects();
fs.writeFileSync('prospects_backup.json', JSON.stringify(prospects, null, 2));

// Export all arrest records
const { records } = await storage.getArrestRecords({ pageSize: 100000 });
fs.writeFileSync('records_backup.json', JSON.stringify(records, null, 2));
```

## Security Hardening

### Current Security Measures
- ✅ API keys in Secrets (not committed)
- ✅ Zod validation on all inputs
- ✅ SQL injection protection (Drizzle ORM)
- ✅ Session secret for cookie signing
- ✅ CORS configured for same-origin

### Recommended Enhancements
- [ ] Add rate limiting per IP
- [ ] Implement request ID tracking
- [ ] Add API authentication for public endpoints
- [ ] Set HTTP security headers (helmet)
- [ ] Enable HTTPS-only in production
- [ ] Implement RBAC for multi-user scenarios
- [ ] Add audit logging for sensitive operations
- [ ] Encrypt sensitive PII fields at rest
