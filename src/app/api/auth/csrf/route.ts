import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { ensureCsrfToken } from "@/lib/security/csrf";
 
export const GET = route(async () => {
  const csrfToken = await ensureCsrfToken();
  return jsonOk({ csrfToken });
});