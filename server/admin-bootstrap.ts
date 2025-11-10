
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export function registerAdminBootstrap(app: Express) {
  app.post("/api/admin/bootstrap", async (_req: Request, res: Response) => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || "Admin";
    if (!email || !password) return res.status(400).json({ error: "Missing ADMIN_EMAIL or ADMIN_PASSWORD in secrets" });

    const existing = await db.query.users.findFirst({ where: eq(users.email, email) as any });
    const passwordHash = await bcrypt.hash(password, 10);

    if (!existing) {
      const [row] = await db.insert(users).values({
        email, passwordHash, role: "admin", isActive: 1,
      }).returning();
      return res.json({ created: true, user: { id: row.id, email: row.email, role: "admin" } });
    } else {
      await db.update(users).set({ role: "admin", isActive: 1, passwordHash }).where(eq(users.email, email));
      return res.json({ created: false, updated: true, user: { id: existing.id, email: existing.email, role: "admin" } });
    }
  });
}
