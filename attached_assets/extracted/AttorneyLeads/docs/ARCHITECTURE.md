# AttorneyLeads Architecture

## High-Level Overview

AttorneyLeads is a single-workspace Replit application composed of:

- **React + Vite SPA (`client/`)**
  - Dashboard (jobs, analytics)
  - Arrest records browser with search and filtering
  - Duplicate management UI with side-by-side comparison
  - CRM views (prospects, campaigns, meetings)
  - Analytics dashboard with Recharts visualizations

- **Express API Server (`server/`)**
  - HTTP API (`/api/**`) for scrape jobs, records, duplicates, analytics, CRM
  - Integrations:
    - **Neon Postgres** via Drizzle ORM (`server/db.ts`, `shared/schema.ts`)
    - **Python Scraper** (`server/scraper.py`) for county arrest record sites
    - **OpenAI GPT-4o-mini** via `ai-service.ts` for charge classification
    - **PhantomBuster**, **Calendly**, **Google Sheets** for CRM workflows

- **Shared Schema (`shared/`)**
  - Drizzle schema & Zod validation (`schema.ts`) shared by server and client
  - Ensures type safety across the entire stack

## System Diagram

```
               +--------------------------+
               |   AttorneyLeads UI       |
               |  React + Vite SPA        |
               |  (client/)               |
               +--------------+-----------+
                              |
                              | HTTPS (JSON, fetch, TanStack Query)
                              v
                 +------------+-------------+
                 |   Express API Server     |
                 |  server/index.ts         |
                 |  server/routes.ts        |
                 |  server/crm-routes.ts    |
                 +------+-------------------+
                        |
      +-----------------+------------------------------+
      |                 |                              |
      v                 v                              v
+-----+--------+  +-----+----------------+     +-------+------------------+
|  Drizzle ORM |  |  Python Scraper      |     | External Integrations   |
|  db.ts       |  |  server/scraper.py   |     |                          |
+-----+--------+  +-----------+----------+     |  - OpenAI (ai-service)   |
      |                       |                |  - PhantomBuster         |
      | SQL (Neon)            | CLI spawn      |  - Calendly              |
      v                       v                |  - Google Sheets         |
+-----+-------------------------------+        +--------------------------+
|   Neon Postgres                     |
|   - arrest_records                  |
|   - scrape_jobs                     |
|   - duplicate_candidates            |
|   - crm_prospects                   |
|   - outreach_campaigns              |
|   - scheduled_meetings              |
|   - crm_sync_logs                   |
+-------------------------------------+
```

## Module Boundaries

### Server Modules

#### `server/routes.ts`
Primary API routes for arrest record workflows:
- **Stats**: `/api/stats` - Dashboard statistics
- **Scraping**: `/api/scrape/start`, `/api/scrape/jobs`, `/api/scrape/status/:jobId`
- **Records**: `/api/records` - CRUD operations with pagination, search, filtering
- **Duplicates**: `/api/duplicates` - Fuzzy matching, merge, dismiss operations
- **Analytics**: `/api/analytics` - Recharts data with date filtering
- **AI Test**: `/api/ai/test` - OpenAI connection verification

#### `server/crm-routes.ts`
CRM-specific flows:
- **Prospects**: `/api/crm/prospects` - Full CRUD with Zod validation
- **Discovery**: `/api/crm/discover` - PhantomBuster LinkedIn/Facebook scraping
- **Outreach**: `/api/crm/outreach/send` - Email campaign automation
- **Meetings**: `/api/crm/meetings` - Calendly scheduling integration
- **Campaigns**: `/api/crm/campaigns` - Campaign tracking
- **Sheets Sync**: `/api/crm/sheets/sync-*` - Google Sheets bi-directional sync

#### `server/storage.ts`
Data access layer implementing `IStorage` interface:
- Groups Drizzle queries by domain (arrests, jobs, duplicates, CRM)
- Provides abstraction over direct database access
- Uses transactions for complex operations (merge duplicates)
- All methods use proper TypeScript types from `shared/schema.ts`

#### `server/ai-service.ts`
OpenAI integration for AI enrichment:
- **Charge Classification**: Categorizes charges into violent, property, drug, traffic, etc.
- **Risk Assessment**: Assigns risk levels (high, medium, low)
- **Charge Normalization**: Standardizes charge descriptions
- **Confidence Scoring**: Returns confidence levels for AI decisions
- **Batch Processing**: Handles multiple records efficiently
- **Error Handling**: Graceful fallback when API fails

#### `server/lead-scoring.ts`
Lead scoring and labeling utilities:
- Stateless pure functions for reproducibility
- **Weighted Algorithm** (0-100 scale):
  - Charge Severity: 50% weight
  - Bond Amount: 30% weight
  - Demographics: 20% weight
- **Score Labels**: Elite (90+), Hot (70-89), Warm (50-69), Cold (<50)

#### `server/deduplication.ts`
Fuzzy matching algorithm:
- **Levenshtein Distance**: String similarity for name matching
- **Multi-Factor Scoring**:
  - Name similarity (40pts max)
  - Booking date proximity (30pts max)
  - Same county (15pts)
  - Same facility (10pts)
  - Same age (5pts)
- **Confidence Threshold**: 60% minimum to prevent false positives

### Client Modules

#### `client/src/pages/`
- `dashboard.tsx` - Home dashboard with stats and quick actions
- `records.tsx` - Arrest records table with search/filter/export
- `jobs.tsx` - Scraping job monitoring
- `duplicates.tsx` - Duplicate review and resolution
- `analytics.tsx` - Data visualizations and insights
- `crm.tsx` - CRM dashboard with 5 tabs (Prospects, Lead Form, Discovery, Meetings, Integrations)

#### `client/src/components/`
Reusable UI components:
- `ui/` - Shadcn UI primitives (Button, Card, Table, Form, etc.)
- Custom components for domain-specific features

#### `client/src/lib/`
- `queryClient.ts` - TanStack Query configuration with default fetcher
- Utility functions and helpers

### Dependencies

```
client → REST API → server
server → shared/schema (types + validation)
server → db.ts (Drizzle ORM)
server → Python scraper (child_process.spawn)
server → External services (OpenAI, PhantomBuster, Calendly, Sheets)
```

## Data Flow Examples

### Scraping Flow
1. User selects counties + AI toggle in wizard UI
2. Client POST `/api/scrape/start` with counties array
3. Server creates `scrape_job` record, spawns Python scraper
4. Python scraper fetches arrest data, returns JSON
5. Server parses JSON, calculates lead scores, inserts records
6. If AI enabled, server batches records to OpenAI for enrichment
7. Server updates job status, client polls `/api/scrape/status/:jobId`
8. Client displays real-time progress with AI enhancement stats

### Duplicate Detection Flow
1. User clicks "Scan for Duplicates" button
2. Client POST `/api/duplicates/scan`
3. Server loads all arrest records
4. Deduplication algorithm compares all pairs using fuzzy matching
5. Creates `duplicate_candidates` with confidence scores + match reasons
6. Client displays side-by-side comparison UI
7. User reviews, chooses merge (keeps primary) or dismiss
8. Server executes transaction: delete duplicate, update candidate status

### CRM Discovery Flow
1. User enters LinkedIn search query in Discovery tab
2. Client POST `/api/crm/discover` with searchQuery, location, platform
3. Server launches PhantomBuster agent, returns containerId
4. Server async IIFE waits 5s, fetches PhantomBuster results
5. Server deduplicates by email against existing prospects
6. Server creates new `crm_prospects` records
7. Client refetches prospects list via TanStack Query invalidation
8. User sees new prospects in Prospects tab

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter (lightweight React Router alternative)
- **Data Fetching**: TanStack Query v5 (formerly React Query)
- **Forms**: React Hook Form + Zod validation
- **UI Components**: Shadcn UI + Radix UI primitives
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React + React Icons

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon-hosted)
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Scraping**: Python 3.11 + BeautifulSoup4 + Requests
- **AI**: OpenAI GPT-4o-mini via Replit AI Integrations

### Infrastructure
- **Platform**: Replit
- **Database**: Neon Postgres (serverless)
- **Deployment**: Single-click publish via Replit
- **Environment**: Replit Secrets for API keys

## Security Considerations

### Current Implementation
- API keys stored in Replit Secrets (not committed to git)
- Session secrets for Express session middleware
- Zod validation on all API inputs
- SQL injection protection via Drizzle ORM parameterized queries
- CORS configured for same-origin by default

### Recommended Enhancements
- Add rate limiting per IP/route (see `config/rateLimits.ts`)
- Implement request ID tracking for debugging
- Add API key authentication for public endpoints
- Set up HTTPS-only in production
- Implement RBAC for multi-user scenarios (see `config/permissions.ts`)

## Performance Characteristics

### Database Queries
- Indexes on frequently queried columns (bookingDate, county, leadScore)
- Pagination for all list endpoints (default 50 records per page)
- Duplicate detection runs in-memory (loaded once per scan)

### API Response Times
- Stats endpoint: <100ms
- Records list: <200ms (with pagination)
- Scrape start: <500ms (spawns async process)
- AI enrichment: 2-5s per batch of 10 records

### Scalability Notes
- Python scraper is single-threaded (can parallelize per county)
- AI enrichment batched to avoid rate limits
- Database connection pooling via Drizzle
- TanStack Query caching reduces redundant API calls

## Testing Strategy (Recommended)

### Unit Tests
- `lead-scoring.test.ts` - Scoring algorithm edge cases
- `deduplication.test.ts` - Fuzzy matching accuracy
- `storage.test.ts` - Database CRUD operations

### Integration Tests
- `api.e2e.test.ts` - Full API endpoint coverage
- `crm-routes.test.ts` - CRM workflow validation

### E2E Tests (via Playwright)
- Scraping wizard flow
- Duplicate review + merge
- CRM prospect discovery → meeting scheduling

See `tests/` directory for implementation (recommended).
