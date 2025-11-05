# Feature PRD: Lead Scraping and Intake

## Overview

**Feature Name**: Automated Florida Arrest Record Scraping and Intake  
**Owner**: Product/Engineering  
**Status**: ✅ Implemented  
**Last Updated**: 2025-11-02

## Problem Statement

Criminal defense attorneys waste 5-10 hours per week manually checking county jail websites for new arrest records. The process is:
- **Time-consuming**: 20+ county websites to check daily
- **Error-prone**: Manual data entry leads to typos and missed records
- **Inconsistent**: Different counties use different formats
- **Reactive**: Attorneys miss time-sensitive opportunities

**User Quote**: *"By the time I manually check all the county sites and enter the data, the best leads are already gone."* - Defense Attorney, Tampa

## Goals & Success Metrics

### Goals
1. Reduce lead generation time from 10 hours/week to <1 hour/week
2. Increase lead volume by 3x (from ~50/week to ~150/week)
3. Capture leads within 2 hours of booking (vs 24+ hours manual)
4. Eliminate manual data entry errors (99%+ accuracy)

### Success Metrics
- **Lead Volume**: 500+ new records/month per county
- **Scrape Success Rate**: >95% of jobs complete without errors
- **Time to Capture**: <2 hours from booking to database
- **Data Accuracy**: <1% error rate vs source
- **AI Coverage**: >80% of records successfully enriched

### Anti-Goals
- Not scraping private/confidential data (public records only)
- Not violating county website terms of service
- Not overloading county servers (respect rate limits)

## User Stories

### As a criminal defense attorney...

**Story 1**: Start Daily Scrape
```
AS A criminal defense attorney
I WANT TO start an automated scrape of my target counties
SO THAT I have fresh leads every morning without manual work

GIVEN I am on the Scraping Wizard page
WHEN I select Miami-Dade, Broward, and Palm Beach counties
AND I toggle AI enhancement ON
AND I click "Start Scraping"
THEN the system starts a scrape job
AND shows me real-time progress
AND notifies me when complete
AND populates my dashboard with prioritized leads
```

**Story 2**: Monitor Scrape Progress
```
AS A criminal defense attorney
I WANT TO see the status of my scraping jobs
SO THAT I know when new leads are ready to review

GIVEN I have started a scrape job
WHEN I navigate to the Jobs page
THEN I see a list of all jobs (running, completed, failed)
AND I see progress indicators for running jobs
AND I see AI enrichment progress (X/Y records processed)
AND I can click into a job to see detailed logs
```

**Story 3**: Review AI-Enriched Leads
```
AS A criminal defense attorney
I WANT TO see arrest records with AI-generated insights
SO THAT I can quickly identify high-value cases

GIVEN a scrape job has completed with AI enrichment
WHEN I view the Records page
THEN I see records sorted by lead score (highest first)
AND each record shows:
  - Lead score badge (Elite, Hot, Warm, Cold)
  - Charge categories (Violent, Drug, etc)
  - Risk level (High, Medium, Low)
  - Normalized charge descriptions
AND I can filter by score, category, county, date
```

### As an intake specialist...

**Story 4**: Bulk Export for Outreach
```
AS AN intake specialist
I WANT TO export high-priority leads to CSV
SO THAT I can import them into our outreach system

GIVEN I have filtered records to show only Hot+ leads (score >70)
WHEN I select multiple records
AND click "Export Selected"
AND choose CSV format
THEN the system downloads a CSV with all fields
AND the CSV is formatted for PhantomBuster import
AND includes lead scores and AI insights
```

## User Flow

### Primary Flow: Configure and Start Scrape

```
1. Navigate to Dashboard
   └─> Click "New Scrape" button

2. Scraping Wizard - Step 1: County Selection
   ├─> See list of 20 Florida counties
   ├─> Multi-select counties (checkboxes)
   ├─> Quick filters: "Major Cities", "South Florida", "All"
   └─> Click "Next"

3. Scraping Wizard - Step 2: AI Settings
   ├─> Toggle "Enable AI Enhancement" ON/OFF
   ├─> If ON: See estimated processing time
   ├─> See cost estimate (if applicable)
   └─> Click "Next"

4. Scraping Wizard - Step 3: Review & Launch
   ├─> Review selected counties (5)
   ├─> Review AI setting (Enabled)
   ├─> Review export settings (future feature)
   └─> Click "Start Scraping"

5. Job Monitoring
   ├─> Redirect to Jobs page
   ├─> See job card with real-time progress
   ├─> Progress bar: "Scraping Miami-Dade... 23/100 records"
   ├─> AI progress: "Enriching... 5/23 records processed"
   └─> Receive notification when complete

6. Review Results
   ├─> Navigate to Records page
   ├─> See new records with lead scores
   ├─> Filter/search/export as needed
   └─> Proceed to deduplication or CRM workflow
```

### Alternative Flow: Scrape Fails

```
3. Start Scraping
   └─> County website timeout

4. Error Handling
   ├─> System retries 3 times with exponential backoff
   ├─> If still failing: Log error, continue with other counties
   ├─> Mark job as "Partial Success"
   └─> Show notification: "Miami-Dade scrape failed, 4 counties succeeded"

5. Recovery
   ├─> User can click "Retry Failed Counties"
   ├─> System attempts Miami-Dade again
   └─> Or user can manually review logs and report issue
```

## Technical Specification

### Architecture

```
Client (React)
  └─> POST /api/scrape/start
        ├─> counties: string[]
        ├─> enableAI: boolean
        └─> exportSettings?: {...}

Server (Express)
  ├─> Create scrape_job record
  ├─> Spawn Python scraper via child_process
  ├─> Parse JSON output
  ├─> Calculate lead scores
  ├─> Insert arrest_records
  ├─> If enableAI: Batch to ai-service
  └─> Update job status

Python Scraper (scraper.py)
  ├─> Receives county name as CLI arg
  ├─> Fetch county jail website
  ├─> Parse HTML with BeautifulSoup
  ├─> Extract arrest data
  ├─> Return JSON to stdout
  └─> Handle errors gracefully
```

### Data Model

#### scrape_jobs table
```typescript
{
  id: string;                    // UUID
  counties: string[];            // ["Miami-Dade", "Broward"]
  status: string;                // pending | running | completed | failed
  recordsFound: number;          // Total records scraped
  aiEnrichmentEnabled: boolean;  // AI toggle
  aiRecordsProcessed: number;    // AI progress
  aiRecordsTotal: number;        // AI total
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;       // Seconds
  errorMessage: string | null;
  createdAt: Date;
}
```

#### arrest_records table
```typescript
{
  id: string;                    // UUID
  jobId: string;                 // FK to scrape_jobs
  fullName: string;
  bookingNumber: string;
  bookingDate: Date;
  charges: string[];
  bondAmount: number | null;
  age: number | null;
  gender: string | null;
  race: string | null;
  county: string;
  facility: string | null;
  
  // Lead Scoring
  leadScore: number;             // 0-100
  scoreLabel: string;            // Elite | Hot | Warm | Cold
  
  // AI Enrichment
  aiEnhanced: boolean;
  chargeCategories: string[];    // Violent, Drug, etc
  normalizedCharges: string[];
  riskLevel: string | null;      // High | Medium | Low
  confidenceScore: number | null; // 0-100
  
  createdAt: Date;
}
```

### API Endpoints

#### POST /api/scrape/start
**Request**:
```json
{
  "counties": ["Miami-Dade", "Broward"],
  "enableAI": true
}
```

**Response** (201):
```json
{
  "jobId": "job-abc123",
  "message": "Scrape job started for 2 counties",
  "estimatedDuration": 120
}
```

#### GET /api/scrape/jobs
**Response** (200):
```json
{
  "jobs": [
    {
      "id": "job-abc123",
      "counties": ["Miami-Dade", "Broward"],
      "status": "running",
      "recordsFound": 23,
      "aiRecordsProcessed": 10,
      "aiRecordsTotal": 23,
      "startedAt": "2025-11-02T10:00:00Z"
    }
  ]
}
```

#### GET /api/scrape/status/:jobId
**Response** (200):
```json
{
  "id": "job-abc123",
  "status": "completed",
  "counties": ["Miami-Dade", "Broward"],
  "recordsFound": 47,
  "aiEnrichmentEnabled": true,
  "aiRecordsProcessed": 47,
  "aiRecordsTotal": 47,
  "duration": 125,
  "completedAt": "2025-11-02T10:02:05Z"
}
```

### Python Scraper Details

#### Supported Counties (Implementation Status)

| County | Status | Notes |
|--------|--------|-------|
| Miami-Dade | ✅ Complete | ASP.NET form submission, fully working |
| Broward | ⚠️ Infrastructure | Needs county-specific research |
| Palm Beach | ⚠️ Infrastructure | Needs county-specific research |
| Hillsborough | ⚠️ Infrastructure | Needs county-specific research |
| Orange | ⚠️ Infrastructure | Needs county-specific research |
| Pinellas | ⚠️ Infrastructure | Needs county-specific research |
| (14 more) | 📋 Planned | See replit.md for full list |

#### Miami-Dade Scraper Algorithm

```python
def scrape_miami_dade():
    # 1. GET the search form page
    url = "https://www.miami-dade.gov/corrections/inmate-search.asp"
    response = requests.get(url)
    
    # 2. Parse ASP.NET hidden fields
    soup = BeautifulSoup(response.text, 'html.parser')
    viewstate = soup.find('input', {'name': '__VIEWSTATE'})['value']
    eventvalidation = soup.find('input', {'name': '__EVENTVALIDATION'})['value']
    
    # 3. POST form submission with search params
    data = {
        '__VIEWSTATE': viewstate,
        '__EVENTVALIDATION': eventvalidation,
        'BookingDateFrom': (datetime.now() - timedelta(days=1)).strftime('%m/%d/%Y'),
        'BookingDateTo': datetime.now().strftime('%m/%d/%Y')
    }
    result_response = requests.post(url, data=data)
    
    # 4. Parse results table
    result_soup = BeautifulSoup(result_response.text, 'html.parser')
    table = result_soup.find('table', {'id': 'resultsTable'})
    
    # 5. Extract records
    records = []
    for row in table.find_all('tr')[1:]:  # Skip header
        cols = row.find_all('td')
        record = {
            'bookingNumber': cols[0].text.strip(),
            'fullName': cols[1].text.strip(),
            'bookingDate': cols[2].text.strip(),
            'charges': cols[3].text.strip().split(';'),
            'bondAmount': parse_bond(cols[4].text.strip())
        }
        records.append(record)
    
    return records
```

### Lead Scoring Algorithm

See `server/lead-scoring.ts` for implementation details.

**Weighted Formula** (0-100 scale):
```
leadScore = (chargeSeverity * 0.5) + (bondAmount * 0.3) + (demographics * 0.2)
```

**Component Calculations**:

1. **Charge Severity** (0-50 points):
   - Violent crimes: 50
   - Drug trafficking: 40
   - Property crimes: 30
   - DUI/Traffic: 20
   - Misdemeanors: 10

2. **Bond Amount** (0-30 points):
   - >$100k: 30
   - $50k-100k: 25
   - $25k-50k: 20
   - $10k-25k: 15
   - $5k-10k: 10
   - <$5k: 5

3. **Demographics** (0-20 points):
   - Age 25-45: 20 (prime working age)
   - Age 18-24 or 46-60: 15
   - Age 60+: 10

**Score Labels**:
- 90-100: "Elite" (badge-red)
- 70-89: "Hot" (badge-orange)
- 50-69: "Warm" (badge-yellow)
- 0-49: "Cold" (badge-gray)

### Error Handling

**County Website Errors**:
- Timeout after 30s → Retry with exponential backoff (3 attempts)
- HTML structure changed → Log error, fallback to mock data
- CAPTCHA detected → Mark county as "manual intervention required"

**Python Scraper Errors**:
- Import error → Log to stderr, exit with code 1
- Network error → Retry, fallback to mock data after 3 attempts
- Parsing error → Log problematic HTML, skip record, continue

**AI Enrichment Errors**:
- OpenAI timeout → Retry batch
- Rate limit → Exponential backoff, resume later
- Invalid response → Mark record as unenriched, continue
- Complete failure → Job succeeds, records marked `aiEnhanced: false`

## UI/UX Design

### Scraping Wizard (3 Steps)

**Step 1: County Selection**
- Header: "Select Counties to Scrape"
- Grid of county cards (4 columns)
- Each card shows:
  - County name
  - Checkbox
  - Last scraped timestamp
  - Estimated records
- Quick filters: "Major Cities" (5), "South Florida" (3), "All" (20)
- "Next" button (disabled until 1+ county selected)

**Step 2: AI Settings**
- Header: "Configure AI Enhancement"
- Toggle switch: "Enable AI Enhancement"
- If enabled:
  - Info: "AI will classify charges and assess risk levels"
  - Warning: "Processing time: ~5 seconds per 10 records"
  - Estimated cost: "$0.50 for 500 records" (future)
- If disabled:
  - Info: "Records will be scored but not AI-enhanced"
- "Next" button

**Step 3: Review & Launch**
- Header: "Review & Start Scraping"
- Summary card:
  - Counties: "5 selected (Miami-Dade, Broward...)"
  - AI Enhancement: "Enabled ✓"
  - Estimated duration: "2-3 minutes"
  - Estimated records: "150-200"
- "Start Scraping" button (primary, large)
- "Back" button (secondary)

### Jobs Page

**Layout**:
- Page header: "Scraping Jobs"
- Filter dropdown: "All | Running | Completed | Failed"
- Job cards in grid (2 columns on desktop)

**Job Card** (Running):
```
╔══════════════════════════════════════╗
║ 🔄 Running                           ║
║ Miami-Dade, Broward, Palm Beach      ║
║                                      ║
║ Records Found: 47                    ║
║ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░ 50%           ║
║                                      ║
║ AI Enhancement: 23/47 processed      ║
║ ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░ 49%            ║
║                                      ║
║ Started: 2 minutes ago               ║
║ [View Details] [Cancel]              ║
╚══════════════════════════════════════╝
```

**Job Card** (Completed):
```
╔══════════════════════════════════════╗
║ ✅ Completed                         ║
║ Miami-Dade, Broward                  ║
║                                      ║
║ Records Found: 47                    ║
║ AI Enhanced: 47/47 (100%)            ║
║ Duration: 2m 5s                      ║
║                                      ║
║ Completed: 5 minutes ago             ║
║ [View Records] [Delete Job]          ║
╚══════════════════════════════════════╝
```

## Testing Plan

### Unit Tests
- `lead-scoring.test.ts`: Verify scoring algorithm edge cases
- `deduplication.test.ts`: Test fuzzy matching accuracy
- `scraper.test.py`: Test HTML parsing with fixtures

### Integration Tests
- `api.e2e.test.ts`: Test full scrape workflow API
- Mock Python scraper to return fixtures
- Verify database inserts
- Test AI enrichment integration

### E2E Tests (Playwright)
- Navigate to wizard, select counties, start scrape
- Monitor job progress until completion
- Verify records appear in Records page
- Test filtering and export

### Manual QA Checklist
- [ ] Scrape each of 20 counties successfully
- [ ] Verify AI enrichment produces valid categories
- [ ] Test scrape failure scenarios (timeout, invalid HTML)
- [ ] Verify lead scores are accurate
- [ ] Test pagination and filtering on large datasets

## Launch Plan

### Phase 1: Alpha (Internal Testing)
- Test with 1-2 counties
- Verify scraper accuracy vs manual data entry
- Tune lead scoring algorithm
- Fix critical bugs

### Phase 2: Beta (Pilot Users)
- 5-10 attorneys in Florida
- Full 20-county support
- Gather feedback on UI/UX
- Monitor error rates and performance

### Phase 3: General Availability
- Public launch
- Marketing campaign
- Documentation and tutorials
- Support channels

## Monitoring & Analytics

### Key Metrics to Track
- Scrape success rate by county
- Average scrape duration by county
- AI enrichment success rate
- Lead score distribution
- User engagement (scrapes/week per user)

### Dashboards
- **Ops Dashboard**: Scrape success rates, error logs
- **Product Dashboard**: User engagement, feature usage
- **Business Dashboard**: Lead volume, conversion rates

### Alerts
- Scrape failure rate >10% → Page on-call
- AI enrichment failure rate >20% → Slack alert
- Database connection failures → PagerDuty

## Support & Documentation

### User Documentation
- Getting Started Guide
- County Coverage Map
- Lead Scoring Explained
- FAQ

### Technical Documentation
- API Reference (`server/openapi.yml`)
- Scraper Development Guide
- Contributing to County Scrapers

### Support Channels
- In-app chat (future)
- Email: support@attorneyleads.com
- Documentation: docs.attorneyleads.com
- Community forum (future)

## Appendix

### County Website URLs
See `server/scraper.py` for complete list.

### Sample Data Formats
See `tests/fixtures/` for county-specific examples.

### Related PRDs
- Duplicate Detection & Management
- AI Enhancement System
- CRM Integration
- Analytics Dashboard
