import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { tokenSchema } from "@/lib/validation/schemas";
import { verifyEmail } from "@/lib/services/auth-service";
import { RATE_LIMITS, consumeRateLimit } from "@/lib/security/rate-limit";
import { clientIdentifier, requestMetadata } from "@/lib/security/request";
 
// CSRF is not enforced: the verification link is followed before a session cookie
// exists, and the single-use token is itself the proof of intent.
export const POST = route(
  async (request: NextRequest) => {
    const body = tokenSchema.parse(await readJson(request));
    await consumeRateLimit(RATE_LIMITS.verifyEmail, clientIdentifier(request, "verify"));
    await verifyEmail(body.token, requestMetadata(request));
    return jsonOk({ message: "Email verified" });
  },
  { csrf: false },
);