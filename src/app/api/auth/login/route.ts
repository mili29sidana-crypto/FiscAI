import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { loginSchema } from "@/lib/validation/schemas";
import { authenticate } from "@/lib/services/auth-service";
import { RATE_LIMITS, consumeRateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import { clientIdentifier, requestMetadata } from "@/lib/security/request";
import { normalizeEmail } from "@/lib/crypto";
import { getCurrentSession, rotateSession, toPublicUser } from "@/lib/auth/session";
import { rotateCsrfToken } from "@/lib/security/csrf";
import { getApplicationView } from "@/lib/services/onboarding-service";
 
export const POST = route(async (request: NextRequest) => {
  const body = loginSchema.parse(await readJson(request));
  const identifier = normalizeEmail(body.email);
  await consumeRateLimit(RATE_LIMITS.login, `${clientIdentifier(request)}:${identifier}`);
 
  const user = await authenticate(body, requestMetadata(request));
 
  // Session fixation defence: any pre-login session is replaced with a new one.
  const existing = await getCurrentSession();
  await rotateSession(user.id, existing?.session.id ?? null, requestMetadata(request));
  await rotateCsrfToken();
  await resetRateLimit(RATE_LIMITS.login, `${clientIdentifier(request)}:${identifier}`);
 
  const onboarding = await getApplicationView(user.id).catch(() => null);
 
  return jsonOk({
    user: toPublicUser(user),
    onboarding: onboarding ? { state: onboarding.state, nextStep: onboarding.nextStep } : null,
  });
});