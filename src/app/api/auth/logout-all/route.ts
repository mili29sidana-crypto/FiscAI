import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { requireAuth } from "@/lib/auth/guards";
import { clearSessionCookie, revokeAllSessions } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { requestMetadata } from "@/lib/security/request";
 
export const POST = route(async (request: NextRequest) => {
  const context = await requireAuth();
  const revoked = await revokeAllSessions(context.user.id);
  await recordAudit({
    actorUserId: context.user.id,
    action: "auth.logout_all",
    resourceType: "User",
    resourceId: context.user.id,
    metadata: { revoked },
    request: requestMetadata(request),
  });
  await clearSessionCookie();
  return jsonOk({ revoked });
});