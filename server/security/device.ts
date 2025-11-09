import { randomBytes, createHash } from "crypto";

export function generateDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getTrustedDeviceTTL(): number {
  const days = parseInt(process.env.TRUSTED_DEVICE_DAYS || "30", 10);
  return days * 24 * 60 * 60 * 1000; // Convert days to milliseconds
}

export function getDeviceCookieName(): string {
  return process.env.DEVICE_COOKIE_NAME || "device";
}

export function parseDeviceCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const name = getDeviceCookieName();
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}
