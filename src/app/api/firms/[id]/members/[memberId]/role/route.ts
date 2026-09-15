import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { requireFirmPermission } from "@/lib/auth/guards";
import { roleChangeSchema } from "@/lib/validation/schemas";
import { changeMemberRole } from "@/lib/services/firm-service";
import { requestMetadata } from "@/lib/security/request";
 
type Params = { params: Promise<{ id: string; memberId: string }> };
 
export const PATCH = route<Params>(async (request: NextRequest, { params }) => {
  const { id, memberId } = await params;
  const context = await requireFirmPermission(id, "firm.manage_roles");
  const body = roleChangeSchema.parse(await readJson(request));
  await changeMemberRole(id, memberId, context.user.id, body.role, requestMetadata(request));
  return jsonOk({ memberId, role: body.role });
});