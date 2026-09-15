import { FirmRole, PlatformRole } from "@prisma/client";
 
export const PERMISSIONS = [
  "platform.review_applications",
  "platform.approve_applications",
  "platform.reject_applications",
  "platform.manage_users",
  "firm.view",
  "firm.update",
  "firm.manage_members",
  "firm.invite_members",
  "firm.remove_members",
  "firm.manage_roles",
  "firm.view_audit_logs",
  "workspace.view",
  "workspace.create",
  "client.view",
  "client.manage",
] as const;
 
export type Permission = (typeof PERMISSIONS)[number];
 
export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, Permission[]> = {
  PLATFORM_ADMIN: [
    "platform.review_applications",
    "platform.approve_applications",
    "platform.reject_applications",
    "platform.manage_users",
  ],
  VERIFICATION_REVIEWER: [
    "platform.review_applications",
    "platform.approve_applications",
    "platform.reject_applications",
  ],
};
 
export const FIRM_ROLE_PERMISSIONS: Record<FirmRole, Permission[]> = {
  FIRM_ADMIN: [
    "firm.view",
    "firm.update",
    "firm.manage_members",
    "firm.invite_members",
    "firm.remove_members",
    "firm.manage_roles",
    "firm.view_audit_logs",
    "workspace.view",
    "workspace.create",
    "client.view",
    "client.manage",
  ],
  PARTNER_CA: [
    "firm.view",
    "firm.invite_members",
    "firm.view_audit_logs",
    "workspace.view",
    "workspace.create",
    "client.view",
    "client.manage",
  ],
  STAFF: ["firm.view", "workspace.view", "client.view"],
  CLIENT: ["workspace.view"],
};
 
export function permissionsForPlatformRole(role: PlatformRole | null | undefined): Permission[] {
  return role ? PLATFORM_ROLE_PERMISSIONS[role] : [];
}
 
export function permissionsForFirmRole(role: FirmRole): Permission[] {
  return FIRM_ROLE_PERMISSIONS[role];
}