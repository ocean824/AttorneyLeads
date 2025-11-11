
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { and, eq, isNull, lt, gt } from "drizzle-orm";
import {
  users,
  loginSchema,
  registerUserSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  type User,
  passwordResetTokens,
  userBackupCodes,
  userTrustedDevices,
} from "@shared/schema";
import { hashPassword, verifyPassword } from "./security/password";
import { encryptGCM, decryptGCM } from "./security/crypto";
import { generateSecret, verifyTotp, otpauthURI } from "./security/totp";
import { randomBytes, createHash } from "crypto";
import { sendMail } from "./email";
import { sendSms } from "./sms";
import { generateDeviceToken, hashDeviceToken, getTrustedDeviceTTL, getDeviceCookieName, parseDeviceCookie } from "./security/device";
import { generateBackupCodesPDF } from "./export";

function sanitize(user: User) {
  const { passwordHash, totpSecretEnc, ...rest } = user as any;
  return rest;
}

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.session?.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

function appUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

function maskEmail(email: string) {
  const [u, d] = email.split("@");
  const a = u.length <= 2 ? u[0] : u.slice(0, 2);
  return `${a}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
}
function maskPhone(phone?: string | null) {
  if (!phone) return null;
  const last4 = phone.slice(-4);
  return `***-***-${last4}`;
}

function needsAdmin2FA(user: User): boolean {
  const role = (user.role as any) || "user";
  const totpEnabled = (user as any).totpEnabled === 1 || (user as any).totp_enabled === 1;
  const enforce = process.env.ENFORCE_2FA_FOR_ADMINS === "true";
  return enforce && role === "admin" && !totpEnabled;
}

function needsAdminHardGateSetup(user: User): boolean {
  const role = (user.role as any) || "user";
  const totpEnabled = (user as any).totpEnabled === 1 || (user as any).totp_enabled === 1;
  const enforce = process.env.ENFORCE_ADMIN_TOTP_SETUP === "true";
  return enforce && role === "admin" && !totpEnabled;
}

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

function unixTimestamp() {
  return Math.floor(Date.now() / 1000);
}

async function checkTrustedDevice(userId: string, cookieHeader?: string): Promise<boolean> {
  try {
    const deviceToken = parseDeviceCookie(cookieHeader);
    if (!deviceToken) return false;
    
    const tokenHash = hashDeviceToken(deviceToken);
    const [device] = await db.select()
      .from(userTrustedDevices)
      .where(and(
        eq(userTrustedDevices.userId, userId),
        eq(userTrustedDevices.tokenHash, tokenHash),
        gt(userTrustedDevices.expiresAt, unixTimestamp())
      ))
      .limit(1);
    
    if (device) {
      // Update last used timestamp
      await db.update(userTrustedDevices)
        .set({ lastUsedAt: unixTimestamp() })
        .where(eq(userTrustedDevices.id, device.id));
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Trusted device check error:", error);
    return false;
  }
}

// ---------------------- Register existing routes from prior patch assumptions ----------------------
export function registerAuthRoutes(app: Express) {
  // Bootstrap: Create initial admin user if no users exist
  app.post("/api/auth/bootstrap", async (req, res) => {
    try {
      const existingUsers = await db.select().from(users).limit(1);
      if (existingUsers.length > 0) {
        return res.json({ message: "Users already exist" });
      }
      
      // Accept credentials from env (for E2E tests), request body, or use defaults
      const email = process.env.ADMIN_EMAIL || req.body?.email || "admin@attorneyleads.com";
      const password = process.env.ADMIN_PASSWORD || req.body?.password || "SecurePassword2024!";
      const passwordHash = await hashPassword(password);
      
      const [user] = await db.insert(users).values({
        email,
        passwordHash,
        role: "admin",
        isActive: 1,
      }).returning();
      
      // Auto-login the created user
      req.session.user = sanitize(user);
      
      res.json({ user: sanitize(user) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create admin user" });
    }
  });

  // Get current user session
  app.get("/api/auth/whoami", (req, res) => {
    if (req.session?.user) {
      res.json({ user: req.session.user });
    } else {
      // Return 401 for unauthenticated requests (not 200 with null)
      // This makes client-side guards work correctly
      res.status(401).json({ user: null });
    }
  });

  // Logout (also clear device cookie)
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      const sessionCookie = process.env.SESSION_COOKIE_NAME || "sid";
      res.clearCookie(sessionCookie);
      // NOTE: Don't clear device cookie - it should persist for trusted device bypass
      res.json({ ok: true });
    });
  });

  // login with enforcement + 2FA paths + trusted device check
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        // Extract first validation error for user-friendly message
        const firstError = parsed.error.errors[0];
        const field = firstError.path.join('.');
        const message = firstError.message;
        return res.status(400).json({ 
          error: `${field}: ${message}` 
        });
      }
      
      const { email, password } = parsed.data;
      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      const totpEnabled = (user as any).totpEnabled === 1 || (user as any).totp_enabled === 1;
      const phone = (user as any).phone as string | null;
      const adminHardGate = needsAdminHardGateSetup(user);
      const adminMustSetup = needsAdmin2FA(user);

      // Check for trusted device (bypass 2FA if valid and user has TOTP enabled)
      if (totpEnabled && !adminHardGate) {
        const isTrusted = await checkTrustedDevice(user.id, req.headers.cookie);
        if (isTrusted) {
          // Trusted device + TOTP enabled → finalize session immediately
          await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
          req.session.user = { id: user.id, email: user.email, role: (user.role as any) || "user" };
          return res.json({ user: sanitize(user), trustedDevice: true });
        }
      }

      // If any 2FA is needed (TOTP enabled OR admin enforcement), we go to 2FA step
      if (totpEnabled || adminMustSetup || adminHardGate) {
        req.session.pending2fa = {
          userId: user.id,
          requireTotpSetup: adminHardGate,
          allowFallbacks: !adminHardGate,
        };
        
        // Admin hard-gate: only show TOTP setup option
        if (adminHardGate) {
          return res.json({
            requires2fa: true,
            adminMustSetup2fa: true,
            methods: { totpSetup: true },
            message: "Admins must enable 2FA before completing login",
          });
        }
        
        // Standard 2FA flow
        return res.json({
          requires2fa: true,
          methods: {
            totp: !!totpEnabled,
            backup: !!totpEnabled,
            fallback: { email: true, sms: !!phone },
          },
          adminMustSetup2fa: adminMustSetup,
          destinations: { email: maskEmail(user.email), phone: maskPhone(phone) },
        });
      }

      // No 2FA required
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      req.session.user = { id: user.id, email: user.email, role: (user.role as any) || "user" };
      res.json({ user: sanitize(user) });
    } catch (e: any) {
      console.error("Login error:", e);
      res.status(500).json({ error: "An error occurred during login" });
    }
  });

  // TOTP verify (unchanged from prior, but completes session)
  app.post("/api/auth/totp/login-verify", async (req, res) => {
    const pending = req.session?.pending2fa;
    if (!pending) return res.status(401).json({ error: "No pending 2FA" });
    const token = String(req.body?.token || "");
    if (!token) return res.status(400).json({ error: "Missing token" });

    const [user] = await db.select().from(users).where(eq(users.id, pending.userId));
    if (!user) return res.status(401).json({ error: "Invalid session" });
    const secretEnc = (user as any).totpSecretEnc || (user as any).totp_secret_enc;
    if (!secretEnc) return res.status(400).json({ error: "2FA not set up" });
    const secret = decryptGCM(secretEnc);
    const ok = verifyTotp(token, secret, 1);
    if (!ok) return res.status(401).json({ error: "Invalid code" });

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    req.session.user = { id: user.id, email: user.email, role: (user.role as any) || "user" };
    delete (req.session as any).pending2fa;
    res.json({ user: sanitize(user) });
  });

  // ---------------------- TOTP Setup (for admin hard-gate and normal users) ----------------------
  app.post("/api/auth/2fa/setup/start", async (req, res) => {
    // Support both flows: pending2fa (admin hard-gate) and normal authenticated users
    const pending = req.session?.pending2fa;
    const normalUser = req.session?.user;
    
    let userId: string;
    let userEmail: string;
    
    if (pending) {
      // Admin hard-gate flow
      userId = pending.userId;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(401).json({ error: "Invalid session" });
      userEmail = user.email;
    } else if (normalUser) {
      // Normal authenticated user wanting to enable TOTP
      userId = normalUser.id;
      userEmail = normalUser.email;
    } else {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { secretBase32 } = generateSecret();
    
    // Store secret temporarily in session for verification
    (req.session as any).pendingTotpSecret = secretBase32;

    const issuer = process.env.TOTP_ISSUER || "Attorney Leads";
    const uri = otpauthURI(issuer, userEmail, secretBase32);

    res.json({ secretBase32, qrUri: uri });
  });

  app.post("/api/auth/2fa/setup/verify", async (req, res) => {
    // Support both flows: pending2fa (admin hard-gate) and normal authenticated users
    const pending = req.session?.pending2fa;
    const normalUser = req.session?.user;
    
    let userId: string;
    let isPendingFlow = false;
    
    if (pending) {
      userId = pending.userId;
      isPendingFlow = true;
    } else if (normalUser) {
      userId = normalUser.id;
    } else {
      return res.status(401).json({ error: "Authentication required" });
    }

    const secretBase32 = (req.session as any).pendingTotpSecret;
    if (!secretBase32) return res.status(400).json({ error: "No pending TOTP setup" });

    const token = String(req.body?.token || "");
    if (!token) return res.status(400).json({ error: "Missing token" });

    const ok = verifyTotp(token, secretBase32, 1);
    if (!ok) return res.status(401).json({ error: "Invalid code" });

    // Verify succeeded - encrypt and save secret, enable TOTP
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return res.status(401).json({ error: "Invalid session" });

    const secretEnc = encryptGCM(secretBase32);
    await db.update(users).set({
      totpSecretEnc: secretEnc,
      totpEnabled: 1,
      lastLoginAt: new Date(),
    }).where(eq(users.id, user.id));

    // If pending flow (admin hard-gate), complete login session
    if (isPendingFlow) {
      req.session.user = { id: user.id, email: user.email, role: (user.role as any) || "user" };
      delete (req.session as any).pending2fa;
    }
    delete (req.session as any).pendingTotpSecret;

    const updatedUser = { ...user, totpSecretEnc: secretEnc, totpEnabled: 1 };
    res.json({ user: sanitize(updatedUser) });
  });

  // ---------------------- Backup codes ----------------------
  app.post("/api/auth/backup-codes/generate", requireAuth, async (req, res) => {
    // Invalidate old (by deleting; usedAt remains for old auditing if desired)
    await db.delete(userBackupCodes).where(eq(userBackupCodes.userId, req.session!.user!.id));

    // Generate 10 codes (8-4 format e.g., ABCD-EFGH style numeric)
    function randomCode() {
      const buf = randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars
      return `${buf.slice(0,5)}-${buf.slice(5)}`;
    }
    const plain = Array.from({ length: 10 }).map(() => randomCode());
    const rows = plain.map((c) => ({ userId: req.session!.user!.id, codeHash: hashToken(c) }));
    await db.insert(userBackupCodes).values(rows);
    res.json({ codes: plain }); // show once
  });

  app.post("/api/auth/backup-codes/verify", async (req, res) => {
    const pending = req.session?.pending2fa;
    if (!pending) return res.status(401).json({ error: "No pending 2FA" });
    
    // Block fallback if admin hard-gate requires TOTP setup
    if (pending.requireTotpSetup || !pending.allowFallbacks) {
      return res.status(403).json({ error: "Fallback authentication not allowed. Please complete TOTP setup." });
    }
    
    const code = String(req.body?.code || "");
    if (!code) return res.status(400).json({ error: "Code required" });
    const codeHash = hashToken(code);

    const rows = await db
      .select()
      .from(userBackupCodes)
      .where(and(eq(userBackupCodes.userId, pending.userId), eq(userBackupCodes.codeHash, codeHash)));
    const entry = rows[0];
    if (!entry || (entry as any).usedAt) return res.status(401).json({ error: "Invalid backup code" });

    // consume
    await db.update(userBackupCodes).set({ usedAt: unixTimestamp() }).where(eq(userBackupCodes.id, entry.id));

    const [user] = await db.select().from(users).where(eq(users.id, pending.userId));
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    req.session.user = { id: user.id, email: user.email, role: (user.role as any) || "user" };
    delete (req.session as any).pending2fa;
    res.json({ user: sanitize(user) });
  });

  // ---------------------- Fallback OTP (Email/SMS) ----------------------
  app.post("/api/auth/otp/send", async (req, res) => {
    const pending = req.session?.pending2fa;
    if (!pending) return res.status(401).json({ error: "No pending 2FA" });
    
    // Block fallback if admin hard-gate requires TOTP setup
    if (pending.requireTotpSetup || !pending.allowFallbacks) {
      return res.status(403).json({ error: "Fallback authentication not allowed. Please complete TOTP setup." });
    }
    
    const channel = String(req.body?.channel || "email");
    const [user] = await db.select().from(users).where(eq(users.id, pending.userId));
    if (!user) return res.status(401).json({ error: "Invalid session" });

    const token = (Math.floor(100000 + Math.random() * 900000)).toString(); // 6-digit
    const expiresAt = Date.now() + 1000 * 60 * 10; // 10 minutes
    (req.session as any).pending2faOtp = { hash: hashToken(token), expiresAt };

    if (channel === "sms") {
      const phone = (user as any).phone || null;
      if (!phone) return res.status(400).json({ error: "No phone on file" });
      await sendSms(phone, `Your verification code is ${token}`);
      const response: any = { sent: true, channel: "sms", to: maskPhone(phone) };
      if (process.env.ALLOW_TEST_OTP_RESPONSE === "true" && process.env.NODE_ENV === "test") {
        response.token = token;
      }
      return res.json(response);
    } else {
      await sendMail({
        to: user.email,
        subject: "Your verification code",
        html: `<p>Your verification code is <b>${token}</b>. It expires in 10 minutes.</p>`,
        text: `Your verification code is ${token}. It expires in 10 minutes.`,
      });
      const response: any = { sent: true, channel: "email", to: maskEmail(user.email) };
      if (process.env.ALLOW_TEST_OTP_RESPONSE === "true" && process.env.NODE_ENV === "test") {
        response.token = token;
      }
      return res.json(response);
    }
  });

  app.post("/api/auth/otp/verify", async (req, res) => {
    const pending = req.session?.pending2fa;
    const otp = (req.session as any)?.pending2faOtp;
    if (!pending || !otp) return res.status(401).json({ error: "No pending OTP" });
    
    // Block fallback if admin hard-gate requires TOTP setup
    if (pending.requireTotpSetup || !pending.allowFallbacks) {
      return res.status(403).json({ error: "Fallback authentication not allowed. Please complete TOTP setup." });
    }
    
    const code = String(req.body?.code || "");
    if (!code) return res.status(400).json({ error: "Code required" });
    if (Date.now() > otp.expiresAt) return res.status(401).json({ error: "Code expired" });
    if (hashToken(code) !== otp.hash) return res.status(401).json({ error: "Invalid code" });

    const [user] = await db.select().from(users).where(eq(users.id, pending.userId));
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    req.session.user = { id: user.id, email: user.email, role: (user.role as any) || "user" };
    delete (req.session as any).pending2fa;
    delete (req.session as any).pending2faOtp;
    res.json({ user: sanitize(user) });
  });

  // ---------------------- Admin: set phone ----------------------
  app.post("/api/account/phone", requireAuth, async (req, res) => {
    const phone = String(req.body?.phone || "");
    if (!/^[+0-9 \-()]{7,32}$/.test(phone)) return res.status(400).json({ error: "Invalid phone" });
    const [u] = await db.update(users).set({ phone: phone }).where(eq(users.id, req.session!.user!.id)).returning();
    res.json({ ok: true, phone: (u as any).phone });
  });

  // ---------------------- Trusted Devices ----------------------
  app.post("/api/auth/trusted-devices", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.user!.id;
      const label = String(req.body?.label || "").slice(0, 255) || "Unknown Device";
      
      // Check if user has TOTP enabled (required for trusted devices)
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      const totpEnabled = (user as any).totpEnabled === 1 || (user as any).totp_enabled === 1;
      if (!totpEnabled) {
        return res.status(400).json({ error: "TOTP must be enabled to trust devices" });
      }
      
      // Generate device token
      const token = generateDeviceToken();
      const tokenHash = hashDeviceToken(token);
      const ttl = getTrustedDeviceTTL();
      const expiresAt = Math.floor((Date.now() + ttl) / 1000); // Unix timestamp
      
      // Store in database
      await db.insert(userTrustedDevices).values({
        userId,
        tokenHash,
        label,
        expiresAt,
        lastUsedAt: unixTimestamp(),
      });
      
      // Set cookie
      const cookieName = getDeviceCookieName();
      const maxAge = Math.floor(ttl / 1000); // Convert to seconds
      res.cookie(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: maxAge,
      });
      
      res.json({ ok: true, trusted: true, message: "Device trusted", expiresAt });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to trust device" });
    }
  });

  app.get("/api/auth/trusted-devices", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.user!.id;
      const devices = await db.select({
        id: userTrustedDevices.id,
        label: userTrustedDevices.label,
        expiresAt: userTrustedDevices.expiresAt,
        lastUsedAt: userTrustedDevices.lastUsedAt,
        createdAt: userTrustedDevices.createdAt,
      })
        .from(userTrustedDevices)
        .where(eq(userTrustedDevices.userId, userId))
        .orderBy(userTrustedDevices.createdAt);
      
      res.json({ devices });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch devices" });
    }
  });

  app.delete("/api/auth/trusted-devices/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.user!.id;
      const deviceId = req.params.id;
      
      // Delete device (only if it belongs to the user)
      await db.delete(userTrustedDevices)
        .where(and(
          eq(userTrustedDevices.id, deviceId),
          eq(userTrustedDevices.userId, userId)
        ));
      
      res.json({ ok: true, message: "Device revoked" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to revoke device" });
    }
  });

  // ---------------------- Backup Codes PDF Export ----------------------
  app.get("/api/auth/backup-codes/export", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.user!.id;
      
      // Fetch unused backup codes
      const codes = await db.select()
        .from(userBackupCodes)
        .where(and(
          eq(userBackupCodes.userId, userId),
          isNull(userBackupCodes.usedAt)
        ))
        .orderBy(userBackupCodes.createdAt);
      
      if (codes.length === 0) {
        return res.status(404).json({ error: "No backup codes found. Please generate new codes first." });
      }
      
      // Note: We can't return the actual codes since they're hashed
      // This endpoint should only be called immediately after generation
      // when the plain codes are still available in memory
      return res.status(400).json({
        error: "Backup codes cannot be retrieved after initial generation. Please generate new codes if needed."
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to export codes" });
    }
  });

  // PDF export endpoint for backup codes (receives codes in request body)
  app.post("/api/auth/backup-codes/pdf", requireAuth, async (req, res) => {
    try {
      const codes = req.body?.codes;
      if (!Array.isArray(codes) || codes.length === 0) {
        return res.status(400).json({ error: "No codes provided" });
      }
      
      await generateBackupCodesPDF(codes, res);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate PDF" });
    }
  });

  // ---------------------- Password Reset ----------------------
  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const parsed = requestPasswordResetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      
      const { email } = parsed.data;
      
      // Find user (silently succeed even if user doesn't exist to prevent email enumeration)
      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      
      if (user) {
        // Delete any existing reset tokens for this user
        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
        
        // Generate secure random token (32 bytes = 64 hex chars)
        const token = randomBytes(32).toString('hex');
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
        
        // Store hashed token
        await db.insert(passwordResetTokens).values({
          userId: user.id,
          tokenHash,
          expiresAt,
        });
        
        // Build reset URL
        const resetUrl = `${appUrl()}/reset?token=${token}`;
        
        // Send email (do not log token)
        await sendMail({
          to: user.email,
          subject: "Password Reset Request",
          html: `
            <p>You requested a password reset for your account.</p>
            <p>Click the link below to reset your password (expires in 1 hour):</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>If you didn't request this, you can safely ignore this email.</p>
          `,
          text: `You requested a password reset for your account. Visit this link to reset your password (expires in 1 hour): ${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
        });
      }
      
      // Always return success to prevent email enumeration
      res.json({ ok: true, message: "If an account exists, a reset link has been sent" });
    } catch (error: any) {
      console.error("Password reset request error:", error.message);
      res.status(500).json({ error: "Failed to process reset request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        return res.status(400).json({ error: `${firstError.path.join('.')}: ${firstError.message}` });
      }
      
      const { token, password } = parsed.data;
      const tokenHash = hashToken(token);
      
      // Find valid token (not expired, not used)
      const [resetToken] = await db.select()
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt)
        ))
        .limit(1);
      
      if (!resetToken) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      
      // Check expiration
      if (new Date() > new Date(resetToken.expiresAt)) {
        return res.status(410).json({ error: "Reset token has expired" });
      }
      
      // Update password
      const passwordHash = await hashPassword(password);
      await db.update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, resetToken.userId));
      
      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetToken.id));
      
      // Invalidate any existing sessions for this user (security best practice)
      // Note: This is a simplified approach; in production, you might want to track sessions in DB
      
      res.json({ ok: true, message: "Password reset successful" });
    } catch (error: any) {
      console.error("Password reset error:", error.message);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });
}
