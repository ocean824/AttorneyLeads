
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().default(sql`lower(hex(randomblob(16)))`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  isActive: integer("is_active", { mode: "number" }).notNull().default(1),
  totpEnabled: integer("totp_enabled", { mode: "number" }).notNull().default(0),
  totpSecretEnc: text("totp_secret_enc"),
  phone: text("phone"),
  lastLoginAt: integer("last_login_at"), // Unix timestamp (seconds)
  createdAt: integer("created_at").notNull().default(sql`strftime('%s','now')`),
});

export type User = typeof users.$inferSelect;

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey().default(sql`lower(hex(randomblob(16)))`),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at").notNull(), // Unix timestamp (seconds)
  usedAt: integer("used_at"), // Unix timestamp (seconds)
  createdAt: integer("created_at").notNull().default(sql`strftime('%s','now')`),
});

export const userBackupCodes = sqliteTable("user_backup_codes", {
  id: text("id").primaryKey().default(sql`lower(hex(randomblob(16)))`),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  usedAt: integer("used_at"), // Unix timestamp (seconds)
  createdAt: integer("created_at").notNull().default(sql`strftime('%s','now')`),
});

export const userTrustedDevices = sqliteTable("user_trusted_devices", {
  id: text("id").primaryKey().default(sql`lower(hex(randomblob(16)))`),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  label: text("label"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at").notNull().default(sql`strftime('%s','now')`),
  expiresAt: integer("expires_at").notNull(), // Unix timestamp (seconds)
  lastUsedAt: integer("last_used_at"), // Unix timestamp (seconds)
  revokedAt: integer("revoked_at"), // Unix timestamp (seconds)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["user", "admin"]).default("user"),
});
