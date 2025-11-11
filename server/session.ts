
import type { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";

const PgStore = connectPgSimple(session);

export function setupSession(app: Express) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set for session store");
  }

  // Neon serverless Pool works with connect-pg-simple
  const pool = new Pool({ connectionString });

  app.set("trust proxy", 1); // respect X-Forwarded-* in Replit/Proxies

  // IMPORTANT: For local development (http://localhost), secure must be false
  // For production (https://...), secure must be true
  // NODE_ENV=production is the reliable indicator for this
  const isProduction = process.env.NODE_ENV === "production";

  app.use(
    session({
      store: new PgStore({
        pool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      name: process.env.SESSION_COOKIE_NAME || "sid",
      secret: process.env.SESSION_SECRET || "change-me-in-prod",
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        // Only set secure in true production mode
        // Local development (even if accessed via https) should use secure:false for testing
        secure: isProduction,
        maxAge: Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 8), // 8h
      },
    }),
  );
}
