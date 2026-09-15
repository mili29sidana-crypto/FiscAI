import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { requirePlatformPermission } from "@/lib/auth/guards";
import { claimForReview } from "@/lib/services/review-service";
import { requestMetadata } from "@/lib/security/request";
 
type Params = { params: Promise<{ id: string }> };
 
export const POST = route<Params>(async (request: NextRequest, { params }) => {
  const context = await requirePlatformPermission("platform.review_applications");
  const { id } = await params;
  const application = await claimForReview(id, context.user.id, requestMetadata(request));
  return jsonOk({ id: application.id, state: application.state });
});