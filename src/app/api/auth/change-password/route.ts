import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { changePasswordSchema } from "@/lib/validation/schemas";
import { changePassword } from "@/lib/services/auth-service";
import { requireActiveUser } from "@/lib/auth/guards";
import { requestMetadata } from "@/lib/security/request";
import { rotateSession } from "@/lib/auth/session";
 
export const POST = route(async (request: NextRequest) => {
  const context = await requireActiveUser();
  const body = changePasswordSchema.parse(await readJson(request));
  await changePassword(
    context.user.id,
    context.session.id,
    { currentPassword: body.currentPassword, password: body.password },
    requestMetadata(request),
  );
  await rotateSession(context.user.id, context.session.id, requestMetadata(request));
  return jsonOk({ message: "Password changed. Other sessions were signed out." });
});