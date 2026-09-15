import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { resetPasswordSchema } from "@/lib/validation/schemas";
import { resetPassword } from "@/lib/services/auth-service";
import { RATE_LIMITS, consumeRateLimit } from "@/lib/security/rate-limit";
import { clientIdentifier, requestMetadata } from "@/lib/security/request";
import { clearSessionCookie } from "@/lib/auth/session";
 
export const POST = route(
  async (request: NextRequest) => {
    const body = resetPasswordSchema.parse(await readJson(request));
    await consumeRateLimit(RATE_LIMITS.resetPassword, clientIdentifier(request, "reset"));
    await resetPassword({ token: body.token, password: body.password }, requestMetadata(request));
    await clearSessionCookie();
    return jsonOk({ message: "Password updated. Sign in with your new password." });
  },
  { csrf: false },
);