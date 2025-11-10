
import type { Express, Request, Response } from "express";
import { ensureAdmin } from "./middleware/ensureAdmin";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { hashPassword } from "./security/password";

export function registerAdminRoutes(app: Express) {
  // Create a user (admin-only)
  app.post("/api/admin/users", ensureAdmin, async (req: Request, res: Response) => {
    const { email, password, role = "user" } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password are required" });
    
    // Validate role (whitelist)
    if (role !== "user" && role !== "admin") {
      return res.status(400).json({ error: "Invalid role. Must be 'user' or 'admin'" });
    }

    const existing = await db.query.users.findFirst({ where: eq(users.email, email) as any });
    if (existing) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await hashPassword(password);
    const [row] = await db.insert(users).values({
      email,
      passwordHash,
      role,
      isActive: 1,
    }).returning();

    res.status(201).json({ user: { id: row.id, email: row.email, role: row.role } });
  });

  app.get("/api/admin/users", ensureAdmin, async (_req: Request, res: Response) => {
    const rows = await db.select().from(users);
    const safe = rows.map(r => ({ id: r.id, email: r.email, role: r.role, isActive: r.isActive, lastLoginAt: r.lastLoginAt, createdAt: r.createdAt }));
    res.json({ users: safe });
  });

  app.patch("/api/admin/users/:id", ensureAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role, isActive } = req.body || {};
    const updates: any = {};
    
    // Validate and set role (whitelist)
    if (role) {
      if (role !== "user" && role !== "admin") {
        return res.status(400).json({ error: "Invalid role. Must be 'user' or 'admin'" });
      }
      updates.role = role;
    }
    
    // Validate and set isActive (coerce to 0 or 1)
    if (typeof isActive === "boolean") {
      updates.isActive = isActive ? 1 : 0;
    } else if (typeof isActive === "number") {
      if (isActive !== 0 && isActive !== 1) {
        return res.status(400).json({ error: "Invalid isActive. Must be 0 or 1" });
      }
      updates.isActive = isActive;
    }
    
    if (!Object.keys(updates).length) return res.status(400).json({ error: "No updates" });
    await db.update(users).set(updates).where(eq(users.id, id));
    res.json({ ok: true });
  });

  app.post("/api/admin/users/:id/reset", ensureAdmin, async (req: Request, res: Response) => {
    const token = crypto.randomBytes(24).toString("hex");
    const payload: any = { ok: true };
    if (process.env.ALLOW_TEST_OTP_RESPONSE === "true") payload.token = token;
    res.json(payload);
  });
}
