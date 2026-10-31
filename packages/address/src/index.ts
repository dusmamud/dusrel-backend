/**
 * Shared address rules — auth-api aur mail-api dono ke liye ek hi
 * sach. Pehle ye list aur ye validation mail-api (aur auth-api)
 * me copy-paste thi, isliye dono me drift ho sakta tha: ek jagah
 * allowed address doosri jagah reject ho sakta tha. Ab ye package
 * ek hi source hai.
 *
 * Is slice me mail-api is package par migrate hua hai; auth-api
 * ka migration coordinator karega — tab tak auth-api ki apni copy
 * rehti hai, isliye drift ka risk tab tak poori tarah khatam nahi
 * hua hai (report me saaf likha hai).
 *
 * Pure helpers only: koi DB call, koi API call, koi secret, koi
 * doosre @dusrel package ka import nahi. ZERO runtime deps.
 */

/**
 * Reserved local-parts — VERBATIM wahi 13 entries jo mail-api v1
 * me thi. Ek bhi entry mat badlo bina docs/decision ke, kyunki
 * ye list signup (primary address) aur alias dono par lagu hoti
 * hai; badli to koi reserved address creatable ho sakta hai.
 */
export const RESERVED_LOCAL_PARTS = new Set([
  "abuse",
  "account",
  "admin",
  "help",
  "hostmaster",
  "info",
  "mail",
  "no-reply",
  "noreply",
  "postmaster",
  "security",
  "support",
  "webmaster",
]);

/**
 * Package ki apni error — service ke ApiError par depend nahi
 * karti, taaki ye package kisi service ka import na kare.
 * Service isko pakad kar apne ApiError (same code/message) me
 * badalta hai, taaki API contract same rahe.
 */
export class AddressError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AddressError";
  }
}

/**
 * Alias address validate karo (docs/29 ke rules, starting
 * proposals — locks nahi):
 * - Ek hi address ho (ek @ ke saath), lowercase return hota hai.
 * - Phase 1 single-domain: alias user ke apne domain par hi ho.
 * - Local part 3-64 chars, sirf a-z 0-9 . _ - .
 * - Local part dot se shuru/khatam na ho, consecutive dots na hon.
 * - Reserved local-part reject.
 * - Alias primary address ke barabar na ho.
 * Galat hone par AddressError throw hota hai (code + message).
 */
export function validateAliasAddress(address: string, primaryEmail: string): string {
  const lower = address.toLowerCase();
  const parts = lower.split("@");
  if (parts.length !== 2) {
    throw new AddressError("invalid_email", "Alias must be a single address");
  }
  const [local, domain] = parts;
  const primaryDomain = primaryEmail.split("@")[1]?.toLowerCase();
  if (!primaryDomain || domain !== primaryDomain) {
    // Phase 1 is single-domain (docs/29 Section 6): an alias lives
    // on the user's own domain, never on someone else's domain.
    throw new AddressError("invalid_domain", "Alias must be on your own domain");
  }
  if (local.length < 3 || local.length > 64) {
    throw new AddressError("invalid_email", "Local part must be 3-64 characters");
  }
  if (!/^[a-z0-9._-]+$/.test(local)) {
    throw new AddressError(
      "invalid_email",
      "Local part may contain only a-z, 0-9, dot, underscore, hyphen",
    );
  }
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    throw new AddressError(
      "invalid_email",
      "Local part must not start/end with a dot or contain consecutive dots",
    );
  }
  if (RESERVED_LOCAL_PARTS.has(local)) {
    throw new AddressError("reserved_email", "This address is reserved");
  }
  if (lower === primaryEmail.toLowerCase()) {
    throw new AddressError("invalid_email", "Alias cannot equal your primary address");
  }
  return lower;
}
