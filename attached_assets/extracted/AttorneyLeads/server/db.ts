import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import * as schema from "@shared/schema";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
