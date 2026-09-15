export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INVALID_STATE"
  | "CSRF_FAILED"
  | "INVALID_HOST"
  | "INTERNAL_ERROR";
 
const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INVALID_STATE: 422,
  CSRF_FAILED: 403,
  INVALID_HOST: 400,
  INTERNAL_ERROR: 500,
};
 
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;
 
  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}
 
export const unauthenticated = (message = "Authentication required") =>
  new ApiError("UNAUTHENTICATED", message);
export const forbidden = (message = "You do not have access to this resource") =>
  new ApiError("FORBIDDEN", message);
export const notFound = (message = "Resource not found") => new ApiError("NOT_FOUND", message);
export const conflict = (message: string) => new ApiError("CONFLICT", message);
export const invalidState = (message: string) => new ApiError("INVALID_STATE", message);
export const validationError = (message: string, details?: unknown) =>
  new ApiError("VALIDATION_ERROR", message, details);