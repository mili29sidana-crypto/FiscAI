import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { clearSessionCookie, getCurrentSession, revokeSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { requestMetadata } from "@/lib/security/request";
 
export const POST = route(async (request: NextRequest) => {
  const current = await getCurrentSession();
  if (current) {
    await revokeSession(current.session.id);
    await recordAudit({
      actorUserId: current.user.id,
      action: "auth.logout",
      resourceType: "Session",
      resourceId: current.session.id,
      request: requestMetadata(request),
    });
  }
  await clearSessionCookie();
  return jsonOk({ message: "Signed out" });
});