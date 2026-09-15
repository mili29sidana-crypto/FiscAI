import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { requireFirmPermission } from "@/lib/auth/guards";
import { removeMember } from "@/lib/services/firm-service";
import { requestMetadata } from "@/lib/security/request";
 
type Params = { params: Promise<{ id: string; memberId: string }> };
 
export const DELETE = route<Params>(async (request: NextRequest, { params }) => {
  const { id, memberId } = await params;
  const context = await requireFirmPermission(id, "firm.remove_members");
  await removeMember(id, memberId, context.user.id, requestMetadata(request));
  return jsonOk({ removed: memberId });
});