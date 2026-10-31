/**
 * auth-api configuration. All numbers below are STARTING VALUES from
 * the docs (docs/21, 25, 27, 28, 29), not final locks. They are
 * centralised here so locking them later is a one-file change.
 * Env names use the AUTH_ prefix (docs/10 naming rule).
 */
export interface AuthConfig {
  accessTokenTtlSeconds: number;
  appUrl: string;
  corsOrigin: string;
  inviteTtlSeconds: number;
  jwtSecret: string;
  otpMaxAttempts: number;
  otpTtlSeconds: number;
  port: number;
  refreshTokenTtlSeconds: number;
  resetTokenTtlSeconds: number;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const jwtSecret = env.AUTH_JWT_SECRET;
  if (!jwtSecret && env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET is required in production");
  }
  if (!jwtSecret) {
    console.warn(
      "[auth-api] WARNING: AUTH_JWT_SECRET is not set. Using a dev-only " +
        "default secret. Never run production on this secret.",
    );
  }
  return {
    accessTokenTtlSeconds: envInt("AUTH_ACCESS_TOKEN_TTL_SECONDS", 15 * 60),
    appUrl: env.AUTH_APP_URL ?? "http://localhost:3000",
    corsOrigin: env.AUTH_CORS_ORIGIN ?? "http://localhost:3000",
    inviteTtlSeconds: envInt("AUTH_INVITE_TTL_SECONDS", 24 * 60 * 60),
    jwtSecret: jwtSecret ?? "dev-only-change-me",
    otpMaxAttempts: envInt("AUTH_OTP_MAX_ATTEMPTS", 5),
    otpTtlSeconds: envInt("AUTH_OTP_TTL_SECONDS", 10 * 60),
    port: envInt("PORT", 3001),
    refreshTokenTtlSeconds: envInt(
      "AUTH_REFRESH_TOKEN_TTL_SECONDS",
      30 * 24 * 60 * 60,
    ),
    resetTokenTtlSeconds: envInt("AUTH_RESET_TOKEN_TTL_SECONDS", 60 * 60),
  };
}
