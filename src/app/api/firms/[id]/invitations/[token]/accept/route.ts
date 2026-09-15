import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { requireVerifiedUser } from "@/lib/auth/guards";
import { acceptInvitation } from "@/lib/services/firm-service";
import { requestMetadata } from "@/lib/security/request";
import { rotateSession } from "@/lib/auth/session";
 
type Params = { params: Promise<{ token: string }> };
 
export const POST = route<Params>(async (request: NextRequest, { params }) => {
  const context = await requireVerifiedUser();
  const { token } = await params;
  const result = await acceptInvitation(
    token,
    context.user.id,
    context.user.email,
    requestMetadata(request),
  );
  if (!result.alreadyAccepted) {
    // Membership grant is a privilege change: rotate the session.
    await rotateSession(context.user.id, context.session.id, requestMetadata(request));
  }
  return jsonOk(result);
});