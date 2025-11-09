
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.mock";
import { sql } from "drizzle-orm";

const sqlite = new Database(":memory:");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

let initialized = false;

export async function resetTestDb() {
  // Drop all tables
  await db.run(sql`DROP TABLE IF EXISTS user_trusted_devices`);
  await db.run(sql`DROP TABLE IF EXISTS user_backup_codes`);
  await db.run(sql`DROP TABLE IF EXISTS password_reset_tokens`);
  await db.run(sql`DROP TABLE IF EXISTS users`);
  
  // Recreate tables
  await initTestDb();
}

export async function initTestDb() {
  if (initialized) {
    // Allow reinitialization after reset
    initialized = false;
  }
  if (initialized) return;
  
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      totp_secret_enc TEXT,
      phone TEXT,
      last_login_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS user_backup_codes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS user_trusted_devices (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      label TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      expires_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  
  initialized = true;
}
