import { NextRequest } from "next/server";
import { PlatformRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cookieJar } from "./cookie-jar";
 
export const TEST_ORIGIN = "http://localhost:3000";
 
type CallOptions = {
  method?: string;
  body?: unknown;
  searchParams?: Record<string, string>;
  headers?: Record<string, string>;
  omitCsrfHeader?: boolean;
  origin?: string | null;
  host?: string;
};
 
export type RouteHandler<C = unknown> = (
  request: NextRequest,
  context: C,
) => Promise<Response>;
 
export type JsonBody = Record<string, unknown>;
 
export async function call<B extends JsonBody = JsonBody, C = unknown>(
  handler: RouteHandler<C>,
  path: string,
  options: CallOptions = {},
  context?: C,
): Promise<{ status: number; body: B }> {
  const url = new URL(path, TEST_ORIGIN);
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    url.searchParams.set(key, value);
  }
 
  const headers = new Headers(options.headers ?? {});
  headers.set("host", options.host ?? "localhost:3000");
  if (options.origin !== null) headers.set("origin", options.origin ?? TEST_ORIGIN);
  const cookieHeader = cookieJar.header();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  if (options.body !== undefined) headers.set("content-type", "application/json");
 
  const csrf = cookieJar.get("catax_csrf");
  if (csrf && !options.omitCsrfHeader) headers.set("x-csrf-token", csrf);
 
  const request = new NextRequest(url, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
 
  const response = await handler(request, (context ?? { params: Promise.resolve({}) }) as C);
  const text = await response.text();
  return {
    status: response.status,
    body: (text ? JSON.parse(text) : {}) as B,
  };
}
 
export function params<T extends Record<string, string>>(values: T) {
  return { params: Promise.resolve(values) };
}
 
export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.firmInvitation.deleteMany(),
    prisma.onboardingApplication.deleteMany(),
    prisma.firmMembership.deleteMany(),
    prisma.cAProfile.deleteMany(),
    prisma.firm.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.session.deleteMany(),
    prisma.rateLimitCounter.deleteMany(),
    prisma.idempotencyKey.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  cookieJar.clear();
}
 
export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}@example.com`;
}
 
export const STRONG_PASSWORD = "Str0ng!Passw0rd#2026";
 
export async function makePlatformReviewer(
  email: string,
  role: PlatformRole = PlatformRole.VERIFICATION_REVIEWER,
) {
  return prisma.user.update({
    where: { normalizedEmail: email.toLowerCase() },
    data: {
      platformRole: role,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });
}