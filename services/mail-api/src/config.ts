/**
 * mail-api configuration. Env names use the MAIL_ prefix (docs/10).
 * In v1 both services must share the JWT secret (MAIL_JWT_SECRET,
 * falling back to AUTH_JWT_SECRET) because mail-api verifies auth-api
 * tokens by signature only — see middleware/auth.ts for the limit
 * this creates. Production must set an explicit secret; the dev
 * default below must never be used in production.
 */
export interface MailConfig {
  corsOrigin: string;
  jwtSecret: string;
  port: number;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig {
  const jwtSecret = env.MAIL_JWT_SECRET ?? env.AUTH_JWT_SECRET;
  if (!jwtSecret && env.NODE_ENV === "production") {
    throw new Error("MAIL_JWT_SECRET (or AUTH_JWT_SECRET) is required in production");
  }
  if (!jwtSecret) {
    console.warn(
      "[mail-api] WARNING: no JWT secret set. Using a dev-only default. " +
        "Never run production on this secret.",
    );
  }
  return {
    corsOrigin: env.MAIL_CORS_ORIGIN ?? "http://localhost:3000",
    jwtSecret: jwtSecret ?? "dev-only-change-me",
    port: envInt("PORT", 3002),
  };
}
