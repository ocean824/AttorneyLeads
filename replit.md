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
- **Authentication & Security**: Complete session-based auth with password reset, TOTP 2FA with QR codes, backup codes (with PDF export), email/SMS OTP fallback, enforced admin 2FA, admin hard-gate TOTP setup enforcement, and trusted device recognition (30-day 2FA bypass). AES-256-GCM encryption for TOTP secrets, bcrypt for passwords, SHA-256 for device tokens and backup tokens.
- **CRM Integration**: Prospect discovery (LinkedIn/Facebook scraping), lead generation forms, automated meeting scheduling (Calendly), and bi-directional Google Sheets sync.
- **Analytics & Monitoring**: Real-time job monitoring, analytics dashboard with Recharts visualizations, and comprehensive records management.
- **Observability**: Liveness (`/healthz`), readiness (`/readyz`), and Prometheus metrics (`/metrics`) endpoints.
- **Security**: Structured logging with PII redaction, request IDs, CSP, X-Frame-Options, HSTS-ready headers, and rate limiting.

### Data Models
- **users**: User accounts with roles, encrypted TOTP secrets, and phone numbers
- **password_reset_tokens**: Temporary password reset tokens
- **user_backup_codes**: Hashed backup codes for 2FA fallback
- **user_trusted_devices**: Trusted devices for 2FA bypass (30-day TTL)
- **ArrestRecord**: Core data including leadScore and AI fields
- **ScrapeJob**: Tracks scraping tasks
- **CRMSyncLog**: Export/sync history
- **DuplicateCandidate**: Records potential duplicates
- **CrmProspect**: Manages prospect details
- **OutreachCampaign**: Tracks campaign progress
- **ScheduledMeeting**: Manages meeting logistics

### Design Guidelines
The application follows a professional B2B design inspired by Carbon Design System principles, using Inter and Space Grotesk typography, a blue primary color scheme, and Shadcn UI components for consistency and accessibility.

### API Endpoints
**Authentication:**
- `/api/auth/bootstrap` - Create initial admin user
- `/api/auth/login` - Login with email/password
- `/api/auth/whoami` - Get current session user
- `/api/auth/logout` - Destroy session
- `/api/auth/forgot` - Request password reset
- `/api/auth/reset` - Reset password with token
- `/api/auth/2fa/setup/start` - Begin TOTP setup
- `/api/auth/2fa/setup/verify` - Complete TOTP setup
- `/api/auth/2fa/verify` - Verify TOTP during login
- `/api/auth/2fa/disable` - Disable TOTP
- `/api/auth/backup/verify` - Login with backup code
- `/api/auth/otp/send` - Send email/SMS OTP
- `/api/auth/otp/verify` - Verify email/SMS OTP
- `/api/auth/2fa/status` - Check 2FA status
- `/api/auth/2fa/regenerate-backup` - Generate new backup codes
- `/api/auth/backup-codes/pdf` - Export backup codes as PDF
- `/api/auth/trusted-devices` - Trust current device (POST), list devices (GET)
- `/api/auth/trusted-devices/:id` - Revoke trusted device (DELETE)
- `/api/account/phone` - Update phone number

**Core Operations:**
Stats, scrape management, record retrieval, export, deduplication, analytics

**CRM:**
Prospects, discovery, outreach, meetings, sheets sync

**Observability:**
`/healthz`, `/readyz`, `/metrics`

## Required Environment Variables
**Authentication (Required):**
- `AUTH_ENC_KEY` - **REQUIRED** 32+ character secure random string for AES-256-GCM encryption of TOTP secrets. Application will fail to start if missing or too short.
- `SESSION_SECRET` - Session encryption secret
- `TOTP_ISSUER` - TOTP issuer name (e.g., "Attorney Leads")
- `APP_URL` - Base application URL (e.g., http://localhost:5000)
- `ENFORCE_2FA_FOR_ADMINS` - Set to "true" to require all admin users have 2FA enabled
- `ENFORCE_ADMIN_TOTP_SETUP` - Set to "true" to require admin users complete TOTP setup before accessing fallback auth (prevents bypass)
- `TRUSTED_DEVICE_DAYS` - Number of days a trusted device remains valid (default: 30)
- `DEVICE_COOKIE_NAME` - Name of the device cookie (default: "device_token")

**Optional:**
- `SMTP_*` - Email configuration for real password reset/OTP emails (falls back to console logging)
- `TWILIO_*` - SMS configuration for SMS OTP (falls back to console logging)

## External Dependencies
- **PostgreSQL (Neon)**: Primary database for persistent storage
- **OpenAI GPT-4o-mini**: Integrated for AI-powered charge categorization and risk assessment
- **PhantomBuster**: Used for automated prospect discovery from LinkedIn and Facebook
- **Calendly**: Integrated for automated meeting scheduling
- **Google Sheets API**: Provides bi-directional synchronization for prospects and arrest records
- **Prometheus**: For collecting and monitoring application metrics via the `/metrics` endpoint

## Recent Changes (November 2025)
- **Complete Authentication System**: Integrated comprehensive auth with password reset, TOTP 2FA, backup codes, email/SMS fallback, and admin 2FA enforcement
- **Advanced Authentication Features** (Latest):
  - **Admin Hard-Gate TOTP Setup**: `ENFORCE_ADMIN_TOTP_SETUP` flag prevents admins from using fallback authentication until TOTP is configured, eliminating 2FA bypass vulnerability
  - **Trusted Device Recognition**: 30-day 2FA bypass for trusted devices with cryptographically secure tokens, httpOnly cookies, and SHA-256 hashing
  - **Backup Codes PDF Export**: Download printable backup codes as PDF for secure offline storage
  - **Devices Management**: `/account/devices` page to view and revoke trusted devices
  - **Enhanced 2FA UX**: "Trust this device" checkbox on all 2FA verification pages
- **Security Enhancements**: AES-256-GCM encryption for TOTP secrets, proper sanitization of API responses to prevent secret exposure, fail-fast validation for AUTH_ENC_KEY, server-side device token generation and hashing
- **Session Management**: PostgreSQL-backed sessions with proper cookie handling, device cookie clearing on logout, and session flags for admin hard-gate enforcement