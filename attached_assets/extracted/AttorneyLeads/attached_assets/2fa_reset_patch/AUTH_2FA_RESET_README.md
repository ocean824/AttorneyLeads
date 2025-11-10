
# Patch: Password Reset (email token) + TOTP 2FA

This patch adds a secure password reset flow and optional TOTP-based two-factor auth.

## New server files
- `server/security/crypto.ts` — AES‑256‑GCM helpers (no external deps)
- `server/security/totp.ts` — Base32 + RFC 6238 TOTP (no external deps)
- `server/email.ts` — SMTP mail via dynamic `nodemailer` import (falls back to console)
- `server/auth-routes.ts` — updated with password reset + TOTP endpoints
- `server/types/session.d.ts` — adds `pending2fa` and `totpSetup` typing

## Schema additions
- `shared/schema.ADD.ts` — contains additive definitions:
  - `password_reset_tokens` table
  - Adds `totpEnabled` and `totpSecretEnc` columns to `users`
> Apply via your usual Drizzle migration (e.g., add these fields to `shared/schema.ts` and run `npm run db:push`).

## Client pages
- `client/src/pages/forgot.tsx` — request reset email
- `client/src/pages/reset.tsx` — set new password (token in URL)
- `client/src/pages/2fa.tsx` — enter TOTP during login
- `client/src/pages/account-security.tsx` — enable/verify/disable TOTP
- `client/src/pages/login.tsx` — updated to handle `requires2fa`, includes "Forgot password?" link

Also included:
- `client/src/App.ROUTES.ADD.txt` with the exact routes to insert
- `client/src/components/layout/header.ADD.txt` with a snippet to add an **Account** link

## Env vars
Add to your `.env`:
```
# App
APP_URL=https://your-domain-or-replit.app

# Sessions (existing)
SESSION_SECRET=change-me-long
AUTH_ENC_KEY=another-long-secret-used-for-encryption

# SMTP (optional; fallback logs email to console)
SMTP_HOST=smtp.youremail.com
SMTP_PORT=587
SMTP_USER=apikey-or-username
SMTP_PASS=supersecret
SMTP_FROM="Attorney Leads <no-reply@yourdomain.com>"

# TOTP
TOTP_ISSUER=AttorneyLeads
```

## Endpoints summary
Auth:
- `POST /api/auth/login` → returns `{ requires2fa: true }` when TOTP enabled
- `POST /api/auth/logout`
- `GET  /api/auth/whoami`

Password reset:
- `POST /api/auth/request-password-reset` { email }
- `POST /api/auth/reset-password` { token, password }

2FA (requires session unless noted):
- `POST /api/auth/totp/login-verify` { token }  — completes login when `requires2fa`
- `POST /api/auth/totp/status` — { enabled }
- `POST /api/auth/totp/setup/start` — returns `{ otpauthURI, qrImageUrl, secretBase32 }`
- `POST /api/auth/totp/setup/verify` { token } — enables 2FA
- `POST /api/auth/totp/disable` { password } — disables 2FA

## How to integrate
1. **Merge schema:** copy `shared/schema.ADD.ts` contents into your main `shared/schema.ts` (users table: add `totpEnabled`, `totpSecretEnc`; create `password_reset_tokens`).
2. **Run migration:** `npm run db:push`
3. **Replace server routes:** overwrite `server/auth-routes.ts` with the version in this patch.
4. **Ensure sessions:** your `server/index.ts` already calls `setupSession(app)` from the prior patch.
5. **Add client pages:** copy the new pages, update router with routes shown in `client/src/App.ROUTES.ADD.txt`, and add an "Account" link (snippet included).
6. **Set env vars** and (optionally) `npm i nodemailer` if you want real SMTP.

That’s it — you’ll have secure password reset and TOTP 2FA wired end‑to‑end.
