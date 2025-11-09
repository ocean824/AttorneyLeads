
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
const scrypt = promisify(_scrypt);

type Parsed = { N: number; r: number; p: number; salt: Buffer; hash: Buffer };

const PARAMS = { N: 16384, r: 8, p: 1 }; // conservative, fast enough for server usage
const KEYLEN = 64;

function encode(salt: Buffer, hash: Buffer) {
  return `scrypt$N=${PARAMS.N}$r=${PARAMS.r}$p=${PARAMS.p}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function parse(stored: string): Parsed {
  // format: scrypt$N=16384$r=8$p=1$<saltHex>$<hashHex>
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") throw new Error("Invalid password hash format");
  const N = Number(parts[1].split("=")[1]);
  const r = Number(parts[2].split("=")[1]);
  const p = Number(parts[3].split("=")[1]);
  const salt = Buffer.from(parts[4], "hex");
  const hash = Buffer.from(parts[5], "hex");
  return { N, r, p, salt, hash };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, KEYLEN, { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p })) as Buffer;
  return encode(salt, hash);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const { N, r, p, salt, hash } = parse(stored);
  const candidate = (await scrypt(password, salt, hash.length, { N, r, p })) as Buffer;
  if (candidate.length != hash.length) return false;
  return timingSafeEqual(candidate, hash);
}
