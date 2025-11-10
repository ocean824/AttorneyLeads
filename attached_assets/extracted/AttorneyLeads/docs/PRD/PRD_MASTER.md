# AttorneyLeads – PRD MASTER

## 1. Scope & Vision

AttorneyLeads is a lead-generation and intake acceleration tool for criminal defense attorneys. It turns public Florida arrest records into prioritized, AI-enriched leads and feeds them into a lightweight CRM workflow with outreach and scheduling capabilities.

### Core Value Proposition

- **Automated Lead Discovery**: Scrape 20+ Florida counties for fresh arrest records daily
- **AI-Powered Prioritization**: GPT-4o-mini classifies charges and assigns risk scores
- **Intelligent Deduplication**: Fuzzy matching prevents duplicate outreach
- **Integrated CRM Workflow**: From arrest → prospect → meeting in one platform
- **Time Savings**: Reduce manual data entry and lead qualification by 80%

### Out of Scope (for now)

- Full-blown law firm practice management
- E-filing, billing, and matter management beyond basic lead tracking
- Client portal or case status tracking
- Document management system
- Conflict checking system
- Trust accounting

## 2. Target Personas

### Primary: Criminal Defense Attorney (Solo Practitioner)

**Demographics**:
- 5-15 years of experience
- Solo practice or 2-3 attorney firm
- Handles 50-100 cases annually
- Florida-based practice

**Goals**:
- Maintain steady pipeline of qualified leads
- Reduce time spent on lead qualification
- Increase consultation booking rate
- Filter for high-value cases (serious charges, higher bonds)

**Pain Points**:
- Manual checking of county jail websites daily
- Duplicate data entry across systems
- Difficulty prioritizing which leads to pursue
- Missing time-sensitive opportunities (72-hour window)

**Success Metrics**:
- 2x increase in qualified leads per week
- 50% reduction in time spent on lead generation
- 30% increase in consultation booking rate

### Secondary: Intake Specialist / Legal Coordinator

**Demographics**:
- Paralegal or legal assistant
- Works for small to mid-size criminal defense firm
- Manages initial client contact and scheduling

**Goals**:
- Efficiently screen incoming leads
- Coordinate consultation scheduling
- Track outreach campaign performance
- Maintain organized prospect database

**Pain Points**:
- Switching between multiple tools (jail sites, CRM, calendar)
- Manual follow-up tracking
- Duplicate records causing confusion
- No visibility into lead quality before outreach

**Success Metrics**:
- Process 3x more leads per day
- Reduce duplicate contact attempts by 90%
- Increase consultation show-rate by 20%

### Tertiary: Law Firm Owner / Managing Partner

**Demographics**:
- 10+ years experience
- Manages 5-20 attorneys
- Oversees business development and marketing

**Goals**:
- Monitor lead pipeline health
- Track campaign ROI
- Optimize marketing spend
- Ensure compliance with ethical rules

**Pain Points**:
- Lack of visibility into lead generation metrics
- Inefficient use of attorney time on low-value leads
- Difficulty attributing new clients to specific sources
- Compliance concerns with automated outreach

**Success Metrics**:
- 25% increase in conversion rate (lead → client)
- Measurable ROI on marketing campaigns
- Reduced cost per acquisition
- Audit trail for compliance

## 3. Core User Flows

### Flow 1: Configure & Start a Scrape

**Trigger**: Attorney wants fresh leads from specific counties

**Steps**:
1. Navigate to Scraping Wizard
2. Select target counties (multi-select from 20 Florida counties)
3. Toggle AI enhancement on/off
4. Review settings (export options in future)
5. Click "Start Scraping"
6. View real-time job progress with AI enrichment status
7. Receive completion notification

**Success Criteria**:
- Job completes without errors
- Records appear in database with lead scores
- AI enrichment completes (if enabled)
- No duplicate records created

**Error Handling**:
- County website timeout → Retry with exponential backoff
- Python scraper crash → Fallback to mock data, log error
- AI API failure → Mark records as unenriched, allow manual retry

### Flow 2: Review & Deduplicate Records

**Trigger**: New records scraped, potential duplicates detected

**Steps**:
1. Navigate to Duplicate Management page
2. System shows side-by-side comparison of potential duplicates
3. Review match reasons (name similarity, date proximity, etc.)
4. Decide: Merge (keep primary) or Dismiss (not a match)
5. If merge: System deletes duplicate, updates candidate status
6. Repeat for remaining candidates

**Success Criteria**:
- Duplicate candidates sorted by confidence score
- Clear visual indicators for match reasons
- One-click merge or dismiss
- Merged records maintain all relevant data from both

**Error Handling**:
- Merge transaction fails → Rollback, show error
- User dismisses then changes mind → Provide "undo" option
- Both records have conflicting data → Show conflict resolution UI

### Flow 3: Launch Outreach & Schedule Consults

**Trigger**: Attorney identifies high-priority prospects from arrest records

**Steps**:
1. Filter records by lead score (>70) and county
2. Select records for CRM import
3. System syncs to CRM Prospects table
4. Navigate to CRM → Discovery tab
5. Launch PhantomBuster LinkedIn search for additional context
6. Review enriched prospect profiles
7. Navigate to Lead Form tab to manually add prospects
8. Send outreach email (future: automated sequences)
9. Prospect responds → Schedule Calendly consultation
10. Meeting appears in Meetings tab with status tracking

**Success Criteria**:
- Seamless transition from arrest record → CRM prospect
- Deduplication prevents duplicate outreach
- Calendly link auto-generated with prospect context
- Meeting tracked with status updates

**Error Handling**:
- PhantomBuster quota exceeded → Show upgrade prompt
- Calendly API timeout → Retry, fallback to manual link
- Email bounce → Mark prospect status as invalid
- Prospect already exists → Merge new data, don't duplicate

### Flow 4: Monitor Performance Analytics

**Trigger**: Weekly review of lead generation metrics

**Steps**:
1. Navigate to Analytics Dashboard
2. Set date range filter (last 7/30/90 days)
3. Review 4 key visualizations:
   - Records by County (bar chart)
   - Lead Score Distribution (pie chart)
   - Charge Categories (bar chart)
   - Jobs Over Time (line chart)
4. Export high-value leads to CSV for deeper analysis
5. Identify trends (e.g., which counties produce best leads)
6. Adjust scraping strategy accordingly

**Success Criteria**:
- Charts load in <2 seconds
- Data updates reflect latest records
- Export includes all relevant fields
- Trends clearly visible

**Error Handling**:
- No data for date range → Show empty state
- Chart rendering error → Fallback to table view
- Export timeout → Generate async, email link

## 4. Non-Functional Requirements

### Performance

- **API Response Times**:
  - Stats endpoint: <100ms
  - Records list (paginated): <200ms
  - Search/filter: <500ms
  - Scrape job start: <500ms (async processing)
  - AI enrichment: 2-5s per batch of 10 records

- **Scalability**:
  - Support 10,000+ arrest records
  - Handle 50+ concurrent scrape jobs
  - Process 100+ AI enrichment requests/hour

### Reliability

- **Uptime**: 99% availability (excluding scheduled maintenance)
- **Data Integrity**: Zero data loss on successful scrape
- **Error Recovery**: Automatic retry on transient failures
- **Graceful Degradation**: System functional even if AI/CRM integrations fail

### Security

- **Data Protection**: PII encrypted at rest (future)
- **Access Control**: Session-based authentication
- **API Security**: Zod validation on all inputs
- **Secrets Management**: API keys in Replit Secrets, never committed
- **Audit Logging**: Track sensitive operations (merge, delete)

### Compliance

- **Ethical Rules**: No automated solicitation within 30 days (configurable)
- **Data Retention**: Configurable retention policies
- **Opt-Out**: Respect prospect communication preferences
- **Public Records**: Only scrape publicly available data

### Usability

- **Responsive Design**: Works on desktop, tablet, mobile
- **Accessibility**: WCAG 2.1 AA compliance (future)
- **Loading States**: Clear feedback during async operations
- **Error Messages**: User-friendly, actionable guidance
- **Onboarding**: First-run wizard for setup

## 5. AI Enhancement Overview

### Capabilities

1. **Charge Classification**
   - Categories: Violent, Property, Drug, Traffic, White Collar, Other
   - Multi-label classification (one arrest can have multiple categories)
   - Confidence scores for each classification

2. **Risk Assessment**
   - Levels: High, Medium, Low
   - Based on charge severity, prior history (if available), bond amount
   - Explanation provided for risk level

3. **Charge Normalization**
   - Standardizes varied charge descriptions
   - Maps to common legal terminology
   - Enables better filtering and reporting

4. **Confidence Scoring**
   - 0-100 scale for AI enrichment quality
   - Flags low-confidence records for manual review
   - Used in lead scoring algorithm

### Implementation

- **Model**: OpenAI GPT-4o-mini via Replit AI Integrations
- **Prompting**: Structured prompts with examples
- **Batch Processing**: 10 records per API call for efficiency
- **Fallback**: Graceful degradation if AI unavailable
- **Cost**: ~$0.01 per 100 records (estimate)

### Quality Assurance

- Manual review of first 100 AI-enriched records
- Spot-checking of low-confidence (<70%) classifications
- Feedback loop for prompt refinement
- A/B testing of different prompting strategies

## 6. Technical Architecture Summary

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + Node.js 20
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle with Zod validation
- **Scraping**: Python 3.11 + BeautifulSoup4
- **AI**: OpenAI GPT-4o-mini
- **CRM Integrations**: PhantomBuster, Calendly, Google Sheets

### Data Models (7 tables)

1. `arrest_records` - Core arrest data with AI fields and lead scores
2. `scrape_jobs` - Job tracking with AI progress monitoring
3. `duplicate_candidates` - Fuzzy matching results
4. `crm_prospects` - CRM contact database
5. `outreach_campaigns` - Campaign tracking
6. `scheduled_meetings` - Calendly integration
7. `crm_sync_logs` - Export/sync history

### API Design

- **RESTful** endpoints under `/api/**`
- **JSON** request/response format
- **Zod** validation on all inputs
- **Pagination** on list endpoints (default 50/page)
- **Error** responses with structured format

See `server/openapi.yml` for complete API specification.

## 7. Success Metrics & KPIs

### User Adoption

- Daily Active Users (DAU)
- Weekly Active Users (WAU)
- Average session duration
- Feature usage rates (scraping, deduplication, CRM)

### Business Value

- **Lead Volume**: Total records scraped per month
- **Lead Quality**: % of records with score >70
- **Conversion Rate**: Leads → Consultations → Clients
- **Time Savings**: Hours saved vs. manual process
- **ROI**: Revenue generated / Platform cost

### Technical Health

- **Scrape Success Rate**: % jobs completed without errors
- **AI Coverage**: % records successfully enriched
- **Duplicate Detection Accuracy**: Precision/recall
- **API Uptime**: 99%+ availability
- **Response Times**: 95th percentile <500ms

### CRM Effectiveness

- **Prospect Discovery**: LinkedIn profiles found
- **Meeting Booking Rate**: % prospects → scheduled meetings
- **Outreach Response Rate**: % emails replied
- **Campaign ROI**: Meetings booked / Campaign cost

## 8. Roadmap & Future Enhancements

### Phase 1: Foundation (COMPLETE ✅)
- ✅ PostgreSQL migration
- ✅ Lead scoring system
- ✅ Duplicate detection
- ✅ AI enrichment
- ✅ Analytics dashboard
- ✅ CRM integrations

### Phase 2: Automation (Q1 2026)
- [ ] Scheduled scraping (cron jobs)
- [ ] Automated outreach sequences
- [ ] Email templates and personalization
- [ ] Webhook support for real-time updates
- [ ] Mobile app (React Native)

### Phase 3: Intelligence (Q2 2026)
- [ ] Predictive lead scoring (ML model)
- [ ] Sentiment analysis on prospect interactions
- [ ] Attorney workload balancing
- [ ] Smart scheduling (optimal times)
- [ ] Conversation intelligence (call transcription)

### Phase 4: Scale (Q3 2026)
- [ ] Multi-state support (beyond Florida)
- [ ] Multi-tenant architecture
- [ ] Role-based access control
- [ ] White-label for agencies
- [ ] API for third-party integrations

### Phase 5: Advanced Features (Q4 2026)
- [ ] Direct CRM integrations (Salesforce, HubSpot, Clio)
- [ ] Case outcome tracking
- [ ] Revenue forecasting
- [ ] Competitive intelligence
- [ ] Regulatory compliance automation

## 9. Risks & Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| County websites change | High | Medium | Monitor, update scrapers, notify users |
| OpenAI rate limits | Medium | Low | Batch processing, caching, fallback |
| Database performance | High | Low | Indexing, caching, query optimization |
| Neon outage | High | Low | Connection pooling, retry logic |

### Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Ethical violations | High | Medium | Compliance features, user education |
| Data privacy concerns | High | Medium | Encryption, retention policies, terms |
| Competition | Medium | High | Feature velocity, customer success |
| Market adoption | High | Medium | Freemium model, demos, testimonials |

### Legal Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Bar ethics complaints | High | Low | Disclaimer, compliance mode, attorney approval |
| CFAA violations | High | Very Low | Public data only, respect robots.txt |
| Data breach | High | Low | Security audit, encryption, access logs |
| Terms of service violations | Medium | Low | Review TOS of integrated platforms |

## 10. Pricing Strategy (Future)

### Free Tier
- 100 records/month
- 1 county
- Manual scraping only
- Basic analytics
- 7-day data retention

### Professional ($99/month)
- Unlimited records
- All 20 counties
- Scheduled scraping
- AI enrichment
- Full analytics
- CRM integrations
- 90-day retention
- Email support

### Enterprise ($499/month)
- Everything in Professional
- Multi-user (5 seats)
- API access
- White-label
- Dedicated support
- Custom integrations
- Unlimited retention
- SLA guarantee

## Appendix

### Glossary

- **Lead Score**: Automated 0-100 score based on charge severity, bond amount, demographics
- **AI Enrichment**: OpenAI classification of charges and risk assessment
- **Fuzzy Matching**: Levenshtein distance algorithm for duplicate detection
- **Prospect**: CRM contact derived from arrest record or manual entry
- **Campaign**: Outreach effort targeting specific prospect segment

### References

- See `docs/ARCHITECTURE.md` for technical details
- See `docs/OPERATIONS.md` for runbooks
- See `docs/PRD/FEATURES/` for detailed feature specs
- See `server/openapi.yml` for API documentation

### Change Log

- **2025-11-02**: Initial PRD creation
- **Future**: Version updates tracked here
