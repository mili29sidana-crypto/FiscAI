import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { requireActiveUser } from "@/lib/auth/guards";
import { getApplicationView } from "@/lib/services/onboarding-service";
 
export const GET = route(async () => {
  const context = await requireActiveUser();
  return jsonOk(await getApplicationView(context.user.id));
});