
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { and, eq } from "drizzle-orm";
import { users, loginSchema, registerUserSchema, type User } from "@shared/schema";
import { hashPassword, verifyPassword } from "./security/password";

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

export function registerAuthRoutes(app: Express) {
  // Bootstrap endpoint to create the first admin if no users exist (one-time safe guard)
  app.post("/api/auth/bootstrap", async (req, res) => {
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
    const adminPassword = String(process.env.ADMIN_PASSWORD || "").trim();
    if (!adminEmail || !adminPassword) {
      return res.status(400).json({ error: "ADMIN_EMAIL and ADMIN_PASSWORD envs must be set" });
    }

    const existing = await db.select().from(users);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Users already exist" });
    }

    const passwordHash = await hashPassword(adminPassword);
    const [created] = await db
      .insert(users)
      .values({
        email: adminEmail.toLowerCase(),
        passwordHash,
        role: "admin",
        isActive: 1,
      })
      .returning();
    return res.json({ message: "Admin created", user: sanitize(created) });
  });

  app.post("/api/auth/register", requireAdmin, async (req, res) => {
    try {
      const body = registerUserSchema.parse(req.body);
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email.toLowerCase()));
      if (existing.length) return res.status(409).json({ error: "Email already in use" });

      const passwordHash = await hashPassword(body.password);
      const [created] = await db
        .insert(users)
        .values({
          email: body.email.toLowerCase(),
          passwordHash,
          role: body.role,
          isActive: 1,
        })
        .returning();

      res.json({ user: sanitize(created) });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Invalid payload" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()));
      if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      // update last login
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

      req.session.user = { id: user.id, email: user.email, role: (user.role as any) || "user" };
      res.json({ user: sanitize(user) });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Invalid payload" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session?.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/whoami", (req, res) => {
    const u = req.session?.user;
    if (!u) return res.status(401).json({ error: "Unauthorized" });
    res.json({ user: u });
  });

  // Admin: list and toggle users
  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    const list = await db.select().from(users).orderBy(users.createdAt);
    res.json(list.map(sanitize));
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    const id = req.params.id;
    const updates: any = {};
    if (typeof req.body.role === "string") updates.role = req.body.role;
    if (typeof req.body.isActive === "number") updates.isActive = req.body.isActive;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No updates provided" });
    const [u] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    if (!u) return res.status(404).json({ error: "Not found" });
    res.json(sanitize(u));
  });
}
