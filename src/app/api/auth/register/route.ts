import type { NextRequest } from "next/server";
import { jsonCreated } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { registerSchema } from "@/lib/validation/schemas";
import { registerUser } from "@/lib/services/auth-service";
import { RATE_LIMITS, consumeRateLimit } from "@/lib/security/rate-limit";
import { clientIdentifier, requestMetadata } from "@/lib/security/request";
import { normalizeEmail } from "@/lib/crypto";
 
export const POST = route(async (request: NextRequest) => {
  const body = registerSchema.parse(await readJson(request));
  await consumeRateLimit(RATE_LIMITS.register, clientIdentifier(request, normalizeEmail(body.email)));
 
  const result = await registerUser(
    {
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      phoneNumber: body.phoneNumber,
    },
    requestMetadata(request),
  );
 
  return jsonCreated({
    message: "Registration received. Check your email to verify your address.",
    ...("devToken" in result ? { devToken: result.devToken } : {}),
  });
});