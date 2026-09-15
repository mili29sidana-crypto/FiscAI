import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { requireFirmPermission } from "@/lib/auth/guards";
import { revokeInvitation } from "@/lib/services/firm-service";
import { requestMetadata } from "@/lib/security/request";
 
type Params = { params: Promise<{ id: string; invitationId: string }> };
 
export const DELETE = route<Params>(async (request: NextRequest, { params }) => {
  const { id, invitationId } = await params;
  const context = await requireFirmPermission(id, "firm.manage_members");
  await revokeInvitation(id, invitationId, context.user.id, requestMetadata(request));
  return jsonOk({ revoked: invitationId });
});