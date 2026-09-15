import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { requireFirmPermission } from "@/lib/auth/guards";
import { firmUpdateSchema } from "@/lib/validation/schemas";
import { getFirm, updateFirm } from "@/lib/services/firm-service";
import { requestMetadata } from "@/lib/security/request";
 
type Params = { params: Promise<{ id: string }> };
 
export const GET = route<Params>(async (_request, { params }) => {
  const { id } = await params;
  await requireFirmPermission(id, "firm.view");
  return jsonOk(await getFirm(id));
});
 
export const PATCH = route<Params>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const context = await requireFirmPermission(id, "firm.update");
  // Only whitelisted fields are parsed, so client-supplied status or ids are dropped.
  const body = firmUpdateSchema.parse(await readJson(request));
  return jsonOk(await updateFirm(id, context.user.id, body, requestMetadata(request)));
});