
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { and, eq } from "drizzle-orm";
import {
  users,
  loginSchema,
  registerUserSchema,
  type User,
  passwordResetTokens,
} from "@shared/schema";
import { hashPassword, verifyPassword } from "./security/password";
import { encryptGCM, decryptGCM } from "./security/crypto";
import { generateSecret, verifyTotp, otpauthURI } from "./security/totp";
import { randomBytes, createHash } from "crypto";
import { sendMail } from "./email";

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

export function registerAuthRoutes(app: Express) {
  // ---------------------- Bootstrap First Admin ----------------------
  app.post("/api/auth/bootstrap", async (req, res) => {
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
    const adminPassword = String(process.env.ADMIN_PASSWORD || "").trim();
    if (!adminEmail || !adminPassword) {
      return res.status(400).json({ error: "ADMIN_EMAIL and ADMIN_PASSWORD envs must be set" });
    }
    const existing = await db.select().from(users);
    if (existing.length > 0) return res.status(409).json({ error: "Users already exist" });

    const passwordHash = await hashPassword(adminPassword);
    const [created] = await db
      .insert(users)
      .values({ email: adminEmail.toLowerCase(), passwordHash, role: "admin", isActive: 1 })
      .returning();
    return res.json({ message: "Admin created", user: sanitize(created) });
  });

  // ---------------------- Register (Admin only) ----------------------
  app.post("/api/auth/register", requireAdmin, async (req, res) => {
    try {
      const body = registerUserSchema.parse(req.body);
      const existing = await db.select().from(users).where(eq(users.email, body.email.toLowerCase()));
      if (existing.length) return res.status(409).json({ error: "Email already in use" });
      const passwordHash = await hashPassword(body.password);
      const [created] = await db
        .insert(users)
        .values({ email: body.email.toLowerCase(), passwordHash, role: body.role, isActive: 1 })
        .returning();
      res.json({ user: sanitize(created) });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Invalid payload" });
    }
  });

  // ---------------------- Login (with optional 2FA) ----------------------
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      // If TOTP enabled, set pending 2FA, don't create full session yet
      const enabled = (user as any).totpEnabled === 1 || (user as any).totp_enabled === 1;
      if (enabled) {
        req.session.pending2fa = { userId: user.id };
        return res.status(200).json({ requires2fa: true });
      }

      // Normal session
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      req.session.user = { id: user.id, email: user.email, role: (user.role as any) || "user" };
      res.json({ user: sanitize(user) });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Invalid payload" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session?.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/whoami", (req, res) => {
    const u = req.session?.user;
    if (!u) return res.status(401).json({ error: "Unauthorized" });
    res.json({ user: u });
  });

  // ---------------------- 2FA: Login verify ----------------------
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
    return res.json({ user: sanitize(user) });
  });

  // ---------------------- 2FA: Setup/Verify/Disable ----------------------
  app.post("/api/auth/totp/status", requireAuth, async (req, res) => {
    const [user] = await db.select().from(users).where(eq(users.id, req.session!.user!.id));
    const enabled = ((user as any).totpEnabled || (user as any).totp_enabled) ? true : false;
    res.json({ enabled });
  });

  app.post("/api/auth/totp/setup/start", requireAuth, async (req, res) => {
    const [user] = await db.select().from(users).where(eq(users.id, req.session!.user!.id));
    const { secretBase32 } = generateSecret();
    const uri = otpauthURI(process.env.TOTP_ISSUER || "AttorneyLeads", user.email, secretBase32);
    const qr = `https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl=${encodeURIComponent(uri)}`;
    // Temporarily store in session for verification; saved to DB only after verify
    (req.session as any).totpSetup = { secretBase32 };
    res.json({ otpauthURI: uri, qrImageUrl: qr, secretBase32 });
  });

  app.post("/api/auth/totp/setup/verify", requireAuth, async (req, res) => {
    const pending = (req.session as any).totpSetup;
    if (!pending?.secretBase32) return res.status(400).json({ error: "No TOTP setup in progress" });
    const token = String(req.body?.token || "");
    if (!token) return res.status(400).json({ error: "Missing token" });

    const ok = verifyTotp(token, pending.secretBase32, 1);
    if (!ok) return res.status(401).json({ error: "Invalid code" });

    const enc = encryptGCM(pending.secretBase32);
    const [user] = await db
      .update(users)
      .set({ totpSecretEnc: enc as any, totpEnabled: 1 as any })
      .where(eq(users.id, req.session!.user!.id))
      .returning();
    delete (req.session as any).totpSetup;
    res.json({ enabled: true, user: sanitize(user!) });
  });

  app.post("/api/auth/totp/disable", requireAuth, async (req, res) => {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: "Password required" });
    const [user] = await db.select().from(users).where(eq(users.id, req.session!.user!.id));
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid password" });

    const [updated] = await db
      .update(users)
      .set({ totpSecretEnc: null as any, totpEnabled: 0 as any })
      .where(eq(users.id, user.id))
      .returning();
    res.json({ enabled: false, user: sanitize(updated!) });
  });

  // ---------------------- Password Reset ----------------------
  function hashToken(t: string) {
    return createHash("sha256").update(t).digest("hex");
  }

  app.post("/api/auth/request-password-reset", async (req, res) => {
    const email = String(req.body?.email || "").toLowerCase();
    if (!email) return res.status(400).json({ error: "Email required" });

    const [user] = await db.select().from(users).where(eq(users.email, email));
    // Always respond 200 to avoid user enumeration
    if (!user) return res.json({ ok: true });

    // Create token
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min
    await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });

    const resetUrl = `${appUrl()}/reset?token=${token}`;
    await sendMail({
      to: email,
      subject: "Password Reset",
      html: `<p>We received a request to reset your password.</p>
             <p><a href="${resetUrl}">Click here to reset your password</a> (valid for 30 minutes).</p>
             <p>If you didn't request this, you can safely ignore this email.</p>`,
      text: `Reset your password: ${resetUrl}`,
    });

    res.json({ ok: true });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const token = String(req.body?.token || "");
    const password = String(req.body?.password || "");
    if (!token || !password) return res.status(400).json({ error: "Token and password required" });

    const tokenHash = hashToken(token);
    const now = new Date();
    const rows = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash));
    const entry = rows[0];
    if (!entry || (entry as any).usedAt || entry.expiresAt < now) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, entry.userId));
    if (!user) return res.status(400).json({ error: "Invalid token" });

    const passwordHash = await hashPassword(password);
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, entry.id));
    res.json({ ok: true });
  });

  // ---------------------- Admin users ----------------------
  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    const list = await db.select().from(users).orderBy(users.createdAt);
    res.json(list.map(sanitize));
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    const id = req.params.id;
    const updates: any = {};
    if (typeof req.body.role === "string") updates.role = req.body.role;
    if (typeof req.body.isActive === "number") updates.isActive = req.body.isActive;
    const [u] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    if (!u) return res.status(404).json({ error: "Not found" });
    res.json(sanitize(u));
  });
}
