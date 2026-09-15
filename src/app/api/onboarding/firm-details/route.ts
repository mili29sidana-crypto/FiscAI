import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { requireVerifiedUser } from "@/lib/auth/guards";
import { firmDetailsSchema } from "@/lib/validation/schemas";
import { saveFirmDetails } from "@/lib/services/onboarding-service";
import { requestMetadata } from "@/lib/security/request";
 
export const POST = route(async (request: NextRequest) => {
  const context = await requireVerifiedUser();
  const body = firmDetailsSchema.parse(await readJson(request));
  const view = await saveFirmDetails(context.user.id, body, requestMetadata(request));
  return jsonOk(view);
});