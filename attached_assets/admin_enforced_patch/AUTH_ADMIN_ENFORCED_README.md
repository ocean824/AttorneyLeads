
# Patch: Backup Codes + Email/SMS OTP Fallback + Enforced 2FA for Admins

This patch layers on top of the previous auth & TOTP work.

## What it adds
- **Admin-only enforcement** (enable with `ENFORCE_2FA_FOR_ADMINS=true`)
  - Admins must complete a second factor at login; if TOTP isn’t enabled, they can use Email/SMS OTP.
- **Backup Codes**
  - Generate 10 one-time codes; each can be used once to pass 2FA.
  - Server stores **SHA-256 hashes**, client sees plaintext **once**.
- **OTP Fallback**
  - Email (always) and SMS (if user phone set) 6-digit codes, 10-minute expiry.
  - Twilio integration via environment variables; otherwise logs to console.

## Files
- `shared/schema.ADD_BACKUP_SMS.ts` — add `phone` to users and new `user_backup_codes` table
- `server/sms.ts` — Twilio (fetch) with console fallback
- `server/auth-routes.BACKUP_OTP_ENFORCE.ts` — routes for admin enforcement, backup codes, and fallback OTP
- `server/types/session.d.ts` — adds `pending2faOtp`
- `client/src/pages/2fa-fallback.tsx` — UI for Email/SMS code login
- `client/src/pages/account-security.tsx` — updated with phone + backup codes
- `client/src/pages/login.NOTE.txt` — guidance for routing
- `client/src/App.ROUTES.FALLBACK.ADD.txt` — router snippet

## Env vars
```
# Enforce 2FA for admins:
ENFORCE_2FA_FOR_ADMINS=true

# Twilio (optional for SMS)
TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TOKEN=your_auth_token
TWILIO_FROM=+15551234567
```

## Integrate
1) **Schema**: merge `shared/schema.ADD_BACKUP_SMS.ts` into your `shared/schema.ts` and run `npm run db:push`.
2) **Server**: replace or merge `server/auth-routes.ts` with the logic in `server/auth-routes.BACKUP_OTP_ENFORCE.ts`; add `server/sms.ts`; update `server/types/session.d.ts`.
3) **Client**: add `/2fa-fallback` route (snippet provided). Replace `account-security.tsx` with the patch version.
4) **Env**: set `ENFORCE_2FA_FOR_ADMINS=true`. Add Twilio vars if you want SMS.

### Login flow with enforcement
- User enters email/password → server responds with `{ requires2fa: true, methods, adminMustSetup2fa, destinations }`.
- If `methods.totp`, show TOTP page (**or** offer choice: TOTP, backup code, or fallback).
- If not, send to `/2fa-fallback` and let them receive Email/SMS code.
- On success, full session is created.

> Tip: Keep TOTP + backup codes as your primary path; fallback OTP is best as an emergency option.
