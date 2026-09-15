import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { requireFirmPermission } from "@/lib/auth/guards";
import { listMembers } from "@/lib/services/firm-service";
 
type Params = { params: Promise<{ id: string }> };
 
export const GET = route<Params>(async (_request, { params }) => {
  const { id } = await params;
  await requireFirmPermission(id, "firm.view");
  return jsonOk({ members: await listMembers(id) });
});