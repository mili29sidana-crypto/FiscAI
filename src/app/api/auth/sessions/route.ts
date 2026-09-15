import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { requireAuth } from "@/lib/auth/guards";
import { toPublicSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
 
export const GET = route(async () => {
  const context = await requireAuth();
  const sessions = await prisma.session.findMany({
    where: { userId: context.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: "desc" },
  });
  return jsonOk({
    sessions: sessions.map((session) => toPublicSession(session, context.session.id)),
  });
});