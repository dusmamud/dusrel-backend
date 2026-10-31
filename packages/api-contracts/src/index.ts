import { z } from "zod";

export * from "./mail.js";

/**
 * Shared Zod schemas for auth-api. Rule from docs/10 + api-contracts
 * scope doc: bina schema ke koi endpoint nahi banega. Services parse
 * with safeParse and return 400 on failure; they never trust raw JSON.
 *
 * Password rule (starting value, not a lock): 10-128 characters.
 * Final password policy is locked in code phase, not here alone.
 */

const emailSchema = z.string().trim().min(1).max(255).email();
const passwordSchema = z.string().min(10).max(128);
const totpCodeSchema = z.string().regex(/^\d{6}$/, "TOTP code must be 6 digits");
const uuidSchema = z.string().uuid();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  backupCode: z.string().min(1).max(32).optional(),
  // return_to: account centre login ke baad kis URL par wapas jana
  // hai. Sirf string + max length yahan check hoti hai (starting
  // value 2048, lock nahi) — asli host/scheme/path validation
  // server-side auth-api ke returnTo.ts me hoti hai (docs/28).
  // Invalid return_to par login fail NAHI hota, fallback milta hai.
  returnTo: z.string().max(2048).optional(),
  totpCode: totpCodeSchema.optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    invalidateAllSessions: z.boolean().optional().default(false),
    newPassword: passwordSchema,
    newPasswordConfirm: z.string().min(1).max(128),
  })
  .refine((v) => v.newPassword === v.newPasswordConfirm, {
    message: "New passwords do not match",
    path: ["newPasswordConfirm"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "New password must differ from the current password",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    newPasswordConfirm: z.string().min(1).max(128),
    token: z.string().min(1),
  })
  .refine((v) => v.newPassword === v.newPasswordConfirm, {
    message: "New passwords do not match",
    path: ["newPasswordConfirm"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const totpVerifySchema = z.object({
  code: totpCodeSchema,
});
export type TotpVerifyInput = z.infer<typeof totpVerifySchema>;

export const totpDisableSchema = z.object({
  backupCode: z.string().min(1).max(32).optional(),
  password: z.string().min(1).max(128),
  totpCode: totpCodeSchema.optional(),
});
export type TotpDisableInput = z.infer<typeof totpDisableSchema>;

export const appPasswordCreateSchema = z.object({
  name: z.string().trim().min(1).max(64),
});
export type AppPasswordCreateInput = z.infer<typeof appPasswordCreateSchema>;

export const adminCreateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(128),
  email: emailSchema,
  quotaGb: z.number().int().min(1).max(1000).optional(),
  role: z.enum(["admin", "user"]).default("user"),
});
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

export const adminUserStateSchema = z.object({
  reason: z.string().trim().min(1).max(512),
  state: z.enum(["active", "banned", "disabled", "suspended"]),
  suspendedUntil: z.string().datetime().optional(),
});
export type AdminUserStateInput = z.infer<typeof adminUserStateSchema>;

export const inviteAcceptSchema = z
  .object({
    password: passwordSchema,
    passwordConfirm: z.string().min(1).max(128),
    token: z.string().min(1),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
  });
export type InviteAcceptInput = z.infer<typeof inviteAcceptSchema>;

export const sessionIdParamSchema = z.object({
  id: uuidSchema,
});
export const userIdParamSchema = z.object({
  id: uuidSchema,
});
