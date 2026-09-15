type LogLevel = "debug" | "info" | "warn" | "error";
 
const REDACTED = "[redacted]";
 
const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "newpassword",
  "currentpassword",
  "confirmpassword",
  "token",
  "tokenhash",
  "otp",
  "secret",
  "authorization",
  "cookie",
  "sessiontoken",
  "csrf",
];
 
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEYS.includes(key.toLowerCase())
        ? REDACTED
        : redact(entry, depth + 1);
    }
    return output;
  }
  return value;
}
 
function write(level: LogLevel, event: string, context: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...(redact(context) as Record<string, unknown>),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
 
export const logger = {
  debug: (event: string, context?: Record<string, unknown>) => write("debug", event, context),
  info: (event: string, context?: Record<string, unknown>) => write("info", event, context),
  warn: (event: string, context?: Record<string, unknown>) => write("warn", event, context),
  error: (event: string, context?: Record<string, unknown>) => write("error", event, context),
};