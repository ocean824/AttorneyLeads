# Testing & CI/CD Setup Guide

This document explains how to complete the setup for the comprehensive testing and CI/CD infrastructure.

## Phase 1: E2E Testing (COMPLETED)

The following has been installed and configured:

### Dependencies Installed
- ✅ `vitest` - Testing framework
- ✅ `supertest` - HTTP testing
- ✅ `better-sqlite3` - In-memory SQLite for tests
- ✅ `@types/supertest`, `@types/better-sqlite3` - TypeScript types
- ✅ `pdfkit`, `@types/pdfkit` - PDF generation for backup codes

### Files Added
- ✅ `vitest.config.ts` - Vitest configuration with coverage thresholds
- ✅ `server/test/schema.mock.ts` - SQLite mock schema for tests
- ✅ `server/test/db.mock.ts` - In-memory database factory
- ✅ `server/test/app.factory.ts` - Express app factory for tests
- ✅ `tests/auth.e2e.test.ts` - Auth flow E2E tests (bootstrap → TOTP → trusted device)
- ✅ `tests/auth.fallback_pdf.test.ts` - Backup codes PDF and OTP fallback tests

### Required package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test:e2e": "vitest run -c vitest.config.ts --dir tests",
    "ci:run:full": "node scripts/ci.run.full.mjs",
    "docs:build": "node server/docs/generateOpenAPI.mjs",
    "badge:insert": "node scripts/insert-coverage-badge.mjs"
  }
}
```

## Phase 2: OpenAPI Documentation (PENDING)

The following needs to be integrated:

### Files to Add
- `server/docs/paths.json` - Route manifest for OpenAPI generation
- `server/docs/generateOpenAPI.mjs` - OpenAPI spec generator
- `server/docs/mountDocs.ts` - ReDoc UI mount for `/api/docs`

### Server Integration Required
In `server/index.ts`, add:
```typescript
import { registerDocsRoutes } from "./server/docs/mountDocs";
registerDocsRoutes(app);
```

### Test-Only OTP Response
For the fallback PDF test to work, add conditional OTP echo in `/api/auth/otp/send`:
```typescript
if (process.env.ALLOW_TEST_OTP_RESPONSE === "true" && process.env.NODE_ENV === "test") {
  return res.json({ ok: true, message: "...", testToken: token }); // Test-only
}
```

## Phase 3: CI/CD Infrastructure (PENDING)

### Files to Add
- `.github/workflows/ci.yml` - GitHub Actions workflow
- `scripts/ci.run.full.mjs` - CI runner with coverage badge generation
- `scripts/replit-ci.sh` - Replit CI hook
- `replit.nix` - Node 20 environment
- `.replit` - Replit configuration

### GitHub Pages Setup
1. Enable Pages in repository settings (Source: GitHub Actions)
2. Push to `main` branch to trigger workflow
3. Docs will be available at `https://<user>.github.io/<repo>/openapi.json`

## Phase 4: Coverage Badge (PENDING)

### Files to Add
- `scripts/insert-coverage-badge.mjs` - Auto-insert coverage badge in README
- Update `client/src/components/layout/header.tsx` - Add API docs link

## Running Tests

Once scripts are added to package.json:

```bash
# Run E2E tests
npm run test:e2e

# Run full CI suite (tests + coverage + docs generation)
npm run ci:run:full

# Build OpenAPI docs only
npm run docs:build

# Insert coverage badge in README
npm run badge:insert
```

## Test Coverage Thresholds

The vitest.config.ts enforces these thresholds:
- **Lines**: ≥ 80%
- **Statements**: ≥ 80%
- **Functions**: ≥ 75%
- **Branches**: ≥ 70%

## Environment Variables for Tests

Tests use these environment variables:
- `AUTH_ENC_KEY` - Required for TOTP encryption
- `ENFORCE_2FA_FOR_ADMINS` - Test admin 2FA enforcement
- `ENFORCE_ADMIN_TOTP_SETUP` - Test hard-gate TOTP flow
- `ALLOW_TEST_OTP_RESPONSE` - Enable test-only OTP token echo
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` - Bootstrap credentials

## Next Steps

1. ✅ **Phase 1 Complete** - E2E testing infrastructure ready
2. ⏳ **Add package.json scripts** manually (see above)
3. ⏳ **Phase 2** - Integrate OpenAPI documentation
4. ⏳ **Phase 3** - Set up CI/CD with GitHub Actions
5. ⏳ **Phase 4** - Add coverage badge automation
