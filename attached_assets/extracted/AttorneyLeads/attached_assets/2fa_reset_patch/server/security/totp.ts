
import { createHmac, randomBytes } from "crypto";

// Minimal Base32 (RFC 4648) for secrets
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}
export function base32Decode(str: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of str.replace(/=+$/,"").toUpperCase()) {
    const idx = ALPHABET.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// RFC 6238 TOTP (HMAC-SHA1, 30s window)
export function generateSecret(bytes = 20): { secretBase32: string } {
  const buf = randomBytes(bytes);
  return { secretBase32: base32Encode(buf) };
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const counterBuf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = counter & 0xff;
    counter = counter >> 8;
  }
  const hmac = createHmac("sha1", secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const str = (code % 10 ** digits).toString();
  return str.padStart(digits, "0");
}

export function totp(secretBase32: string, timeStep = 30, digits = 6, ts = Date.now()): string {
  const counter = Math.floor(ts / 1000 / timeStep);
  const key = base32Decode(secretBase32);
  return hotp(key, counter, digits);
}

export function verifyTotp(token: string, secretBase32: string, window = 1, timeStep = 30, digits = 6, ts = Date.now()): boolean {
  token = String(token).trim();
  for (let w = -window; w <= window; w++) {
    const counterTs = ts + w * timeStep * 1000;
    if (totp(secretBase32, timeStep, digits, counterTs) === token) return true;
  }
  return false;
}

export function otpauthURI(issuer: string, account: string, secretBase32: string): string {
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${params.toString()}`;
}
