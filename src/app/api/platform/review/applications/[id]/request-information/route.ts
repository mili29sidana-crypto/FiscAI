import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { readJson, route } from "@/lib/http/handler";
import { requirePlatformPermission } from "@/lib/auth/guards";
import { requestInformationSchema } from "@/lib/validation/schemas";
import { requestInformation } from "@/lib/services/review-service";
import { requestMetadata } from "@/lib/security/request";
 
type Params = { params: Promise<{ id: string }> };
 
export const POST = route<Params>(async (request: NextRequest, { params }) => {
  const context = await requirePlatformPermission("platform.review_applications");
  const { id } = await params;
  const body = requestInformationSchema.parse(await readJson(request));
  const detail = await requestInformation(
    id,
    context.user.id,
    body.message,
    requestMetadata(request),
  );
  return jsonOk({ id: detail.application.id, state: detail.application.state });
});