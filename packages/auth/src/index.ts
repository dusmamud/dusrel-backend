import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import * as argon2 from "argon2";
import { base32Decode, base32Encode, randomInteger } from "@dusrel/utils";

/**
 * Shared auth helpers. No DB calls, no HTTP, no app logic, no secrets
 * hardcoded here. Secrets arrive as function arguments only.
 *
 * Password hashing uses Argon2id (docs/07 + packages/auth scope doc),
 * OWASP first-choice parameters for password hashing: 19 MiB memory,
 * 2 iterations, 1 lane. Argon2id for E2EE key derivation (browser
 * WASM, Phase 3) is a separate concern in packages/crypto, not here.
 */

// ---------------------------------------------------------------- passwords

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    memoryCost: 19456,
    parallelism: 1,
    timeCost: 2,
    type: argon2.argon2id,
  });
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// --------------------------------------------------------------------- TOTP
// RFC 6238, SHA-1, 30 second step, 6 digits, verification window +-1 step.

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpAuthUri(secret: string, accountName: string): string {
  const label = encodeURIComponent(`Dusrel:${accountName}`);
  const params = new URLSearchParams({
    algorithm: "SHA1",
    digits: "6",
    issuer: "Dusrel",
    period: "30",
    secret,
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function totpCodeForCounter(secret: string, counter: bigint): string {
  const key = base32Decode(secret);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const hmac = createHmac("sha1", key).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

/** Current TOTP code for a secret. Exported for tests and for any
 *  server-side code that must generate (not just verify) a code. */
export function totpCode(secret: string, nowMs = Date.now()): string {
  const counter = BigInt(Math.floor(nowMs / 1000 / 30));
  return totpCodeForCounter(secret, counter);
}

export function verifyTotp(
  secret: string,
  code: string,
  nowMs = Date.now(),
  window = 1,
): boolean {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }
  const counter = BigInt(Math.floor(nowMs / 1000 / 30));
  for (let step = -window; step <= window; step += 1) {
    const candidate = totpCodeForCounter(secret, counter + BigInt(step));
    const a = Buffer.from(candidate, "utf8");
    const b = Buffer.from(code, "utf8");
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------- JWT
// Minimal HS256 JWT with Node crypto only. Claims: sub (user id),
// sid (session id), role, iat, exp. No external JWT library in v1.

function base64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export interface AccessTokenClaims {
  exp: number;
  iat: number;
  role: string;
  sid: string;
  sub: string;
}

export function signAccessToken(
  secret: string,
  claims: Omit<AccessTokenClaims, "exp" | "iat">,
  ttlSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const header = base64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64url(
    Buffer.from(
      JSON.stringify({ ...claims, exp: nowSeconds + ttlSeconds, iat: nowSeconds }),
    ),
  );
  const signature = base64url(
    createHmac("sha256", secret).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${signature}`;
}

export function verifyAccessToken(
  secret: string,
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): AccessTokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [header, payload, signature] = parts;
  const expected = base64url(
    createHmac("sha256", secret).update(`${header}.${payload}`).digest(),
  );
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AccessTokenClaims;
    if (
      typeof claims.sub !== "string" ||
      typeof claims.sid !== "string" ||
      typeof claims.role !== "string" ||
      typeof claims.exp !== "number" ||
      claims.exp <= nowSeconds
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

// ------------------------------------------------------- tokens and codes

/** SHA-256 hex of a token. Only the hash is ever stored, never the token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** 32 random bytes as hex (256 bits, well above the 128-bit minimum). */
export function generateSecureToken(): string {
  return randomBytes(32).toString("hex");
}

/** 6-digit OTP from the CSPRNG (NIST 800-63B minimum length). */
export function generateOtpCode(): string {
  return String(randomInteger(0, 1_000_000)).padStart(6, "0");
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function randomCodeFromAlphabet(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[randomInteger(0, CODE_ALPHABET.length)];
  }
  return out;
}

/** 10 single-use backup codes. Store only their hashes, show once. */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomCodeFromAlphabet(10));
}

/** App password, shown once, in 4 groups of 4 for easy typing. */
export function generateAppPassword(): string {
  const groups = Array.from({ length: 4 }, () => randomCodeFromAlphabet(4));
  return groups.join("-");
}
