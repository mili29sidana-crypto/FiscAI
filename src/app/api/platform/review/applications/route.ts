import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { requirePlatformPermission } from "@/lib/auth/guards";
import { reviewQueueSchema } from "@/lib/validation/schemas";
import { listApplications } from "@/lib/services/review-service";
 
export const GET = route(async (request: NextRequest) => {
  await requirePlatformPermission("platform.review_applications");
  const params = reviewQueueSchema.parse({
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
  });
  return jsonOk(await listApplications(params));
});