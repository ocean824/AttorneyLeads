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
- **Data Acquisition**: Multi-county scraping for 20 major Florida counties using Python microservices.
- **Lead Management**: Lead scoring, duplicate detection with fuzzy matching, and AI enhancement (GPT-4o-mini for charge categorization).
- **Authentication & Security**: Complete session-based auth with password reset, TOTP 2FA (with QR codes, backup codes, PDF export), email/SMS OTP fallback, enforced admin 2FA, admin hard-gate TOTP setup enforcement, and trusted device recognition. Uses AES-256-GCM for TOTP secrets, bcrypt for passwords, SHA-256 for tokens.
- **CRM Integration**: Prospect discovery (LinkedIn/Facebook scraping), lead generation forms, automated meeting scheduling (Calendly), and bi-directional Google Sheets sync.
- **Analytics & Monitoring**: Real-time job monitoring, analytics dashboard with Recharts, and comprehensive records management.
- **Observability**: Liveness (`/healthz`), readiness (`/readyz`), and Prometheus metrics (`/metrics`) endpoints.
- **Security**: Structured logging with PII redaction, request IDs, CSP, X-Frame-Options, HSTS, and rate limiting.
- **AI Agent Assistant**: Production-ready conversational interface with session management, contextual arrest record integration, and secure API endpoints. Includes advanced chat UI with optimistic updates, error recovery, and session persistence.
- **Enhanced Scraper Engine**: Expanded database schema with new tables (`arrest_documents`, `court_dockets`, `agent_interactions`, `delivery_logs`, `notification_history`), performance indexes, and Python retrieval modules for documents and court dockets with fuzzy matching and retry logic.

### Data Models
- **User Accounts**: `users`, `password_reset_tokens`, `user_backup_codes`, `user_trusted_devices`
- **Arrest Records**: `ArrestRecord`, `ScrapeJob`, `CRMSyncLog`, `DuplicateCandidate`
- **CRM**: `CrmProspect`, `OutreachCampaign`, `ScheduledMeeting`
- **AI/Scraper Enhancements**: `arrest_documents`, `court_dockets`, `agent_interactions`, `delivery_logs`, `notification_history`

### Design Guidelines
The application follows a professional B2B design inspired by Carbon Design System principles, using Inter and Space Grotesk typography, a blue primary color scheme, and Shadcn UI components.

### API Endpoints
- **Authentication**: `/api/auth/*` (login, logout, 2FA setup/verify, password reset, trusted devices, etc.)
- **Admin Panel**: `/api/admin/*` (user management, bootstrap)
- **Core Operations**: Stats, scrape management, record retrieval, export, deduplication, analytics.
- **CRM**: Prospects, discovery, outreach, meetings, sheets sync.
- **Observability**: `/healthz`, `/readyz`, `/metrics`.
- **AI Agent**: `/api/agent/*` (chat, session management).

### Security Middleware
- `loggerMiddleware.ts`: Request logging with X-Request-Id.
- `securityHeaders.ts`: CSP, X-Frame-Options, etc.
- `rateLimiter.ts`: In-memory rate limiting.
- `protectDashboard.ts`: Server-side HTML guard for protected routes.

## External Dependencies
- **PostgreSQL (Neon)**: Primary database.
- **OpenAI GPT-4o-mini**: AI for charge categorization and AI agent.
- **PhantomBuster**: Prospect discovery from LinkedIn and Facebook.
- **Calendly**: Automated meeting scheduling.
- **Google Sheets API**: Bi-directional synchronization.
- **Prometheus**: Metrics collection and monitoring.
- **Twilio**: (Optional) SMS for OTP.
- **SMTP Service**: (Optional) Email for password reset/OTP.