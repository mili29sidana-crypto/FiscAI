import type { FirmMembership } from "@prisma/client";
import { MembershipStatus } from "@prisma/client";
import { prisma } from "../db";
import { forbidden, unauthenticated } from "../http/errors";
import {
  type Permission,
  permissionsForFirmRole,
  permissionsForPlatformRole,
} from "./permissions";
import { getCurrentSession, type AuthenticatedSession } from "./session";
 
export type AuthContext = AuthenticatedSession & {
  platformPermissions: Permission[];
};
 
export type FirmContext = AuthContext & {
  membership: FirmMembership;
  firmPermissions: Permission[];
};
 
export async function requireAuth(): Promise<AuthContext> {
  const current = await getCurrentSession();
  if (!current) throw unauthenticated();
  return {
    ...current,
    platformPermissions: permissionsForPlatformRole(current.user.platformRole),
  };
}
 
export async function requireActiveUser(): Promise<AuthContext> {
  const context = await requireAuth();
  if (context.user.status === "SUSPENDED" || context.user.status === "DEACTIVATED") {
    throw forbidden("Account is not active. Contact support for account recovery.");
  }
  if (context.user.status === "LOCKED") {
    throw forbidden("Account is locked. Reset your password to regain access.");
  }
  return context;
}
 
export async function requireVerifiedUser(): Promise<AuthContext> {
  const context = await requireActiveUser();
  if (!context.user.emailVerifiedAt) {
    throw forbidden("Email verification is required before continuing");
  }
  return context;
}
 
export async function requirePlatformPermission(permission: Permission): Promise<AuthContext> {
  const context = await requireActiveUser();
  if (!context.platformPermissions.includes(permission)) {
    throw forbidden("Platform authorization required");
  }
  return context;
}
 
/**
 * Resolves tenant context from the authenticated session only. A firm id from
 * the request is accepted solely as a lookup key and must match an active
 * membership of the caller.
 */
export async function requireFirmPermission(
  firmId: string,
  permission: Permission,
): Promise<FirmContext> {
  const context = await requireVerifiedUser();
  const membership = await prisma.firmMembership.findFirst({
    where: { firmId, userId: context.user.id, status: MembershipStatus.ACTIVE },
  });
  if (!membership) {
    // Deliberately identical to an unknown-firm response so firm existence is not leaked.
    throw forbidden("You do not have access to this firm");
  }
  const firmPermissions = permissionsForFirmRole(membership.role);
  if (!firmPermissions.includes(permission)) {
    throw forbidden("Insufficient firm permissions");
  }
  return { ...context, membership, firmPermissions };
}
 
export async function activeMemberships(userId: string) {
  return prisma.firmMembership.findMany({
    where: { userId, status: MembershipStatus.ACTIVE },
    include: { firm: { select: { id: true, name: true, status: true } } },
  });
}