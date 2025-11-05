# Attorney Leads - Florida Arrest Records Platform

## Overview
A professional B2B web application designed to scrape Florida arrest records and manage attorney leads. This platform enables legal professionals to generate leads by collecting, filtering, and exporting arrest records from various Florida counties. It integrates comprehensive CRM functionalities for automated prospect discovery, outreach, and meeting scheduling. The project is production-ready, featuring core scraping capabilities alongside advanced CRM integrations.

## User Preferences
I prefer detailed explanations.
Do not make changes to the `scripts/dbReset.ts` file.

## System Architecture

### Tech Stack
- **Frontend**: React + TypeScript, Wouter, TanStack Query, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Data Validation**: Zod
- **Algorithms**: Levenshtein distance for fuzzy matching

### Key Features
- **Data Acquisition**: Multi-county scraping for 20 major Florida counties using Python microservices (BeautifulSoup4).
- **Lead Management**: Lead scoring (0-100 based on charge severity, bond, demographics), duplicate detection with fuzzy matching, and AI enhancement (GPT-4o-mini for charge categorization).
- **CRM Integration**: Prospect discovery (LinkedIn/Facebook scraping), lead generation forms, automated meeting scheduling (Calendly), and bi-directional Google Sheets sync.
- **Analytics & Monitoring**: Real-time job monitoring, analytics dashboard with Recharts visualizations, and comprehensive records management.
- **Observability**: Liveness (`/healthz`), readiness (`/readyz`), and Prometheus metrics (`/metrics`) endpoints.
- **Security**: Structured logging with PII redaction, request IDs, CSP, X-Frame-Options, HSTS-ready headers, and rate limiting.

### Data Models
- **ArrestRecord**: Core data including leadScore and AI fields.
- **ScrapeJob**: Tracks scraping tasks.
- **CRMSyncLog**: Export/sync history.
- **DuplicateCandidate**: Records potential duplicates.
- **CrmProspect**: Manages prospect details.
- **OutreachCampaign**: Tracks campaign progress.
- **ScheduledMeeting**: Manages meeting logistics.

### Design Guidelines
The application follows a professional B2B design inspired by Carbon Design System principles, using Inter and Space Grotesk typography, a blue primary color scheme, and Shadcn UI components for consistency and accessibility.

### API Endpoints
The API includes endpoints for core operations (stats, scrape management, record retrieval, export), deduplication, analytics, and comprehensive CRM functionalities (prospects, discovery, outreach, meetings, sheets sync). New observability endpoints (`/healthz`, `/readyz`, `/metrics`) are also implemented.

## External Dependencies
- **PostgreSQL (Neon)**: Primary database for persistent storage.
- **OpenAI GPT-4o-mini**: Integrated for AI-powered charge categorization and risk assessment.
- **PhantomBuster**: Used for automated prospect discovery from LinkedIn and Facebook.
- **Calendly**: Integrated for automated meeting scheduling.
- **Google Sheets API**: Provides bi-directional synchronization for prospects and arrest records.
- **Prometheus**: For collecting and monitoring application metrics via the `/metrics` endpoint.