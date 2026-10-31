/**
 * return_to validation — account centre login/signup ke baad user
 * ko wapas kis URL par bhejna hai, ye tay karta hai.
 *
 * Rules docs/28-account-centre.md ke validation section se EXACTLY
 * liye gaye hain (locked security rules) — apni taraf se koi host
 * joda ya hataya nahi gaya hai:
 *
 * - Scheme sirf `https`: `http`, `javascript:`, `data:` ya
 *   protocol-relative `//evil.com` — sab reject.
 * - Host exact allowlist se match hona chahiye, suffix trick nahi
 *   chalega (`dusrel.com.evil.com`, `evil-dusrel.com`,
 *   `mail.dusrel.com@evil.com`, `mail.dusrel.com.evil.com` — sab
 *   reject). Sirf ".dusrel.com se khatam hota hai" wala loose
 *   check mana hai.
 * - Path single `/` se shuru hoga; `//` se shuru wala reject
 *   (protocol-relative trick).
 * - Validate server-side hoga: final redirect se pehle server
 *   `return_to` ko decode karke DOBARA validate karta hai.
 * - Invalid / missing `return_to` par fallback: account home
 *   (`https://account.dusrel.com/`) — kabhi bahar ki URL par
 *   nahi, kabhi error page par user ko atakana nahi hai.
 *
 * return_to CSRF/state ki jagah NAHI hai: OIDC/OAuth flow aane
 * par usme alag se `state` (+ `nonce` / PKCE, RFC 9700 / OWASP
 * ke hisab se) chahiye hoga. return_to sirf destination hai,
 * state ki jagah nahi le sakta. Dono alag alag honge.
 *
 * Sab numbers/limits starting values hain, locks nahi: max length
 * 2048 (loginSchema me bhi wahi hai), decode rounds 3.
 */

/** Docs/28 se verbatim default allowlist — isme apni taraf se kuch mat jodo. */
export const DEFAULT_RETURN_TO_HOSTS: readonly string[] = [
  "mail.dusrel.com",
  "drive.dusrel.com",
  "chat.dusrel.com",
  "meet.dusrel.com",
  "account.dusrel.com",
  "dusrel.com",
];

/** Invalid / missing return_to par yahi fallback milta hai — kabhi error nahi. */
export const RETURN_TO_FALLBACK = "https://account.dusrel.com/";

/** Max return_to length — starting value, lock nahi (loginSchema me bhi 2048 hai). */
export const RETURN_TO_MAX_LENGTH = 2048;

export interface ResolveReturnToOptions {
  /** Test ke liye allowlist override; warna AUTH_RETURN_TO_HOSTS env se aati hai. */
  allowedHosts?: string[];
  /** Test ke liye NODE_ENV override; warna process.env.NODE_ENV se aata hai. */
  nodeEnv?: string;
}

/**
 * AUTH_RETURN_TO_HOSTS env ko parse karta hai: comma-separated
 * hosts, trim + lowercase, khaali entries nikaal do. Env khaali ya
 * set nahi hua to docs/28 wali default list milti hai.
 */
export function parseReturnToHosts(envValue: string | undefined): string[] {
  if (!envValue) {
    return [...DEFAULT_RETURN_TO_HOSTS];
  }
  const parsed = envValue
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
  return parsed.length > 0 ? parsed : [...DEFAULT_RETURN_TO_HOSTS];
}

/**
 * return_to ko validate karke safe redirect URL deta hai.
 * Invalid ya missing input par ERROR NAHI deta — fallback deta
 * hai, taaki user kabhi bahar ki URL par ya error page par na atke.
 */
export function resolveReturnTo(
  input: string | null | undefined,
  options: ResolveReturnToOptions = {},
): string {
  if (!input || input.length > RETURN_TO_MAX_LENGTH) {
    return RETURN_TO_FALLBACK;
  }
  const allowedHosts = options.allowedHosts ?? parseReturnToHosts(process.env.AUTH_RETURN_TO_HOSTS);
  const allowed = new Set(allowedHosts.map((h) => h.toLowerCase()));
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? "development";

  // Decode karke DOBARA validate karo: double-decode trick
  // (jaise %252F) se bachne ke liye decode tab tak karo jab tak
  // string badalna band na ho jaye (max 3 round, starting value).
  // Galat encoding (% wali gadbad) par seedha fallback.
  let decoded = input;
  try {
    for (let i = 0; i < 3; i += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        break;
      }
      decoded = next;
    }
  } catch {
    return RETURN_TO_FALLBACK;
  }

  let url: URL;
  try {
    url = new URL(decoded);
  } catch {
    // Relative URL, javascript:, data: ya tooti hui string — sab fallback.
    return RETURN_TO_FALLBACK;
  }

  // Scheme: sirf https. localhost par http sirf tab jab production
  // NAHI hai AUR localhost allowlist me hai (default list me
  // localhost hai hi nahi — wo sirf env override se aa sakta hai).
  const host = url.hostname.toLowerCase();
  const isLocalhost = host === "localhost";
  if (url.protocol === "https:") {
    // Theek hai, neeche host check hoga.
  } else if (
    url.protocol === "http:" &&
    nodeEnv !== "production" &&
    isLocalhost &&
    allowed.has("localhost")
  ) {
    // Dev-only localhost exception — production me kabhi nahi.
  } else {
    return RETURN_TO_FALLBACK;
  }

  // Userinfo trick: "mail.dusrel.com@evil.com" ka host waise bhi
  // evil.com hota hai (allowlist se fail), lekin
  // "evil.com@mail.dusrel.com" ka host allowlist me aa jata hai —
  // isliye koi bhi username/password wali URL seedha reject.
  if (url.username !== "" || url.password !== "") {
    return RETURN_TO_FALLBACK;
  }

  // Host exact match — suffix trick nahi chalega.
  if (!allowed.has(host)) {
    return RETURN_TO_FALLBACK;
  }

  // Path single `/` se shuru hona chahiye; `//` protocol-relative trick hai.
  if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) {
    return RETURN_TO_FALLBACK;
  }

  // Port par docs me koi rok nahi hai, isliye port ko allow kiya
  // gaya hai. Query/hash destination ka hissa hain, isliye rehte hain.
  return url.toString();
}
