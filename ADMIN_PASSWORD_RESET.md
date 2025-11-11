# Emergency Admin Password Reset Procedure

This document describes how to reset an admin password in production when locked out.

## Scenario
You cannot log in to production with your admin credentials and need immediate access.

## Solution 1: Immediate SQL Fix (Fastest) ⚡

Use this when you need **immediate access** to production.

### Steps:

1. **Go to Replit Database Tab**
   - Select **PRODUCTION** database
   - Open the SQL query interface

2. **Generate a bcrypt hash** for your desired password:
   ```bash
   # Run this locally in development:
   node -e "
   const bcrypt = require('bcryptjs');
   const password = 'YourNewPassword123!';
   bcrypt.hash(password, 10).then(hash => {
     console.log('Hash:', hash);
   });
   "
   ```

3. **Run this SQL** on the PRODUCTION database:
   ```sql
   UPDATE users 
   SET password_hash = 'YOUR_BCRYPT_HASH_HERE' 
   WHERE email = 'your-admin@email.com';
   ```

4. **Log in** with the new password

**⚠️ Security Note:** This bypasses application logging. Use only for emergencies.

---

## Solution 2: Secure API Endpoint (Recommended for Future) 🔒

This approach uses the built-in `/api/internal/admin-password-reset` endpoint with proper auditing and one-time-use enforcement.

### Prerequisites:

1. Set environment secret `ADMIN_OVERRIDE_SECRET` in Replit:
   ```
   ADMIN_OVERRIDE_SECRET=some-long-random-high-entropy-secret-string
   ```

2. Endpoint is **automatically disabled** when:
   - Secret is not set in environment
   - This specific secret has already been used (permanent one-time enforcement)

### Steps:

1. **Set the override secret** in production environment variables

2. **Make API request** to production:
   ```bash
   curl -X POST https://your-production-url.com/api/internal/admin-password-reset \
     -H "Content-Type: application/json" \
     -d '{
       "secret": "your-ADMIN_OVERRIDE_SECRET-value",
       "email": "admin@example.com",
       "newPassword": "NewSecurePassword123!"
     }'
   ```

3. **Response on success:**
   ```json
   {
     "success": true,
     "message": "Admin password reset successfully. This endpoint is now disabled. Remove ADMIN_OVERRIDE_SECRET from environment."
   }
   ```

4. **Log in** with the new password

5. **Remove the secret** from environment variables (security best practice)

### How It Works:

- ✅ Validates override secret from environment
- ✅ Uses constant-time comparison (prevents timing attacks)
- ✅ Hashes password with bcrypt (10 rounds)
- ✅ Updates through ORM (auditable)
- ✅ Clears ALL active admin sessions from database
- ✅ Comprehensive security logging
- ✅ Returns 404 if secret not set

### Security Features:

1. **Multi-layer Protection:**
   - Environment variable guard (endpoint disabled if not set)
   - Constant-time secret comparison (prevents timing attacks)
   - Admin-only targeting (only works for admin users)

2. **Comprehensive Audit Trail:**
   - Logs all access attempts (successful and failed)
   - Logs invalid secret attempts with timestamps
   - Logs password reset operations with admin ID
   - Uses ORM for all database updates
   - Security warnings for production monitoring

3. **Session Security:**
   - Clears ALL active sessions for the admin user
   - Forces re-login with new password
   - Prevents session fixation attacks

4. **One-Time Use Enforcement:**
   - Each unique secret can only be used once (ever)
   - Secret hash permanently stored in `emergency_reset_log` table
   - Attempting reuse returns 403 with timestamp of previous use
   - Must rotate to new secret value for subsequent resets
   
5. **Best Practices:**
   - Use high-entropy secrets (32+ random characters)
   - Generate new secret for each emergency use
   - Remove secret from environment after use
   - Returns 404 when not configured (no attack surface)
   - Audit log retained indefinitely for compliance

---

## Comparison

| Feature | SQL Fix | API Endpoint |
|---------|---------|--------------|
| **Speed** | Immediate | Immediate |
| **Security** | Bypasses app | Full audit trail |
| **Logging** | None | Complete |
| **Reusable** | Yes | One-time use |
| **Best for** | Emergency access | Controlled reset |

## Recommendations

1. **Emergency:** Use SQL fix for immediate access
2. **Normal operations:** Use the API endpoint approach
3. **After access restored:** 
   - Change password via normal flow
   - Remove `ADMIN_OVERRIDE_SECRET` from environment
   - Set up proper password reset email flow

## Production Safety

- Always generate fresh bcrypt hashes (don't reuse)
- Never commit passwords or hashes to git
- Remove emergency secrets after use
- Use proper password reset flow for normal operations
