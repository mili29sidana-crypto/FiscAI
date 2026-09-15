import {
  AccountType,
  FirmRole,
  FirmStatus,
  MembershipStatus,
  OnboardingState,
  VerificationStatus,
} from "@prisma/client";
import { prisma } from "../db";
import { recordAudit } from "../audit";
import { conflict, forbidden, invalidState, notFound } from "../http/errors";
import { logger } from "../logger";
import { sendEmail } from "../providers/email";
import { applicationDecisionEmail } from "../providers/email/templates";
import type { RequestMetadata } from "../security/request";
import { assertTransition } from "../onboarding/state-machine";
import { revokeAllSessions } from "../auth/session";
 
const PAGE_SIZE = 20;
 
export async function listApplications(filter: {
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "ALL";
  page: number;
}) {
  const where =
    filter.status === "ALL"
      ? { state: { in: [OnboardingState.SUBMITTED, OnboardingState.UNDER_REVIEW, OnboardingState.APPROVED, OnboardingState.REJECTED] } }
      : { state: filter.status as OnboardingState };
 
  const [total, applications] = await Promise.all([
    prisma.onboardingApplication.count({ where }),
    prisma.onboardingApplication.findMany({
      where,
      orderBy: { submittedAt: "asc" },
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        firm: { select: { id: true, name: true, city: true, verificationStatus: true } },
        caProfile: { select: { id: true, icaiMembershipNumber: true, verificationStatus: true } },
      },
    }),
  ]);
 
  return { total, page: filter.page, pageSize: PAGE_SIZE, applications };
}
 
export async function getApplicationDetail(applicationId: string) {
  const application = await prisma.onboardingApplication.findUnique({
    where: { id: applicationId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          status: true,
          emailVerifiedAt: true,
        },
      },
      firm: true,
      caProfile: true,
      reviewedBy: { select: { id: true, email: true } },
    },
  });
  if (!application) throw notFound("Application not found");
 
  const auditTrail = await prisma.auditLog.findMany({
    where: {
      OR: [
        { resourceType: "OnboardingApplication", resourceId: application.id },
        { firmId: application.firmId ?? undefined },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      actorUserId: true,
      actorType: true,
      createdAt: true,
      metadata: true,
    },
  });
 
  return { application, auditTrail };
}
 
export async function claimForReview(
  applicationId: string,
  reviewerId: string,
  metadata: RequestMetadata,
) {
  const application = await prisma.onboardingApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw notFound("Application not found");
  if (application.userId === reviewerId) throw forbidden("Reviewers cannot review their own application");
  if (application.state === OnboardingState.UNDER_REVIEW) return application;
  assertTransition(application.state, OnboardingState.UNDER_REVIEW, "PLATFORM");
 
  const result = await prisma.onboardingApplication.updateMany({
    where: { id: applicationId, state: application.state, version: application.version },
    data: {
      state: OnboardingState.UNDER_REVIEW,
      reviewedById: reviewerId,
      version: { increment: 1 },
    },
  });
  if (result.count === 0) throw conflict("Application was modified concurrently");
 
  await recordAudit({
    actorUserId: reviewerId,
    actorType: "PLATFORM",
    action: "review.claimed",
    resourceType: "OnboardingApplication",
    resourceId: applicationId,
    request: metadata,
  });
  return prisma.onboardingApplication.findUniqueOrThrow({ where: { id: applicationId } });
}
 
export async function requestInformation(
  applicationId: string,
  reviewerId: string,
  message: string,
  metadata: RequestMetadata,
) {
  const application = await prisma.onboardingApplication.findUnique({
    where: { id: applicationId },
    include: { user: { select: { email: true } } },
  });
  if (!application) throw notFound("Application not found");
  if (application.userId === reviewerId) throw forbidden("Reviewers cannot review their own application");
  if (!application.accountType) throw invalidState("Application has no account type");
 
  const target =
    application.accountType === AccountType.CA
      ? OnboardingState.CA_DETAILS_PENDING
      : OnboardingState.FIRM_DETAILS_PENDING;
  assertTransition(application.state, target, "PLATFORM");
 
  await prisma.$transaction(async (tx) => {
    const result = await tx.onboardingApplication.updateMany({
      where: { id: applicationId, version: application.version },
      data: {
        state: target,
        infoRequested: message,
        reviewedById: reviewerId,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) throw conflict("Application was modified concurrently");
    if (application.caProfileId) {
      await tx.cAProfile.update({
        where: { id: application.caProfileId },
        data: { verificationStatus: VerificationStatus.NEEDS_MORE_INFORMATION },
      });
    }
    await recordAudit(
      {
        actorUserId: reviewerId,
        actorType: "PLATFORM",
        action: "review.information_requested",
        resourceType: "OnboardingApplication",
        resourceId: applicationId,
        firmId: application.firmId,
        request: metadata,
      },
      tx,
    );
  });
 
  await sendEmail(
    applicationDecisionEmail(application.user.email, "INFORMATION_REQUESTED", message),
  );
  return getApplicationDetail(applicationId);
}
 
export async function approveApplication(
  applicationId: string,
  reviewerId: string,
  reviewerNotes: string | undefined,
  metadata: RequestMetadata,
) {
  const application = await prisma.onboardingApplication.findUnique({
    where: { id: applicationId },
    include: { user: { select: { email: true } } },
  });
  if (!application) throw notFound("Application not found");
  if (application.userId === reviewerId) {
    throw forbidden("Reviewers cannot approve their own application");
  }
  if (application.state === OnboardingState.APPROVED) {
    return getApplicationDetail(applicationId);
  }
  assertTransition(application.state, OnboardingState.APPROVED, "PLATFORM");
  if (!application.firmId) throw invalidState("Application has no firm to activate");
 
  const grantedRole =
    application.accountType === AccountType.CA ? FirmRole.FIRM_ADMIN : FirmRole.STAFF;
 
  await prisma.$transaction(async (tx) => {
    const result = await tx.onboardingApplication.updateMany({
      where: { id: applicationId, version: application.version },
      data: {
        state: OnboardingState.APPROVED,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        reviewerNotes: reviewerNotes ?? null,
        rejectionReason: null,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      throw conflict("Application was modified concurrently");
    }
 
    await tx.firm.update({
      where: { id: application.firmId! },
      data: {
        status: FirmStatus.ACTIVE,
        verificationStatus: VerificationStatus.VERIFIED,
        reviewerNotes: reviewerNotes ?? null,
        rejectionReason: null,
      },
    });
 
    if (application.caProfileId) {
      await tx.cAProfile.update({
        where: { id: application.caProfileId },
        data: {
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
          reviewerNotes: reviewerNotes ?? null,
        },
      });
    }
 
    await tx.firmMembership.upsert({
      where: { firmId_userId: { firmId: application.firmId!, userId: application.userId } },
      create: {
        firmId: application.firmId!,
        userId: application.userId,
        role: grantedRole,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
      },
      update: {
        role: grantedRole,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
        removedAt: null,
      },
    });
 
    await tx.onboardingApplication.update({
      where: { id: applicationId },
      data: { state: OnboardingState.COMPLETED, version: { increment: 1 } },
    });
 
    await recordAudit(
      {
        actorUserId: reviewerId,
        actorType: "PLATFORM",
        action: "review.approved",
        resourceType: "OnboardingApplication",
        resourceId: applicationId,
        firmId: application.firmId,
        metadata: { grantedRole },
        request: metadata,
      },
      tx,
    );
 
    // Privilege change: force re-authentication of the applicant's sessions.
    await revokeAllSessions(application.userId, {}, tx);
  });
 
  await sendEmail(applicationDecisionEmail(application.user.email, "APPROVED", reviewerNotes));
  logger.info("application_approved", { applicationId, reviewerId });
  return getApplicationDetail(applicationId);
}
 
export async function rejectApplication(
  applicationId: string,
  reviewerId: string,
  reason: string,
  reviewerNotes: string | undefined,
  metadata: RequestMetadata,
) {
  const application = await prisma.onboardingApplication.findUnique({
    where: { id: applicationId },
    include: { user: { select: { email: true } } },
  });
  if (!application) throw notFound("Application not found");
  if (application.userId === reviewerId) {
    throw forbidden("Reviewers cannot reject their own application");
  }
  if (application.state === OnboardingState.REJECTED) {
    return getApplicationDetail(applicationId);
  }
  assertTransition(application.state, OnboardingState.REJECTED, "PLATFORM");
 
  await prisma.$transaction(async (tx) => {
    const result = await tx.onboardingApplication.updateMany({
      where: { id: applicationId, version: application.version },
      data: {
        state: OnboardingState.REJECTED,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        rejectionReason: reason,
        reviewerNotes: reviewerNotes ?? null,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) throw conflict("Application was modified concurrently");
 
    if (application.firmId) {
      await tx.firm.update({
        where: { id: application.firmId },
        data: {
          verificationStatus: VerificationStatus.REJECTED,
          status: FirmStatus.PENDING,
          rejectionReason: reason,
          reviewerNotes: reviewerNotes ?? null,
        },
      });
    }
    if (application.caProfileId) {
      await tx.cAProfile.update({
        where: { id: application.caProfileId },
        data: {
          verificationStatus: VerificationStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: reason,
          reviewerNotes: reviewerNotes ?? null,
        },
      });
    }
 
    await recordAudit(
      {
        actorUserId: reviewerId,
        actorType: "PLATFORM",
        action: "review.rejected",
        resourceType: "OnboardingApplication",
        resourceId: applicationId,
        firmId: application.firmId,
        request: metadata,
      },
      tx,
    );
  });
 
  await sendEmail(applicationDecisionEmail(application.user.email, "REJECTED", reason));
  logger.info("application_rejected", { applicationId, reviewerId });
  return getApplicationDetail(applicationId);
}