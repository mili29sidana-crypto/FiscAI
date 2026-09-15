import type { NextRequest, NextResponse } from "next/server";
import { assertCsrf } from "../security/csrf";
import { assertAllowedOrigin, assertValidHost } from "../security/request";
import { validationError } from "./errors";
import { jsonError } from "./response";
 
type Handler<C> = (request: NextRequest, context: C) => Promise<NextResponse>;
 
export type RouteOptions = {
  /** Skip CSRF for endpoints that cannot rely on an established cookie. */
  csrf?: boolean;
};
 
export function route<C>(handler: Handler<C>, options: RouteOptions = {}): Handler<C> {
  return async (request, context) => {
    try {
      assertValidHost(request);
      assertAllowedOrigin(request);
      if (options.csrf !== false) {
        await assertCsrf(request);
      }
      return await handler(request, context);
    } catch (error) {
      return jsonError(error);
    }
  };
}
 
export async function readJson(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw validationError("Content-Type must be application/json");
  }
  try {
    return await request.json();
  } catch {
    throw validationError("Request body must be valid JSON");
  }
}