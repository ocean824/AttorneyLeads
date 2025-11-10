
import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import { createTestApp } from "../server/test/app.factory";

describe("Auth E2E — backup codes PDF + Email/SMS fallback", () => {
  let agent: any;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.APP_URL = "http://localhost:3000";
    process.env.ENFORCE_2FA_FOR_ADMINS = "false";
    process.env.ENFORCE_ADMIN_TOTP_SETUP = "false";
    process.env.ALLOW_TEST_OTP_RESPONSE = "true"; // so /otp/send returns token in tests
    process.env.AUTH_ENC_KEY = "test-key-should-be-32+chars-but-we-hash-it";
    process.env.TOTP_ISSUER = "TestApp";
    process.env.DEVICE_COOKIE_NAME = "device";
    process.env.TRUSTED_DEVICE_DAYS = "30";
    process.env.SMTP_FROM = "no-reply@test.local";

    // Bootstrap
    process.env.ADMIN_EMAIL = "user@test.local";
    process.env.ADMIN_PASSWORD = "UserPass123!";
    
    // Create app and agent
    const app = await createTestApp();
    agent = request.agent(app);
    await agent.post("/api/auth/bootstrap").send({});
  });

  it("login (no TOTP yet) returns user directly", async () => {
    const r = await agent.post("/api/auth/login").send({ email: "user@test.local", password: "UserPass123!" });
    expect(r.status).toBe(200);
    expect(r.body.user.email).toBe("user@test.local");
  });

  let codes: string[] = [];

  it("generate backup codes and download PDF", async () => {
    const g = await agent.post("/api/auth/backup-codes/generate").send({});
    expect(g.status).toBe(200);
    expect(Array.isArray(g.body.codes)).toBe(true);
    codes = g.body.codes;

    const pdf = await agent.post("/api/auth/backup-codes/pdf").send({ codes });
    expect([200, 201]).toContain(pdf.status);
    const ct = String(pdf.headers["content-type"] || "");
    expect(ct.includes("application/pdf") || ct.includes("text/plain")).toBe(true);
  });

  it("logout and login triggers 2FA (enable TOTP first then fallback)", async () => {
    // Enable TOTP for user to make 2FA paths relevant
    await agent.post("/api/auth/logout").send({});

    // Start setup (account route)
    // Need session; login again first (no 2FA until enabled)
    await agent.post("/api/auth/login").send({ email: "user@test.local", password: "UserPass123!" });
    const s1 = await agent.post("/api/auth/2fa/setup/start").send({});
    expect(s1.status).toBe(200);
    const secret = s1.body.secretBase32;

    // Generate a valid TOTP code
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
    const code = totp(secret);
    const v = await agent.post("/api/auth/2fa/setup/verify").send({ token: code });
    expect(v.status).toBe(200);

    // Now logout and test email fallback
    await agent.post("/api/auth/logout").send({});
    const l = await agent.post("/api/auth/login").send({ email: "user@test.local", password: "UserPass123!" });
    expect(l.body.requires2fa).toBe(true);

    // Request email OTP and use the token returned in tests
    const send = await agent.post("/api/auth/otp/send").send({ channel: "email" });
    expect(send.status).toBe(200);
    const token = send.body.token; // provided in test mode
    expect(token).toBeTruthy();

    const ver = await agent.post("/api/auth/otp/verify").send({ code: token });
    expect(ver.status).toBe(200);
    expect(ver.body.user.email).toBe("user@test.local");
  });
});
