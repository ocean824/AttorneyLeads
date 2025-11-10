
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function keyFromEnv(): Buffer {
  const raw = process.env.AUTH_ENC_KEY || "change-me-please-32bytesish";
  return createHash("sha256").update(raw).digest(); // 32-byte key
}

export function encryptGCM(plaintext: string): string {
  const key = keyFromEnv();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc1$${iv.toString("hex")}$${tag.toString("hex")}$${enc.toString("hex")}`;
}

export function decryptGCM(payload: string): string {
  const [prefix, ivHex, tagHex, dataHex] = payload.split("$");
  if (prefix !== "enc1") throw new Error("Invalid enc payload");
  const key = keyFromEnv();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}
