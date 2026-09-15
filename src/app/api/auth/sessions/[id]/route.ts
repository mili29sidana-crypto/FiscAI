import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { requireAuth } from "@/lib/auth/guards";
import { clearSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/http/errors";
import { recordAudit } from "@/lib/audit";
import { requestMetadata } from "@/lib/security/request";
 
type Params = { params: Promise<{ id: string }> };
 
export const DELETE = route<Params>(async (request: NextRequest, { params }) => {
  const context = await requireAuth();
  const { id } = await params;
 
  // Ownership is enforced in the predicate so another user's session id is a 404.
  const result = await prisma.session.updateMany({
    where: { id, userId: context.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw notFound("Session not found");
 
  await recordAudit({
    actorUserId: context.user.id,
    action: "auth.session_revoked",
    resourceType: "Session",
    resourceId: id,
    request: requestMetadata(request),
  });
 
  if (id === context.session.id) {
    await clearSessionCookie();
  }
  return jsonOk({ revoked: id });
});