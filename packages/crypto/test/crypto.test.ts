import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  deriveKeyArgon2id,
  generateMnemonic,
  generatePgpKeypair,
  mnemonicToSeed,
  pgpDecryptString,
  pgpEncryptString,
  pgpFingerprintFromPublicKey,
} from "../src/index.js";

/**
 * packages/crypto tests.
 *
 * Koi real key/seed/mnemonic hardcode nahi hai — sab runtime par
 * generate hota hai. Ek hi exception: invalid mnemonic test me ek
 * jaan-boojh kar galat string hai (wo koi asli seed nahi hai).
 *
 * Note: ye test file package ke build tsconfig (include: src)
 * se compile nahi hogi — test chalane ke liye coordinator ko
 * tsconfig me "test" include karna hoga (service packages ki
 * tarah) ya test ko alag se compile karna hoga. Ye spec ka hissa
 * hai (package.json me sirf build script hai), isliye README me
 * bhi likha gaya hai.
 */

describe("crypto: BIP39", () => {
  it("128 bit -> 12 words, 256 bit -> 24 words, sab valid mnemonic", () => {
    const m12 = generateMnemonic(128);
    const m24 = generateMnemonic(256);
    assert.equal(m12.split(" ").length, 12);
    assert.equal(m24.split(" ").length, 24);
    // Do alag mnemonic kabhi ek jaisi nahi hongi (randomness check).
    assert.notEqual(m12, m24);
    // Seed deterministic hai: same mnemonic -> same seed, 64 bytes.
    const seedA = mnemonicToSeed(m12);
    const seedB = mnemonicToSeed(m12);
    assert.equal(seedA.length, 64);
    assert.ok(seedA.equals(seedB));
  });

  it("galat strength aur galat mnemonic par throw hota hai", () => {
    assert.throws(() => generateMnemonic(100 as 128), /128.*256/);
    assert.throws(() => mnemonicToSeed("not a real mnemonic phrase at all"), /Invalid mnemonic/);
  });
});

describe("crypto: Argon2id", () => {
  it("same input + salt -> same key, alag salt -> alag key, length sahi", async () => {
    const salt = Buffer.from("0123456789abcdef");
    const keyA = await deriveKeyArgon2id("password-ya-seed", salt);
    const keyB = await deriveKeyArgon2id("password-ya-seed", salt);
    const keyC = await deriveKeyArgon2id("password-ya-seed", Buffer.from("fedcba9876543210"));
    assert.equal(keyA.length, 32);
    assert.ok(keyA.equals(keyB));
    assert.ok(!keyA.equals(keyC));
    const short = await deriveKeyArgon2id("password-ya-seed", salt, 16);
    assert.equal(short.length, 16);
  });

  it("8 bytes se chhota salt throw karta hai", async () => {
    await assert.rejects(
      deriveKeyArgon2id("x", Buffer.from("short")),
      /at least 8 bytes/,
    );
  });
});

describe("crypto: AES-256-GCM", () => {
  it("round-trip (unicode samet), galat key aur tampered data fail hote hain", async () => {
    const key = Buffer.alloc(32, 7);
    const wrongKey = Buffer.alloc(32, 8);
    const text = "Dusrel mail — secret message, यूनिकोड samet.";
    const box = await aesGcmEncrypt(key, text);
    assert.equal(Buffer.from(box.iv, "base64").length, 12);
    assert.equal(await aesGcmDecrypt(key, box), text);
    await assert.rejects(aesGcmDecrypt(wrongKey, box));
    const first = box.ciphertext[0];
    const tampered = {
      ...box,
      ciphertext: (first === "A" ? "B" : "A") + box.ciphertext.slice(1),
    };
    await assert.rejects(aesGcmDecrypt(key, tampered));
  });

  it("do encryption kabhi ek jaisi nahi hoti (random IV)", async () => {
    const key = Buffer.alloc(32, 3);
    const a = await aesGcmEncrypt(key, "same text");
    const b = await aesGcmEncrypt(key, "same text");
    assert.notEqual(a.iv, b.iv);
    assert.notEqual(a.ciphertext, b.ciphertext);
  });

  it("32 bytes se alag key throw karti hai", async () => {
    await assert.rejects(aesGcmEncrypt(Buffer.alloc(16, 1), "x"), /32 bytes/);
  });
});

describe("crypto: OpenPGP Curve25519", () => {
  it("keypair generate, fingerprint v6 (64 hex), round-trip, galat key fail", async () => {
    const pair = await generatePgpKeypair({ email: "test@dusrel.example", name: "Test User" });
    assert.ok(pair.publicKeyArmored.startsWith("-----BEGIN PGP PUBLIC KEY BLOCK-----"));
    assert.ok(pair.privateKeyArmored.startsWith("-----BEGIN PGP PRIVATE KEY BLOCK-----"));
    // openpgp 6.x default v6 keys (RFC 9580) banata hai: SHA-256
    // fingerprint = 64 hex. Agar library ka default badla to ye
    // test coordinator ke run par fail hoga — yehi cross-check hai.
    assert.match(pair.fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(pair.keyVersion, 6);
    const again = await pgpFingerprintFromPublicKey(pair.publicKeyArmored);
    assert.equal(again.fingerprint, pair.fingerprint);
    assert.equal(again.keyVersion, 6);

    const secret = "PGP round-trip message — koi hardcode key nahi hai.";
    const armored = await pgpEncryptString(pair.publicKeyArmored, secret);
    assert.equal(await pgpDecryptString(pair.privateKeyArmored, armored), secret);

    const other = await generatePgpKeypair({ email: "other@dusrel.example", name: "Other" });
    await assert.rejects(pgpDecryptString(other.privateKeyArmored, armored));
  });
});
