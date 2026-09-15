import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { emailOnlySchema } from "@/lib/validation/schemas";
import { requestPasswordReset } from "@/lib/services/auth-service";
import { RATE_LIMITS, consumeRateLimit } from "@/lib/security/rate-limit";
import { clientIdentifier, requestMetadata } from "@/lib/security/request";
import { normalizeEmail } from "@/lib/crypto";
 
export const POST = route(
  async (request: NextRequest) => {
    const body = emailOnlySchema.parse(await readJson(request));
    await consumeRateLimit(
      RATE_LIMITS.forgotPassword,
      clientIdentifier(request, normalizeEmail(body.email)),
    );
    const result = await requestPasswordReset(body.email, requestMetadata(request));
    return jsonOk({
      message: "If an account exists for that email, a reset link has been sent.",
      ...result,
    });
  },
  { csrf: false },
);