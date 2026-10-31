import * as argon2 from "argon2";
import * as bip39 from "bip39";
import { webcrypto } from "node:crypto";
import * as openpgp from "openpgp";

/**
 * packages/crypto — shared E2EE helpers (Phase 3).
 *
 * Ye package sirf cryptographic primitives deta hai: seed, key
 * derivation, symmetric encryption aur OpenPGP. Isme koi app
 * logic nahi hai — na mail bhejna, na key directory me publish
 * karna, na private key ko kahin bhejna ya log karna.
 *
 * Teen sakht rules:
 * 1. Koi custom encryption format nahi — sirf standard algorithms
 *    (BIP39, Argon2id, AES-GCM, OpenPGP/Curve25519).
 * 2. Private key aur seed kabhi is package se bahar log ya network
 *    par nahi jayenge — ye caller ki zimmedari hai, aur test me
 *    bhi koi real key/seed hardcode nahi hai (sab runtime par
 *    generate hote hain).
 * 3. Randomness hamesha WebCrypto / CSPRNG se — Math.random kabhi
 *    crypto ke liye use nahi hoga.
 */

// ---------------------------------------------------------------------------
// BIP39 seed phrase
// ---------------------------------------------------------------------------

/**
 * BIP39 mnemonic generate karo. Strength sirf 128 ya 256 hoti hai:
 * 128 bit -> 12 words, 256 bit -> 24 words. Koi aur strength di to
 * throw hoga (chup-chap default par girna galat hota).
 */
export function generateMnemonic(strength: 128 | 256 = 128): string {
  if (strength !== 128 && strength !== 256) {
    throw new Error("Mnemonic strength must be 128 (12 words) or 256 (24 words)");
  }
  return bip39.generateMnemonic(strength);
}

/**
 * Mnemonic se deterministic BIP39 seed (64 bytes) nikalo. Seed
 * hamesha same mnemonic par same hoga — isi par key derivation
 * aur restore kaam karega. Galat mnemonic par throw hoga, khaali
 * seed kabhi return nahi hoga.
 */
export function mnemonicToSeed(mnemonic: string): Buffer {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic");
  }
  return bip39.mnemonicToSeedSync(mnemonic);
}

// ---------------------------------------------------------------------------
// Argon2id key derivation (raw key, password hashing nahi)
// ---------------------------------------------------------------------------

/**
 * Argon2id se raw key derive karo (password hashing ke liye nahi,
 * encryption key banane ke liye). Params auth package ke password
 * hashing wale hi hain (OWASP: 19 MiB, 2 iterations, 1 lane) taaki
 * dono jagah ek hi cost model rahe.
 *
 * Salt caller dega aur kam se kam 8 bytes ka hona chahiye (argon2
 * ki requirement hai) — chhota salt diya to throw hoga. Salt ko
 * kabhi hardcode mat karo; har user/key ke liye alag random salt
 * banao aur usko key ke saath (plaintext me) store karo — salt
 * secret nahi hota, lekin reuse hone par do users ki key ek jaisi
 * ban sakti hai.
 *
 * `input` password bhi ho sakta hai aur BIP39 seed (Buffer) bhi.
 * Output default 32 bytes (AES-256 ke liye) hai.
 */
export async function deriveKeyArgon2id(
  input: Buffer | string,
  salt: Buffer,
  hashLength = 32,
): Promise<Buffer> {
  if (salt.length < 8) {
    throw new Error("Argon2id salt must be at least 8 bytes");
  }
  if (hashLength <= 0) {
    throw new Error("Argon2id hash length must be positive");
  }
  // raw: true ka matlab hai encoded PHC string nahi, seedha raw
  // bytes wapas milenge — yehi encryption key banegi. Auth package
  // me raw: false (encoded string) use hota hai, kyunki wahan
  // password verify karna hota hai, key nahi banani hoti.
  return argon2.hash(input, {
    hashLength,
    memoryCost: 19456,
    parallelism: 1,
    raw: true,
    salt,
    timeCost: 2,
    type: argon2.argon2id,
  });
}

// ---------------------------------------------------------------------------
// AES-256-GCM (Node WebCrypto)
// ---------------------------------------------------------------------------

export interface AesGcmCiphertext {
  /** Base64 ciphertext (GCM auth tag ciphertext ke saath juda hota hai). */
  ciphertext: string;
  /** Base64, hamesha 12 bytes ka random IV. Secret nahi hai. */
  iv: string;
}

/**
 * Uint8Array ko uske exact ArrayBuffer slice me badlo. WebCrypto
 * ke subtle methods ko ArrayBuffer dena sabse safe hai — seedha
 * Uint8Array dene par TS ke BufferSource type se kabhi-kabhi
 * mismatch hota hai, isliye ye helper hai.
 */
function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

/**
 * AES-256-GCM se string encrypt karo. Key 32 bytes ki honi chahiye
 * (deriveKeyArgon2id se aayi hui). IV har baar naya random 12 bytes
 * ka banta hai, isliye same plaintext ki do encryption kabhi ek
 * jaisi nahi hongi. IV ciphertext ke saath return hota hai (IV
 * secret nahi hota, lekin har message ke liye unique hona zaroori
 * hai — reuse se GCM ki security toot jati hai).
 */
export async function aesGcmEncrypt(
  key: Uint8Array,
  plaintext: string,
): Promise<AesGcmCiphertext> {
  if (key.length !== 32) {
    throw new Error("AES-GCM key must be 32 bytes (256-bit)");
  }
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await webcrypto.subtle.importKey(
    "raw",
    toArrayBuffer(key),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const encrypted = await webcrypto.subtle.encrypt(
    { iv: toArrayBuffer(iv), name: "AES-GCM" },
    cryptoKey,
    toArrayBuffer(Buffer.from(plaintext, "utf8")),
  );
  return {
    ciphertext: Buffer.from(encrypted).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
  };
}

/**
 * AES-256-GCM decrypt karo. Galat key ya badla hua ciphertext ho to
 * subtle.decrypt throw karega (GCM auth tag verify nahi hoga) —
 * caller ko ye error pakad kar "decrypt failed" ke taur par handle
 * karna chahiye, kabhi bhi half-decrypted data return nahi hoga.
 */
export async function aesGcmDecrypt(
  key: Uint8Array,
  box: AesGcmCiphertext,
): Promise<string> {
  if (key.length !== 32) {
    throw new Error("AES-GCM key must be 32 bytes (256-bit)");
  }
  const iv = Buffer.from(box.iv, "base64");
  if (iv.length !== 12) {
    throw new Error("AES-GCM IV must be 12 bytes");
  }
  const cryptoKey = await webcrypto.subtle.importKey(
    "raw",
    toArrayBuffer(key),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const decrypted = await webcrypto.subtle.decrypt(
    { iv: toArrayBuffer(iv), name: "AES-GCM" },
    cryptoKey,
    toArrayBuffer(Buffer.from(box.ciphertext, "base64")),
  );
  return Buffer.from(decrypted).toString("utf8");
}

// ---------------------------------------------------------------------------
// OpenPGP Curve25519 (openpgp 6.x, RFC 9580)
// ---------------------------------------------------------------------------

export interface PgpKeypair {
  /** SHA-1 (v4) ya SHA-256 (v6) hash ka lowercase hex fingerprint. */
  fingerprint: string;
  /** Key version: 4 ya 6 (fingerprint ki length se pehchana jata hai). */
  keyVersion: 4 | 6;
  privateKeyArmored: string;
  publicKeyArmored: string;
}

/**
 * Fingerprint ki length se key version pehchano (RFC ke hisaab se):
 * v4 fingerprint SHA-1 hota hai = 20 bytes = 40 hex chars, aur v6
 * fingerprint SHA-256 hota hai = 32 bytes = 64 hex chars. Koi aur
 * length mili to throw hoga — andaze se version mat likho.
 */
function keyVersionFromFingerprint(fingerprint: string): 4 | 6 {
  if (fingerprint.length === 64) {
    return 6;
  }
  if (fingerprint.length === 40) {
    return 4;
  }
  throw new Error(`Unexpected PGP fingerprint length: ${fingerprint.length}`);
}

/**
 * Armored public key se fingerprint nikalo. Ye function key ki
 * version assume nahi karta — jo bhi key di jayegi, uska asli
 * fingerprint wapas milega (40 ya 64 hex).
 */
export async function pgpFingerprintFromPublicKey(
  publicKeyArmored: string,
): Promise<{ fingerprint: string; keyVersion: 4 | 6 }> {
  const key = await openpgp.readKey({ armoredKey: publicKeyArmored });
  const fingerprint = key.getFingerprint().toLowerCase();
  return { fingerprint, keyVersion: keyVersionFromFingerprint(fingerprint) };
}

/**
 * Curve25519 keypair generate karo (openpgp 6.x, v6 native type).
 *
 * Coordinator integration fix: worker ne `type: 'ecc', curve:
 * 'curve25519'` likha tha, jo openpgp 6.3.2 ke types me valid
 * nahi hai (TS2769) — v6 me `curve` sirf Legacy names leta hai
 * (`curve25519Legacy`), aur naya native Curve25519 ek alag
 * `type: 'curve25519'` hai. Isliye type wahi use hua hai.
 * Structure wahi standard hai: primary key signing ke liye
 * (Ed25519) aur encryption subkey Curve25519 (ECDH).
 *
 * Coordinator integration fix #2: openpgp 6.x me `config.v6Keys`
 * default FALSE hai (compatibility ke liye v4 keys banti hain),
 * isliye sirf `type: 'curve25519'` dene se bhi 40-hex v4
 * fingerprint milta tha aur v6 wala test fail hota tha. Isliye
 * generate ke waqt `config.v6Keys = true` set kiya jata hai aur
 * generate ke baad purani value wapas restore ki jati hai
 * (global config mutate karke chhodna galat hota). Isse key
 * v6 + 64-hex fingerprint hoti hai, jo test assert karta hai.
 *
 * KEY VERSION + FINGERPRINT (coordinator ke liye zaroori note):
 * openpgp 6.x default v6 keys (RFC 9580) banata hai, jinka
 * fingerprint SHA-256 = 64 hex chars hota hai. Mail-api ka
 * publishKeySchema abhi sirf 40 hex chars mangta hai (v4 format),
 * isliye is package ki v6 key ka fingerprint wahan 400 fail hoga.
 * YE MISMATCH HAI — is package me isko chhupane ke liye koi
 * truncation ya v4 downgrade nahi kiya gaya hai, kyunki v6 hi
 * current standard hai. Faisla coordinator ka hai: ya to schema
 * ko 40-or-64 hex tak badhana hoga, ya versioned fingerprint
 * format lana hoga. Is package ko haath lagaye bina report me ye
 * baat saaf likhi gayi hai.
 *
 * Private key bina passphrase ke generate hoti hai (armored string
 * me hoti hai) — isko caller ko turant encrypt karke store karna
 * chahiye (jaise AES-GCM se, seed-derived key se). Is package me
 * private key ko kahin bheja ya log nahi kiya jata.
 */
export async function generatePgpKeypair(userId: {
  email: string;
  name: string;
}): Promise<PgpKeypair> {
  if (!userId.name.trim() || !userId.email.trim()) {
    throw new Error("PGP keypair needs a non-empty name and email");
  }
  // v6 keys ke liye config flag (default false hai — v4 banti hai).
  // Generate ke baad purani value restore karo, taaki caller ke
  // process ka global config badla hua na rahe.
  const prevV6Keys = openpgp.config.v6Keys;
  openpgp.config.v6Keys = true;
  let privateKey: string;
  let publicKey: string;
  try {
    ({ privateKey, publicKey } = await openpgp.generateKey({
      type: "curve25519",
      userIDs: [{ email: userId.email, name: userId.name }],
    }));
  } finally {
    openpgp.config.v6Keys = prevV6Keys;
  }
  const { fingerprint, keyVersion } = await pgpFingerprintFromPublicKey(publicKey);
  return { fingerprint, keyVersion, privateKeyArmored: privateKey, publicKeyArmored: publicKey };
}

/**
 * String ko recipient ki public key se encrypt karo. Output armored
 * PGP message string hai (transport ke liye safe, JSON me ja sakta
 * hai). Sirf us private key se decrypt hoga jo is public key se
 * judi hai.
 */
export async function pgpEncryptString(
  publicKeyArmored: string,
  plaintext: string,
): Promise<string> {
  const encryptionKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
  const message = await openpgp.createMessage({ text: plaintext });
  return openpgp.encrypt({ encryptionKeys: encryptionKey, message });
}

/**
 * Armored PGP message ko private key se decrypt karo. Galat key ho
 * to openpgp throw karega — caller ko error pakad kar handle karna
 * chahiye. Text message ka data string hota hai; koi aur type mila
 * to throw hoga (binary message is helper ka kaam nahi hai).
 */
export async function pgpDecryptString(
  privateKeyArmored: string,
  armoredMessage: string,
): Promise<string> {
  const decryptionKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  const message = await openpgp.readMessage({ armoredMessage });
  const { data } = await openpgp.decrypt({ decryptionKeys: decryptionKey, message });
  if (typeof data !== "string") {
    throw new Error("PGP decrypt returned non-text data");
  }
  return data;
}
