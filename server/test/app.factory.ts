
import express from "express";
import session from "express-session";
import { registerAuthRoutes } from "../auth-routes";
import { resetTestDb } from "./db.mock";

export async function createTestApp() {
  await resetTestDb();
  
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: process.env.SESSION_SECRET || "test-secret-minimum-32-chars-for-security",
    resave: false,
    saveUninitialized: false,
  }));
  registerAuthRoutes(app);
  return app;
}
