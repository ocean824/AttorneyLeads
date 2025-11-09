
import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import { createTestApp } from "../server/test/app.factory";

// Simple TOTP generator for the test
function base32Decode(str: string): Uint8Array {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0; const out: number[] = [];
  for (const c of str.replace(/=+$/,"").toUpperCase()) {
    const idx = ALPHABET.indexOf(c); if (idx === -1) continue;
    value = (value<<5) | idx; bits += 5;
    if (bits>=8){ out.push((value >>> (bits-8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}
function hotp(secret: Uint8Array, counter: number, digits=6): string {
  const crypto = require("crypto");
  const cb = Buffer.alloc(8); for (let i=7;i>=0;i--){ cb[i] = counter & 0xff; counter >>= 8; }
  const h = crypto.createHmac("sha1", Buffer.from(secret)).update(cb).digest();
  const o = h[h.length-1] & 0xf;
  const code = ((h[o] & 0x7f)<<24) | ((h[o+1] & 0xff)<<16) | ((h[o+2] & 0xff)<<8) | (h[o+3] & 0xff);
  return String(code % 10**digits).padStart(digits,"0");
}
function totp(secretBase32: string, step=30, digits=6, ts=Date.now()): string {
  return hotp(base32Decode(secretBase32), Math.floor(ts/1000/step), digits);
}

describe("Auth E2E — admin hard gate + trusted device bypass", () => {
  let agent: any;

  beforeAll(async () => {
    // Minimal env for tests
    process.env.NODE_ENV = "test";
    process.env.APP_URL = "http://localhost:3000";
    process.env.ENFORCE_2FA_FOR_ADMINS = "true";
    process.env.ENFORCE_ADMIN_TOTP_SETUP = "true";
    process.env.AUTH_ENC_KEY = "test-key-should-be-32+chars-but-we-hash-it";
    process.env.TOTP_ISSUER = "TestApp";
    process.env.DEVICE_COOKIE_NAME = "device";
    process.env.TRUSTED_DEVICE_DAYS = "30";
    process.env.SMTP_FROM = "no-reply@test.local";

    process.env.ADMIN_EMAIL = "admin@test.local";
    process.env.ADMIN_PASSWORD = "AdminPass123!";
    
    // Create app and agent
    const app = await createTestApp();
    agent = request.agent(app);
  });

  it("bootstraps an admin", async () => {
    const r = await agent.post("/api/auth/bootstrap").send({});
    expect(r.status).toBe(200);
    expect(r.body.user.email).toBe("admin@test.local");
  });

  let secretBase32: string;

  it("login requires hard-setup for admin", async () => {
    const r = await agent.post("/api/auth/login").send({ email: "admin@test.local", password: "AdminPass123!" });
    expect(r.status).toBe(200);
    expect(r.body.requires2fa).toBe(true);
    expect(r.body.adminMustSetup2fa).toBe(true);
  });

  it("starts pending TOTP setup and verifies", async () => {
    const s1 = await agent.post("/api/auth/totp/pending/start").send({});
    expect(s1.status).toBe(200);
    expect(s1.body.secretBase32).toBeTruthy();
    secretBase32 = s1.body.secretBase32;

    const code = totp(secretBase32);
    const v = await agent.post("/api/auth/totp/pending/verify").send({ token: code });
    expect(v.status).toBe(200);
    expect(v.body.user.email).toBe("admin@test.local");
  });

  it("whoami works after login", async () => {
    const r = await agent.get("/api/auth/whoami");
    expect(r.status).toBe(200);
    expect(r.body.user.email).toBe("admin@test.local");
  });

  it("trusts the device", async () => {
    const t = await agent.post("/api/auth/trusted-devices").send({ label: "E2E" });
    expect(t.status).toBe(200);
    expect(t.body.trusted).toBe(true);
  });

  it("logout ends session", async () => {
    const r = await agent.post("/api/auth/logout").send({});
    expect(r.status).toBe(200);
  });

  it("login bypasses 2FA on trusted device", async () => {
    const r = await agent.post("/api/auth/login").send({ email: "admin@test.local", password: "AdminPass123!" });
    expect(r.status).toBe(200);
    // Should return user directly (no requires2fa)
    expect(r.body.user).toBeTruthy();
    expect(r.body.user.email).toBe("admin@test.local");
  });
});
