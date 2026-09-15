import { vi } from "vitest";
import { cookieJar } from "./cookie-jar";
 
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/ca_tax_os_test";
process.env.APP_URL = "http://localhost:3000";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";
process.env.ALLOWED_HOSTS = "localhost:3000";
process.env.EMAIL_PROVIDER = "console";
process.env.EXPOSE_DEV_TOKENS = "true";
process.env.CA_VERIFICATION_PROVIDER = "mock";
 
// `next/headers` requires a request scope that does not exist in unit tests. The
// jar gives handlers the same read/write cookie semantics against a fake store.
vi.mock("next/headers", () => ({
  cookies: async () => cookieJar.store(),
}));