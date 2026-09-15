"use client";
 
const CSRF_COOKIE = "catax_csrf";
 
function readCsrfCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
 
async function csrfToken(): Promise<string | null> {
  const existing = readCsrfCookie();
  if (existing) return existing;
  await fetch("/api/auth/csrf", { credentials: "same-origin" });
  return readCsrfCookie();
}
 
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };
 
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const method = init.method ?? (init.body !== undefined ? "POST" : "GET");
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET" && method !== "HEAD") {
    const token = await csrfToken();
    if (token) headers["x-csrf-token"] = token;
  }
 
  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
 
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    const error = payload.error as { message?: string; code?: string } | undefined;
    return {
      ok: false,
      error: error?.message ?? "Request failed",
      code: error?.code,
    };
  }
  return { ok: true, data: (payload.data ?? payload) as T };
}