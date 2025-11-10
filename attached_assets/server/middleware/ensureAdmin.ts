
import type { Request, Response, NextFunction } from "express";

export function ensureAuthed(req: Request, res: Response, next: NextFunction) {
  const user = (req.session as any)?.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  next();
}

export function ensureAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req.session as any)?.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
}
