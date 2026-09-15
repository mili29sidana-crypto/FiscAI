import { FirmRole, MembershipStatus, type Prisma } from "@prisma/client";
import { prisma } from "../db";
import { recordAudit } from "../audit";
import { generateToken, hashToken, normalizeEmail } from "../crypto";
import { conflict, forbidden, invalidState, notFound, validationError } from "../http/errors";
import { logger } from "../logger";
import { getEnv } from "../env";
import { sendEmail } from "../providers/email";
import { firmInvitationEmail } from "../providers/email/templates";
import type { RequestMetadata } from "../security/request";
import { revokeAllSessions } from "../auth/session";
 
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
 
export async function getFirm(firmId: string) {
  const firm = await prisma.firm.findUnique({
    where: { id: firmId },
    select: {
      id: true,
      name: true,
      type: true,
      addressLine: true,
      city: true,
      state: true,
      country: true,
      contactEmail: true,
      contactPhone: true,
      registrationNumber: true,
      verificationStatus: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!firm) throw notFound("Firm not found");
  return firm;
}
 
export async function updateFirm(
  firmId: string,
  actorId: string,
  input: Prisma.FirmUpdateInput,
  metadata: RequestMetadata,
) {
  const firm = await prisma.$transaction(async (tx) => {
    const updated = await tx.firm.update({ where: { id: firmId }, data: input });
    await recordAudit(
      {
        actorUserId: actorId,
        action: "firm.updated",
        resourceType: "Firm",
        resourceId: firmId,
        firmId,
        metadata: { fields: Object.keys(input) },
        request: metadata,
      },
      tx,
    );
    return updated;
  });
  return getFirm(firm.id);
}
 
export async function listMembers(firmId: string) {
  return prisma.firmMembership.findMany({
    where: { firmId, status: { not: MembershipStatus.REMOVED } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      status: true,
      joinedAt: true,
      createdAt: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });
}
 
export async function createInvitation(
  firmId: string,
  actorId: string,
  input: { email: string; role: FirmRole },
  metadata: RequestMetadata,
) {
  const invitedEmail = normalizeEmail(input.email);
 
  const existingMember = await prisma.firmMembership.findFirst({
    where: {
      firmId,
      status: MembershipStatus.ACTIVE,
      user: { normalizedEmail: invitedEmail },
    },
  });
  if (existingMember) throw conflict("This person is already a member of the firm");
 
  const pending = await prisma.firmInvitation.findFirst({
    where: { firmId, invitedEmail, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  if (pending) {
    // Idempotent: an outstanding invitation is reused rather than duplicated.
    return { id: pending.id, reused: true as const };
  }
 
  const token = generateToken(32);
  const invitation = await prisma.$transaction(async (tx) => {
    const created = await tx.firmInvitation.create({
      data: {
        firmId,
        invitedEmail,
        invitedRole: input.role,
        tokenHash: hashToken(token),
        invitedById: actorId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });
    await recordAudit(
      {
        actorUserId: actorId,
        action: "firm.invitation_created",
        resourceType: "FirmInvitation",
        resourceId: created.id,
        firmId,
        metadata: { role: input.role },
        request: metadata,
      },
      tx,
    );
    return created;
  });
 
  const firm = await prisma.firm.findUniqueOrThrow({ where: { id: firmId } });
  await sendEmail(firmInvitationEmail(input.email, token, firm.name));
  logger.info("invitation_created", { firmId, invitationId: invitation.id });
 
  return {
    id: invitation.id,
    reused: false as const,
    ...(getEnv().EXPOSE_DEV_TOKENS ? { devToken: token } : {}),
  };
}
 
export async function revokeInvitation(
  firmId: string,
  invitationId: string,
  actorId: string,
  metadata: RequestMetadata,
) {
  const result = await prisma.firmInvitation.updateMany({
    where: { id: invitationId, firmId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw notFound("Invitation not found");
  await recordAudit({
    actorUserId: actorId,
    action: "firm.invitation_revoked",
    resourceType: "FirmInvitation",
    resourceId: invitationId,
    firmId,
    request: metadata,
  });
}
 
export async function acceptInvitation(
  token: string,
  userId: string,
  userEmail: string,
  metadata: RequestMetadata,
) {
  const invitation = await prisma.firmInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!invitation || invitation.revokedAt || invitation.expiresAt <= new Date()) {
    throw validationError("This invitation is invalid or has expired");
  }
  if (invitation.acceptedAt) {
    const existing = await prisma.firmMembership.findUnique({
      where: { firmId_userId: { firmId: invitation.firmId, userId } },
    });
    if (existing && existing.status === MembershipStatus.ACTIVE) {
      return { firmId: invitation.firmId, alreadyAccepted: true as const };
    }
    throw validationError("This invitation is invalid or has expired");
  }
  if (normalizeEmail(userEmail) !== invitation.invitedEmail) {
    throw forbidden("This invitation was issued to a different email address");
  }
 
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.firmInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count === 0) throw conflict("Invitation was already used");
 
    await tx.firmMembership.upsert({
      where: { firmId_userId: { firmId: invitation.firmId, userId } },
      create: {
        firmId: invitation.firmId,
        userId,
        role: invitation.invitedRole,
        status: MembershipStatus.ACTIVE,
        invitedBy: invitation.invitedById,
        joinedAt: new Date(),
      },
      update: {
        role: invitation.invitedRole,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
        removedAt: null,
      },
    });
 
    await recordAudit(
      {
        actorUserId: userId,
        action: "firm.invitation_accepted",
        resourceType: "FirmInvitation",
        resourceId: invitation.id,
        firmId: invitation.firmId,
        request: metadata,
      },
      tx,
    );
  });
 
  return { firmId: invitation.firmId, alreadyAccepted: false as const };
}
 
export async function changeMemberRole(
  firmId: string,
  memberId: string,
  actorId: string,
  role: FirmRole,
  metadata: RequestMetadata,
) {
  const membership = await prisma.firmMembership.findFirst({
    where: { id: memberId, firmId },
  });
  if (!membership) throw notFound("Membership not found");
  if (membership.userId === actorId) {
    throw forbidden("You cannot change your own role");
  }
 
  await prisma.$transaction(async (tx) => {
    if (membership.role === FirmRole.FIRM_ADMIN && role !== FirmRole.FIRM_ADMIN) {
      const admins = await tx.firmMembership.count({
        where: { firmId, role: FirmRole.FIRM_ADMIN, status: MembershipStatus.ACTIVE },
      });
      if (admins <= 1) throw invalidState("A firm must retain at least one firm admin");
    }
    await tx.firmMembership.update({ where: { id: memberId }, data: { role } });
    await recordAudit(
      {
        actorUserId: actorId,
        action: "firm.member_role_changed",
        resourceType: "FirmMembership",
        resourceId: memberId,
        firmId,
        metadata: { from: membership.role, to: role },
        request: metadata,
      },
      tx,
    );
    // Privilege change invalidates the affected member's sessions.
    await revokeAllSessions(membership.userId, {}, tx);
  });
}
 
export async function removeMember(
  firmId: string,
  memberId: string,
  actorId: string,
  metadata: RequestMetadata,
) {
  const membership = await prisma.firmMembership.findFirst({ where: { id: memberId, firmId } });
  if (!membership) throw notFound("Membership not found");
  if (membership.userId === actorId) throw forbidden("You cannot remove yourself");
 
  await prisma.$transaction(async (tx) => {
    if (membership.role === FirmRole.FIRM_ADMIN) {
      const admins = await tx.firmMembership.count({
        where: { firmId, role: FirmRole.FIRM_ADMIN, status: MembershipStatus.ACTIVE },
      });
      if (admins <= 1) throw invalidState("A firm must retain at least one firm admin");
    }
    await tx.firmMembership.update({
      where: { id: memberId },
      data: { status: MembershipStatus.REMOVED, removedAt: new Date() },
    });
    await recordAudit(
      {
        actorUserId: actorId,
        action: "firm.member_removed",
        resourceType: "FirmMembership",
        resourceId: memberId,
        firmId,
        request: metadata,
      },
      tx,
    );
    await revokeAllSessions(membership.userId, {}, tx);
  });
}
 
export async function listFirmAuditLogs(firmId: string) {
  return prisma.auditLog.findMany({
    where: { firmId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      actorUserId: true,
      actorType: true,
      resourceType: true,
      resourceId: true,
      createdAt: true,
    },
  });
}