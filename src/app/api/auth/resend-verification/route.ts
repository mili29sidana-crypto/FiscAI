import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { emailOnlySchema } from "@/lib/validation/schemas";
import { resendVerification } from "@/lib/services/auth-service";
import { RATE_LIMITS, consumeRateLimit } from "@/lib/security/rate-limit";
import { clientIdentifier } from "@/lib/security/request";
import { normalizeEmail } from "@/lib/crypto";
 
export const POST = route(
  async (request: NextRequest) => {
    const body = emailOnlySchema.parse(await readJson(request));
    await consumeRateLimit(
      RATE_LIMITS.resendVerification,
      clientIdentifier(request, normalizeEmail(body.email)),
    );
    const result = await resendVerification(body.email);
    return jsonOk({
      message: "If the account exists and is unverified, a verification email has been sent.",
      ...result,
    });
  },
  { csrf: false },
);