import { z } from "zod";
 
const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === "boolean" ? value : value === "true"));
 
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.url().default("http://localhost:3000"),
  SESSION_COOKIE_NAME: z.string().default("catax_session"),
  SESSION_COOKIE_DOMAIN: z.string().optional(),
  SESSION_ABSOLUTE_TTL_HOURS: z.coerce.number().int().positive().default(12),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(60),
  CSRF_COOKIE_NAME: z.string().default("catax_csrf"),
  EMAIL_PROVIDER: z.enum(["console", "filesystem", "smtp"]).default("filesystem"),
  EMAIL_FROM: z.string().default("no-reply@catax.local"),
  EMAIL_OUTBOX_DIR: z.string().default(".mail"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  CA_VERIFICATION_PROVIDER: z.enum(["mock", "manual"]).default("mock"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  ALLOWED_HOSTS: z.string().default("localhost:3000,127.0.0.1:3000"),
  TRUST_PROXY: booleanish.default(false),
  BOOTSTRAP_PLATFORM_ADMIN_EMAIL: z.string().optional(),
  BOOTSTRAP_PLATFORM_ADMIN_PASSWORD: z.string().optional(),
  EXPOSE_DEV_TOKENS: booleanish.default(false),
});
 
export type AppEnv = z.infer<typeof envSchema>;
 
let cached: AppEnv | null = null;
 
export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    if (env.EXPOSE_DEV_TOKENS) {
      throw new Error("EXPOSE_DEV_TOKENS must be disabled in production");
    }
    if (!env.APP_URL.startsWith("https://")) {
      throw new Error("APP_URL must use https in production");
    }
  }
  cached = env;
  return env;
}
 
export function resetEnvCache(): void {
  cached = null;
}
 
export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}
 
export function allowedOrigins(): string[] {
  return getEnv()
    .ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
 
export function allowedHosts(): string[] {
  return getEnv()
    .ALLOWED_HOSTS.split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}