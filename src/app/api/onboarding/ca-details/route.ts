import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { requireVerifiedUser } from "@/lib/auth/guards";
import { caDetailsSchema } from "@/lib/validation/schemas";
import { saveCaDetails } from "@/lib/services/onboarding-service";
import { requestMetadata } from "@/lib/security/request";
 
export const POST = route(async (request: NextRequest) => {
  const context = await requireVerifiedUser();
  const body = caDetailsSchema.parse(await readJson(request));
  const view = await saveCaDetails(context.user.id, body, requestMetadata(request));
  return jsonOk(view);
});