
import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      role: "user" | "admin";
    };
    pending2fa?: { userId: string };
    totpSetup?: { secretBase32: string };
  }
}
