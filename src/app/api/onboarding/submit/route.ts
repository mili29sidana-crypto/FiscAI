import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { requireVerifiedUser } from "@/lib/auth/guards";
import { submitApplication } from "@/lib/services/onboarding-service";
import { requestMetadata } from "@/lib/security/request";
 
export const POST = route(async (request: NextRequest) => {
  const context = await requireVerifiedUser();
  const view = await submitApplication(context.user.id, requestMetadata(request));
  return jsonOk(view);
});