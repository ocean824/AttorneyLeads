# Security Overview – AttorneyLeads

This document describes the current security posture, assumptions, and controls for the AttorneyLeads application.

> **Assumed Deployment Model:** Single-tenant deployment in a private Replit workspace, not directly exposed as a multi-tenant SaaS. If you decide to expose this publicly, you MUST harden and extend the controls described here.

---

## 1. Threat Model & Assumptions

### Assets

- **Arrest records and enriched lead data** (personally identifiable information)
- **API keys and credentials:**
  - `DATABASE_URL` (Postgres/Neon)
  - OpenAI / Replit AI integration keys
  - PhantomBuster, Calendly, Google Sheets tokens
- **Application source code and configuration**

### Trust Boundaries

- **Trusted:** Replit workspace, environment variables (Secrets), Neon Postgres
- **Untrusted:** HTTP clients (browsers, scripts), external county jail websites, 3rd-party APIs (PhantomBuster, Calendly, Google, OpenAI)

### High-Level Risks

- Unauthorized access to `/api/**` if the app is exposed publicly
- Abuse of scrape and AI endpoints (rate abuse, cost escalation)
- Leakage of secrets or PII via logs
- Injection or SSRF-like issues from unvalidated external URLs
- Data breaches exposing arrest records and CRM data

---

## 2. Authentication & Authorization Model

> **Current State:** There is no full user login system yet; access is effectively gated by Replit workspace/private URL. This model is **NOT** sufficient for a public SaaS deployment.

### Planned Roles

See `config/permissions.ts` for implementation details.

- **Admin/Owner**
  - Full control over settings, counties, integrations
  - Can run any scrape, manage CRM and analytics
  - Can configure API keys and webhooks
  
- **Attorney**
  - Can view records, leads, campaigns, and meetings
  - Can start scrapes and export data
  - Cannot manage integrations or delete records
  
- **Intake Specialist**
  - Can view and update leads, run scrapes, manage duplicates
  - Full CRM access (prospects, campaigns, meetings)
  - Cannot delete records or manage integrations
  
- **Read-Only Analyst**
  - Can view analytics & exports only
  - Cannot mutate any data

### Authorization Matrix

| Action                                      | Owner | Attorney | Intake | Analyst |
|---------------------------------------------|:-----:|:--------:|:------:|:-------:|
| Start scrape (`POST /api/scrape/start`)     |  ✓    |    ✓     |   ✓    |    ✗    |
| View records (`GET /api/records`)           |  ✓    |    ✓     |   ✓    |    ✓    |
| Delete record (`DELETE /api/records/{id}`)  |  ✓    |    ✓     |   ✗    |    ✗    |
| Run duplicate scan                          |  ✓    |    ✓     |   ✓    |    ✗    |
| Merge / dismiss duplicates                  |  ✓    |    ✓     |   ✓    |    ✗    |
| Manage CRM prospects / campaigns            |  ✓    |    ✓     |   ✓    |    ✗    |
| Schedule meetings                           |  ✓    |    ✓     |   ✓    |    ✗    |
| View analytics                              |  ✓    |    ✓     |   ✓    |    ✓    |
| Manage integrations (keys, webhooks)        |  ✓    |    ✗     |   ✗    |    ✗    |

> Implementing this matrix requires an auth layer (JWT/session) and the `permissions.ts` module that maps roles → actions. This doc is the blueprint.

---

## 3. Input Validation & Output Sanitization

### Input Validation

- **All external request payloads** MUST be validated with `zod` schemas in the controller layer before reaching services
- **Query parameters** (e.g., `dateFrom`, `county`, `search`) MUST be parsed and validated to prevent abusive patterns and reduce injection risk
- **File uploads** (if implemented) MUST be validated for type, size, and content
- **County names** are validated against a whitelist of 20 Florida counties

### Output Sanitization

- API responses MUST return explicitly shaped objects (no raw DB rows with internal fields)
- PII is only included when necessary (name, booking info), never secrets
- Error messages MUST NOT expose stack traces or internal paths to clients
- Logs MUST redact sensitive data via structured logger

### SQL Injection Protection

- **Drizzle ORM** is used exclusively for database access (no raw SQL strings)
- Parameterized queries prevent SQL injection
- Dynamic SQL (if needed) MUST use Drizzle's `sql` tagged template literals

---

## 4. Rate Limiting & Abuse Prevention

We apply **route-level rate limits** (IP-based) via an in-memory limiter:

### Default Limits

Configured in `config/rateLimits.ts`:

- **Public/readonly endpoints** (stats, analytics, records list): `100 req / 15 min / IP`
- **Heavy endpoints** (scrape start, AI enrichment, external sync): `10 req / 15 min / IP`
- **Default bucket** (catch-all): `100 req / 15 min / IP`

### Implementation

- Limits enforced in `server/middleware/rateLimiter.ts`
- Sliding window algorithm with automatic cleanup
- Returns `429 Too Many Requests` with `Retry-After` header

### Specific Route Limits

| Route | Window | Max Requests |
|-------|--------|--------------|
| `POST /api/scrape/start` | 15 min | 10 |
| `POST /api/ai/enhance` | 15 min | 10 |
| `POST /api/crm/discover` | 15 min | 10 |
| `POST /api/crm/outreach/send` | 15 min | 10 |
| `POST /api/crm/sheets/sync-*` | 15 min | 10 |
| `GET /api/records` | 15 min | 120 |
| `GET /api/stats` | 15 min | 100 |

> **Production Note:** For multi-node setups, this MUST be replaced with a shared-store limiter (Redis, Postgres counters, or API gateway).

---

## 5. Logging, PII & Secrets

### Structured Logging

- Lightweight structured logger (`server/logger.ts`) with JSON output
- All logs include: `level`, `timestamp`, `message`, optional `requestId` and `route`
- HTTP requests logged with method, path, status, and duration

### PII Redaction

All log entries MUST pass through automatic redaction that strips/masks:

- **Environment variables** (DATABASE_URL, API keys, tokens)
- **API keys/secrets** (any field containing: `key`, `secret`, `token`, `authorization`)
- **PII fields** (`email`, `phone`, `ssn`, `phoneNumber`)
- **High-entropy strings** (>16 chars, likely API keys)

Example:
```typescript
logger.info("User created", { 
  email: "user@example.com",  // → "[REDACTED]"
  apiKey: "sk-1234..."         // → "[REDACTED]"
});
```

### Best Practices

Operators SHOULD:
- Avoid logging large payloads of arrest records
- Use sampling for noisy debug logs in high-throughput contexts
- Never log request bodies containing credentials
- Review logs regularly for accidental secret exposure

---

## 6. Security Headers

We apply the following headers via `server/middleware/securityHeaders.ts`:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer info |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates browsing context |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Requires CORP for resources |
| `Content-Security-Policy` | See below | Restricts resource loading |

### Content Security Policy (CSP)

Current baseline CSP (adjust for your frontend):

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
connect-src 'self' https://api.openai.com https://*.replit.com;
frame-ancestors 'none';
```

> **Production:** Remove `'unsafe-inline'` and use nonces/hashes for inline scripts/styles.

---

## 7. Secrets Management & Secret Scanning

### Storage

- All secrets MUST be stored only in Replit's Secrets panel or equivalent
- `.env` files MUST NOT be committed (`.env` is in `.gitignore`)
- `.env.example` provides template without actual values

### Development

When debugging locally, developers MUST:
- Keep `.env.local` untracked
- Avoid printing env values to logs
- Use `logger.info()` instead of `console.log()` to ensure redaction

### Secret Scanning (Recommended)

> **Current State:** No CI pipeline exists yet.

Recommended future additions:
- **Pre-commit hook** using `gitleaks` or `trufflehog` to scan staged changes
- **CI/CD integration** to block merges when secrets detected
- **Automated scanning** of logs and backups

### Rotation Policy

- Rotate API keys quarterly or after suspected exposure
- Update Replit Secrets immediately after rotation
- Test application after rotation to ensure no disruption

---

## 8. Third-Party Integrations

All outbound requests to third-party APIs MUST:

### General Requirements

- Use **HTTPS only**
- Avoid user-controlled URLs (no open redirect/SSRF)
- Validate responses before processing
- Handle errors gracefully without exposing internals
- Log integration failures for monitoring

### Specific Integrations

#### OpenAI / Replit AI
- Tokens stored as secrets
- No logging of raw API responses (may contain PII)
- Rate limiting applied to prevent quota burn
- Graceful fallback when AI unavailable

#### PhantomBuster
- Configured with known "agent IDs" only (not user-provided)
- Results validated before database insertion
- Deduplication prevents duplicate prospect creation
- Mock fallback when API unavailable

#### Calendly
- Tokens stored as secrets
- No logging of raw webhook payloads (contain sensitive booking info)
- Webhook signatures validated (when implemented)
- Meeting URLs sanitized before display

#### Google Sheets
- Sheet IDs validated (must be configured, not user-supplied where possible)
- OAuth tokens rotated regularly
- Read-only access preferred where possible
- Mock fallback when API unavailable

---

## 9. Data Protection & Privacy

### Data Classification

| Type | Examples | Protection |
|------|----------|------------|
| **Public** | County names, charge categories | No special handling |
| **Internal** | Scrape job IDs, analytics | Auth required (future) |
| **Confidential** | Arrest records, prospect emails | Encryption at rest (future) |
| **Secret** | API keys, database credentials | Replit Secrets, never logged |

### Encryption

- **In Transit:** All external communications use HTTPS
- **At Rest:** Database encryption provided by Neon (AES-256)
- **Application-level:** Not currently implemented (future enhancement)

### Data Retention

- **Arrest Records:** 90 days default (configurable via feature flags)
- **Scrape Jobs:** Indefinite (for audit trail)
- **CRM Prospects:** Indefinite (business requirement)
- **Logs:** 30 days (Replit default)

### GDPR/Privacy Considerations

If operating in EU or handling EU data:
- Implement data subject access request (DSAR) workflow
- Add "Right to be Forgotten" deletion capability
- Document legal basis for processing (legitimate interest)
- Add privacy policy and terms of service

---

## 10. Compliance & Legal

### Ethical Rules for Attorneys

Florida Bar rules prohibit:
- Solicitation within 30 days of incident (configurable delay)
- Misleading or deceptive marketing
- Sharing confidential information

**Implementation:**
- Add configurable "solicitation delay" in feature flags
- Require attorney approval before outreach
- Audit trail for all communications

### Public Records

- Only scrape **publicly available** data from county jail websites
- Respect `robots.txt` and terms of service
- Rate limiting prevents overloading county servers
- No scraping of restricted or confidential data

### Data Breach Response

In event of suspected breach:
1. Immediately disable public access
2. Rotate all API keys and secrets
3. Audit logs for unauthorized access
4. Notify affected parties as required by law
5. Document incident for compliance

---

## 11. Future Hardening Tasks

### Short-Term (Next Sprint)
- [ ] Implement full authentication (JWT or session-based)
- [ ] Enforce role-based permission matrix
- [ ] Add CSP violation reporting endpoint
- [ ] Implement webhook signature validation (Calendly)

### Medium-Term (Next Quarter)
- [ ] Replace in-memory rate limiting with Redis
- [ ] Add automated dependency scanning (npm audit / Snyk / Dependabot)
- [ ] Implement application-level encryption for PII
- [ ] Add audit logging for sensitive operations

### Long-Term (Next 6 Months)
- [ ] Implement data subject access request (DSAR) workflow
- [ ] Add intrusion detection system (IDS)
- [ ] Penetration testing by external security firm
- [ ] SOC 2 Type II compliance audit

---

## 12. Security Contacts

### Reporting Vulnerabilities

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. Email: security@attorneyleads.com (if established)
3. Include: description, steps to reproduce, impact assessment
4. Expected response time: 48 hours

### Security Team

- **Owner:** [Your Name]
- **Reviewers:** [Team Members]
- **External Auditor:** [TBD]

---

## 13. Security Checklist

Use this checklist before each deployment:

### Pre-Deployment
- [ ] All secrets in Replit Secrets (not committed)
- [ ] Dependencies updated (`npm audit` clean)
- [ ] Rate limits configured appropriately
- [ ] CSP headers reviewed and tightened
- [ ] PII redaction tested in logs
- [ ] Error messages don't expose internals

### Post-Deployment
- [ ] `/healthz` returns 200
- [ ] `/readyz` shows all checks passing
- [ ] `/metrics` accessible for monitoring
- [ ] Logs showing structured JSON output
- [ ] Rate limiting working (test with curl)
- [ ] Security headers present (check with browser devtools)

### Regular Audits (Monthly)
- [ ] Review access logs for anomalies
- [ ] Check for failed login attempts (when auth implemented)
- [ ] Verify API rate limit effectiveness
- [ ] Scan for exposed secrets in logs
- [ ] Review and rotate API keys
- [ ] Update dependency vulnerabilities

---

**Last Updated:** 2025-11-05  
**Document Version:** 1.0  
**Next Review:** 2025-12-05
