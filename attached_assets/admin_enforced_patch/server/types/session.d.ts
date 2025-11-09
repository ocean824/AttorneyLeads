
import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: { id: string; email: string; role: "user" | "admin" };
    pending2fa?: { userId: string };
    pending2faOtp?: { hash: string; expiresAt: number };
  }
}
