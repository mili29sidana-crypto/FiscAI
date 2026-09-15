import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./errors";
import { logger } from "../logger";
 
export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, { status: 200, ...init });
}
 
export function jsonCreated<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}
 
export function jsonError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 },
    );
  }
  logger.error("unhandled_api_error", {
    message: error instanceof Error ? error.message : "unknown",
  });
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
    { status: 500 },
  );
}