# Attorney Leads - Florida Arrest Records Platform

## Overview
A professional B2B web application for scraping Florida arrest records and managing attorney leads. The platform enables legal professionals to collect, filter, and export arrest records from multiple Florida counties for lead generation purposes.

## Current State
**Phase**: Task 1 Complete - Schema & Frontend Implementation
- All data models and TypeScript interfaces defined
- Complete frontend UI built with exceptional visual quality
- Dashboard, Records Management, and Jobs pages implemented
- Export functionality UI ready

## Recent Changes
- **2025-02-11**: Initial project setup and complete frontend implementation
  - Defined ArrestRecord, ScrapeJob, and CRMSyncLog data schemas
  - Built comprehensive dashboard with stats cards and scraping action panel
  - Implemented records management page with advanced filtering and pagination
  - Created jobs monitoring interface with real-time status tracking
  - Added export modal for CSV and JSON format exports
  - Configured professional B2B design system following Carbon Design principles

## Project Architecture

### Tech Stack
- **Frontend**: React + TypeScript, Wouter routing, TanStack Query
- **Backend**: Express.js, Node.js
- **Database**: In-memory storage (MemStorage) for MVP
- **Styling**: Tailwind CSS + Shadcn UI components
- **Data Validation**: Zod schemas

### Data Models
1. **ArrestRecord**: Core arrest record data (name, charges, booking date, bond amount, demographics, facility)
2. **ScrapeJob**: Job tracking (counties, status, records found, duration)
3. **CRMSyncLog**: Export and sync history

### Key Features
- **Dashboard**: Real-time statistics, quick actions, recent jobs preview
- **Records Management**: Comprehensive table with search, filtering, pagination, and bulk selection
- **Job Monitoring**: Real-time job status tracking with progress indicators
- **Export System**: CSV (PhantomBuster-compatible) and JSON export formats
- **Multi-County Scraping**: Support for 20 major Florida counties

### Florida Counties Supported
Miami-Dade, Broward, Palm Beach, Hillsborough, Orange, Pinellas, Duval, Lee, Polk, Brevard, Volusia, Pasco, Seminole, Sarasota, Manatee, Collier, Osceola, Marion, Escambia, Lake

## Design Guidelines
The application follows a professional B2B data application design approach based on Carbon Design System principles:
- **Typography**: Inter (body) + Space Grotesk (headings)
- **Color Scheme**: Professional blue primary (#2563EB) with muted backgrounds
- **Layout**: Max-width containers, consistent 6-8 padding, responsive grid layouts
- **Components**: Shadcn UI for consistency and accessibility
- **Interactions**: Subtle hover states, loading skeletons, toast notifications

## API Endpoints (To Be Implemented)
- `GET /api/stats` - Dashboard statistics
- `POST /api/scrape/start` - Start new scraping job
- `GET /api/scrape/jobs` - List all scraping jobs
- `GET /api/scrape/status/:jobId` - Get job status
- `GET /api/records` - List arrest records (with pagination & filters)
- `GET /api/records/:id` - Get single record details
- `POST /api/records/export` - Export records as CSV or JSON

## Next Steps
1. **Task 2**: Implement complete backend with storage interface and API routes
2. **Task 3**: Connect frontend to backend, add error handling, and test all features
3. Future: Add PostgreSQL persistence, scheduled scraping, direct CRM integrations

## Development Notes
- Frontend uses TanStack Query for all data fetching
- All forms validated with Zod schemas
- Loading states and error handling built into all components
- Responsive design tested for mobile, tablet, and desktop
- Follows accessibility best practices (ARIA labels, keyboard navigation)
