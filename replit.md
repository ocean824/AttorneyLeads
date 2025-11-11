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
- **Multi-LLM Fallback System**: Production-ready intelligent router supporting OpenAI (GPT-4o-mini), Anthropic (Claude Sonnet 4.5), and Google (Gemini 2.5 Flash). Automatic fallback on API failures or timeouts (>15s), with latency/token tracking and health monitoring at GET `/api/agent/llm/health`.
- **Enhanced Scraper Engine**: Expanded database schema with new tables (`arrest_documents`, `court_dockets`, `agent_interactions`, `delivery_logs`, `notification_history`), performance indexes, and Python retrieval modules for documents and court dockets with fuzzy matching and retry logic.
- **Appointment Scheduling System**: Complete appointment booking integration with admin calendar management at `/admin/calendar` and embedded booking dialog in AI Agent chat. Features weekly recurring availability slots, timezone auto-detection, session linking, multi-step booking flow, and comprehensive CRUD API endpoints. Supports case type categorization, visitor contact management, and booking status tracking (confirmed/cancelled/completed/no_show).
- **Stripe Billing Integration (Production-Ready)**: Complete 5-tier subscription billing with Stripe Checkout integration. Database schema includes Stripe fields (`plan`, `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `subscriptionCurrentPeriodEnd`). Billing UI at `/billing` with pricing cards for Free, Basic ($29.95), Standard ($59.95), Pro ($89.95), and Elite ($189.95). Stripe webhook handler at POST `/api/billing/webhook` with signature verification for subscription lifecycle events. Customer Portal integration for self-service billing management. Requires Stripe product/price configuration in Stripe Dashboard (see STRIPE_SETUP.md).

### Data Models
- **User Accounts**: `users`, `password_reset_tokens`, `user_backup_codes`, `user_trusted_devices`
- **Arrest Records**: `ArrestRecord`, `ScrapeJob`, `CRMSyncLog`, `DuplicateCandidate`
- **CRM**: `CrmProspect`, `OutreachCampaign`, `ScheduledMeeting`
- **Appointments**: `appointment_slots`, `appointment_bookings`
- **AI/Scraper Enhancements**: `arrest_documents`, `court_dockets`, `agent_interactions`, `delivery_logs`, `notification_history`

### Design Guidelines
The application follows a professional B2B design inspired by Carbon Design System principles, using Inter and Space Grotesk typography, a blue primary color scheme, and Shadcn UI components.

### API Endpoints
- **Authentication**: `/api/auth/*` (login, logout, 2FA setup/verify, password reset, trusted devices, etc.)
- **Admin Panel**: `/api/admin/*` (user management, bootstrap)
- **Core Operations**: Stats, scrape management, record retrieval, export, deduplication, analytics.
- **CRM**: Prospects, discovery, outreach, meetings, sheets sync.
- **Appointments**: `/api/appointments/*` (availability, booking, admin slot CRUD, booking management).
- **Billing**: `/api/billing/*` (plans, subscription status, checkout session, portal session, webhook).
- **Observability**: `/healthz`, `/readyz`, `/metrics`.
- **AI Agent**: `/api/agent/*` (chat, session management, LLM health check).

### Security Middleware
- `loggerMiddleware.ts`: Request logging with X-Request-Id.
- `securityHeaders.ts`: CSP, X-Frame-Options, etc.
- `rateLimiter.ts`: In-memory rate limiting.
- `protectDashboard.ts`: Server-side HTML guard for protected routes.

## External Dependencies
- **PostgreSQL (Neon)**: Primary database.
- **AI Providers** (via Replit AI Integrations, billed to credits):
  - **OpenAI GPT-4o-mini**: Primary LLM for charge categorization and AI agent chat.
  - **Anthropic Claude Sonnet 4.5**: Secondary fallback LLM.
  - **Google Gemini 2.5 Flash**: Tertiary fallback LLM.
- **PhantomBuster**: Prospect discovery from LinkedIn and Facebook.
- **Calendly**: Automated meeting scheduling.
- **Google Sheets API**: Bi-directional synchronization.
- **Prometheus**: Metrics collection and monitoring.
- **Stripe**: Complete subscription billing with 5-tier pricing. Requires STRIPE_SECRET_KEY, VITE_STRIPE_PUBLIC_KEY, and product price IDs (see STRIPE_SETUP.md).
- **Twilio**: (Optional) SMS for OTP.
- **SMTP Service**: (Optional) Email for password reset/OTP.

## Multi-LLM Fallback System (Production-Ready)

### Architecture
The system uses an intelligent router (`server/llm/router.ts`) that automatically switches between AI providers:

**Fallback Order**: OpenAI → Claude → Gemini

**Triggers**:
- API failures (rate limits, auth errors, service outages)
- Latency exceeding 15 seconds
- Provider-specific errors

### Features
- **Token Usage Tracking**: All responses include `tokensUsed` for billing analytics
- **Latency Monitoring**: Every request tracks `latencyMs` for performance observability
- **Health Checks**: GET `/api/agent/llm/health` returns real-time provider status
- **Zero-Config**: Uses Replit AI Integrations (no API keys required, billed to credits)

### Configuration
Default settings per provider (configurable in `server/llm/router.ts`):

```typescript
OpenAI: { model: 'gpt-4o-mini', maxTokens: 2000, temperature: 0.7, timeoutMs: 15000 }
Claude: { model: 'claude-sonnet-4-5', maxTokens: 2000, temperature: 0.7, timeoutMs: 15000 }
Gemini: { model: 'gemini-2.5-flash', maxTokens: 2000, temperature: 0.7, timeoutMs: 15000 }
```

### Integration
The AI Agent service (`server/agent-service.ts`) automatically uses the multi-LLM router. All chat interactions benefit from automatic failover without code changes.

### Testing
Health check endpoint validates all providers:
```bash
curl http://localhost:5000/api/agent/llm/health
# Response: { "openai": true, "claude": true, "gemini": true }
```