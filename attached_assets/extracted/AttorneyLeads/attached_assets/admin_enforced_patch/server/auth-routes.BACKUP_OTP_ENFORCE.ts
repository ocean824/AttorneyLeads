
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { and, eq, isNull } from "drizzle-orm";
import {
  users,
  loginSchema,
  registerUserSchema,
  type User,
  passwordResetTokens,
  userBackupCodes,
} from "@shared/schema";
import { hashPassword, verifyPassword } from "./security/password";
import { encryptGCM, decryptGCM } from "./security/crypto";
import { generateSecret, verifyTotp, otpauthURI } from "./security/totp";
import { randomBytes, createHash } from "crypto";
import { sendMail } from "./email";
import { sendSms } from "./sms";

function sanitize(user: User) {
  const { passwordHash, ...rest } = user as any;
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

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

// ---------------------- Register existing routes from prior patch assumptions ----------------------
export function registerAuthRoutes(app: Express) {
  // login with enforcement + 2FA paths
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      const totpEnabled = (user as any).totpEnabled === 1 || (user as any).totp_enabled === 1;
      const phone = (user as any).phone as string | null;
      const adminMustSetup = needsAdmin2FA(user);

      // If any 2FA is needed (TOTP enabled OR admin enforcement), we go to 2FA step
      if (totpEnabled || adminMustSetup) {
        req.session.pending2fa = { userId: user.id };
        return res.json({
          requires2fa: true,
          methods: {
            totp: !!totpEnabled,
            backup: true,
            fallback: { email: true, sms: !!phone },
          },
          adminMustSetup2fa: adminMustSetup,
          destinations: { email: maskEmail(user.email), phone: maskPhone(phone) },
        });
      }

      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      req.session.user = { id: user.id, email: user.email, role: (user.role as any) || "user" };
      res.json({ user: sanitize(user) });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Invalid payload" });
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
    await db.update(userBackupCodes).set({ usedAt: new Date() }).where(eq(userBackupCodes.id, entry.id));

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
      return res.json({ sent: true, channel: "sms", to: maskPhone(phone) });
    } else {
      await sendMail({
        to: user.email,
        subject: "Your verification code",
        html: `<p>Your verification code is <b>${token}</b>. It expires in 10 minutes.</p>`,
        text: `Your verification code is ${token}. It expires in 10 minutes.`,
      });
      return res.json({ sent: true, channel: "email", to: maskEmail(user.email) });
    }
  });

  app.post("/api/auth/otp/verify", async (req, res) => {
    const pending = req.session?.pending2fa;
    const otp = (req.session as any)?.pending2faOtp;
    if (!pending || !otp) return res.status(401).json({ error: "No pending OTP" });
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
}
