
import type { Express, Request, Response } from "express";
import { ensureAdmin } from "./middleware/ensureAdmin";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export function registerAdminRoutes(app: Express) {
  app.get("/api/admin/users", ensureAdmin, async (_req: Request, res: Response) => {
    const rows = await db.select().from(users);
    const safe = rows.map(r => ({ id: r.id, email: r.email, role: r.role, isActive: r.isActive, lastLoginAt: r.lastLoginAt, createdAt: r.createdAt }));
    res.json({ users: safe });
  });

  app.patch("/api/admin/users/:id", ensureAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role, isActive } = req.body || {};
    const updates: any = {};
    if (role) updates.role = role;
    if (typeof isActive === "boolean") updates.isActive = isActive ? 1 : 0;
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
