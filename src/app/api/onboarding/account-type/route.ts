import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { requireVerifiedUser } from "@/lib/auth/guards";
import { accountTypeSchema } from "@/lib/validation/schemas";
import { selectAccountType } from "@/lib/services/onboarding-service";
import { requestMetadata } from "@/lib/security/request";
 
export const POST = route(async (request: NextRequest) => {
  const context = await requireVerifiedUser();
  const body = accountTypeSchema.parse(await readJson(request));
  const view = await selectAccountType(context.user.id, body.accountType, requestMetadata(request));
  return jsonOk(view);
});