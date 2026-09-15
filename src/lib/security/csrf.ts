import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { generateToken, safeEquals } from "../crypto";
import { getEnv, isProduction } from "../env";
import { ApiError } from "../http/errors";
 
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const CSRF_HEADER = "x-csrf-token";
 
export async function ensureCsrfToken(): Promise<string> {
  const env = getEnv();
  const store = await cookies();
  const existing = store.get(env.CSRF_COOKIE_NAME)?.value;
  if (existing) return existing;
 
  const token = generateToken(24);
  store.set(env.CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    domain: env.SESSION_COOKIE_DOMAIN,
    maxAge: 60 * 60 * 12,
  });
  return token;
}
 
export async function rotateCsrfToken(): Promise<string> {
  const env = getEnv();
  const store = await cookies();
  store.delete(env.CSRF_COOKIE_NAME);
  return ensureCsrfToken();
}
 
export async function assertCsrf(request: NextRequest): Promise<void> {
  if (!STATE_CHANGING_METHODS.has(request.method)) return;
  const env = getEnv();
  const cookieToken = request.cookies.get(env.CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken || !safeEquals(cookieToken, headerToken)) {
    throw new ApiError("CSRF_FAILED", "Invalid or missing CSRF token");
  }
}