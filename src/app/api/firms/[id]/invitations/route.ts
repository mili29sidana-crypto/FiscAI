import type { NextRequest } from "next/server";
import { jsonCreated, jsonOk } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { requireFirmPermission } from "@/lib/auth/guards";
import { invitationSchema } from "@/lib/validation/schemas";
import { createInvitation } from "@/lib/services/firm-service";
import { RATE_LIMITS, consumeRateLimit } from "@/lib/security/rate-limit";
import { requestMetadata } from "@/lib/security/request";
import { prisma } from "@/lib/db";
 
type Params = { params: Promise<{ id: string }> };
 
export const GET = route<Params>(async (_request, { params }) => {
  const { id } = await params;
  await requireFirmPermission(id, "firm.manage_members");
  const invitations = await prisma.firmInvitation.findMany({
    where: { firmId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invitedEmail: true,
      invitedRole: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  return jsonOk({ invitations });
});
 
export const POST = route<Params>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const context = await requireFirmPermission(id, "firm.invite_members");
  const body = invitationSchema.parse(await readJson(request));
  await consumeRateLimit(RATE_LIMITS.invitation, id);
  const invitation = await createInvitation(id, context.user.id, body, requestMetadata(request));
  return jsonCreated(invitation);
});