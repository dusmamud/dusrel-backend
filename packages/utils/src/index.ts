import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Pure helpers only. No DB calls, no API calls, no secrets, no app
 * logic. This package must not import any other @dusrel package.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 encode, without padding (TOTP secrets use this form). */
export function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** RFC 4648 base32 decode. Case-insensitive, padding optional. */
export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 character");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** CSPRNG hex string, `bytes` random bytes (default 32 = 256 bits). */
export function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Uniform random integer in [min, max) using Node's CSPRNG. */
export function randomInteger(min: number, max: number): number {
  return randomInt(min, max);
}

/** Constant-time comparison for same-length hex strings. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}
