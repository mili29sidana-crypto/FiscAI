import { jsonOk } from "@/lib/http/response";
import { route } from "@/lib/http/handler";
import { activeMemberships, requireAuth } from "@/lib/auth/guards";
import { toPublicUser } from "@/lib/auth/session";
import { getApplicationView } from "@/lib/services/onboarding-service";
import { permissionsForFirmRole } from "@/lib/auth/permissions";
import { ensureCsrfToken } from "@/lib/security/csrf";
 
export const GET = route(async () => {
  const context = await requireAuth();
  const memberships = await activeMemberships(context.user.id);
  const onboarding = await getApplicationView(context.user.id).catch(() => null);
  const csrfToken = await ensureCsrfToken();
 
  return jsonOk({
    user: toPublicUser(context.user),
    csrfToken,
    platformPermissions: context.platformPermissions,
    memberships: memberships.map((membership) => ({
      firmId: membership.firmId,
      firmName: membership.firm.name,
      firmStatus: membership.firm.status,
      role: membership.role,
      permissions: permissionsForFirmRole(membership.role),
    })),
    onboarding,
  });
});