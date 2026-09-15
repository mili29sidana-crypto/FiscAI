import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { requirePlatformPermission } from "@/lib/auth/guards";
import { getApplicationDetail } from "@/lib/services/review-service";
import { forbidden } from "@/lib/http/errors";
 
type Params = { params: Promise<{ id: string }> };
 
export const GET = route<Params>(async (_request, { params }) => {
  const context = await requirePlatformPermission("platform.review_applications");
  const { id } = await params;
  const detail = await getApplicationDetail(id);
  if (detail.application.userId === context.user.id) {
    throw forbidden("Reviewers cannot access their own application through the review queue");
  }
  return jsonOk(detail);
});