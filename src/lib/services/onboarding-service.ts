import {
  AccountType,
  FirmStatus,
  OnboardingState,
  VerificationStatus,
  type OnboardingApplication,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../db";
import { recordAudit } from "../audit";
import { conflict, invalidState, notFound } from "../http/errors";
import { logger } from "../logger";
import { verifyCaMembership } from "../providers/ca-verification";
import type { RequestMetadata } from "../security/request";
import {
  assertTransition,
  detailsStateFor,
  isEditable,
  nextUserStep,
} from "../onboarding/state-machine";
 
export type CaDetailsInput = {
  icaiMembershipNumber: string;
  professionalName: string;
  practiceName?: string;
  copStatus?: string;
  supportingReference?: string;
};
 
export type FirmDetailsInput = {
  name: string;
  type: string;
  addressLine?: string;
  city?: string;
  state?: string;
  country: string;
  contactEmail: string;
  contactPhone?: string;
  registrationNumber?: string;
};
 
export async function getApplication(userId: string): Promise<OnboardingApplication> {
  const application = await prisma.onboardingApplication.findUnique({ where: { userId } });
  if (!application) throw notFound("Onboarding application not found");
  return application;
}
 
export async function getApplicationView(userId: string) {
  const application = await prisma.onboardingApplication.findUnique({
    where: { userId },
    include: {
      caProfile: true,
      firm: true,
    },
  });
  if (!application) throw notFound("Onboarding application not found");
  return {
    state: application.state,
    accountType: application.accountType,
    editable: isEditable(application.state),
    nextStep: nextUserStep(application.state),
    submittedAt: application.submittedAt,
    reviewedAt: application.reviewedAt,
    rejectionReason: application.rejectionReason,
    infoRequested: application.infoRequested,
    caProfile: application.caProfile
      ? {
          icaiMembershipNumber: application.caProfile.icaiMembershipNumber,
          professionalName: application.caProfile.professionalName,
          practiceName: application.caProfile.practiceName,
          copStatus: application.caProfile.copStatus,
          verificationStatus: application.caProfile.verificationStatus,
        }
      : null,
    firm: application.firm
      ? {
          id: application.firm.id,
          name: application.firm.name,
          type: application.firm.type,
          city: application.firm.city,
          state: application.firm.state,
          contactEmail: application.firm.contactEmail,
          verificationStatus: application.firm.verificationStatus,
          status: application.firm.status,
        }
      : null,
  };
}
 
function assertMutable(application: OnboardingApplication): void {
  if (!isEditable(application.state) && application.state !== OnboardingState.EMAIL_VERIFIED) {
    throw invalidState(
      `Application in state ${application.state} is read-only. Request changes to reopen it.`,
    );
  }
}
 
async function updateState(
  tx: Prisma.TransactionClient,
  application: OnboardingApplication,
  nextState: OnboardingState,
  data: Prisma.OnboardingApplicationUpdateInput = {},
) {
  const result = await tx.onboardingApplication.updateMany({
    where: { id: application.id, version: application.version },
    data: {
      ...(data as Prisma.OnboardingApplicationUpdateManyMutationInput),
      state: nextState,
      version: { increment: 1 },
    },
  });
  if (result.count === 0) {
    // Optimistic concurrency: another request already advanced this application.
    throw conflict("Application was modified concurrently. Reload and try again.");
  }
}
 
export async function selectAccountType(
  userId: string,
  accountType: AccountType,
  metadata: RequestMetadata,
) {
  const application = await getApplication(userId);
  if (application.accountType === accountType && isEditable(application.state)) {
    return getApplicationView(userId);
  }
  assertMutable(application);
  assertTransition(application.state, OnboardingState.ACCOUNT_TYPE_SELECTED, "USER");
 
  await prisma.$transaction(async (tx) => {
    await updateState(tx, application, OnboardingState.ACCOUNT_TYPE_SELECTED, { accountType });
    await recordAudit(
      {
        actorUserId: userId,
        action: "onboarding.account_type_selected",
        resourceType: "OnboardingApplication",
        resourceId: application.id,
        metadata: { accountType },
        request: metadata,
      },
      tx,
    );
  });
  return getApplicationView(userId);
}
 
export async function saveCaDetails(
  userId: string,
  input: CaDetailsInput,
  metadata: RequestMetadata,
) {
  const application = await getApplication(userId);
  assertMutable(application);
  if (application.accountType !== AccountType.CA) {
    throw invalidState("CA details apply only to CA account types");
  }
 
  const verification = await verifyCaMembership({
    membershipNumber: input.icaiMembershipNumber,
    professionalName: input.professionalName,
    copClaimed: input.copStatus === "HELD",
  });
  if (verification.outcome === "REJECTED") {
    throw invalidState(verification.message);
  }
 
  const existingOwner = await prisma.cAProfile.findUnique({
    where: { icaiMembershipNumber: input.icaiMembershipNumber },
  });
  if (existingOwner && existingOwner.userId !== userId) {
    throw conflict("This ICAI membership number is already registered");
  }
 
  await prisma.$transaction(async (tx) => {
    const profile = await tx.cAProfile.upsert({
      where: { userId },
      create: {
        userId,
        icaiMembershipNumber: input.icaiMembershipNumber,
        professionalName: input.professionalName,
        practiceName: input.practiceName ?? null,
        copStatus: input.copStatus ?? null,
        supportingReference: input.supportingReference ?? null,
        providerReference: verification.providerReference,
        verificationStatus: VerificationStatus.PENDING,
      },
      update: {
        icaiMembershipNumber: input.icaiMembershipNumber,
        professionalName: input.professionalName,
        practiceName: input.practiceName ?? null,
        copStatus: input.copStatus ?? null,
        supportingReference: input.supportingReference ?? null,
        providerReference: verification.providerReference,
        verificationStatus: VerificationStatus.PENDING,
      },
    });
 
    const nextState = OnboardingState.CA_DETAILS_PENDING;
    if (application.state !== nextState) {
      assertTransition(application.state, nextState, "USER");
    }
    await updateState(tx, application, nextState, { caProfile: { connect: { id: profile.id } } });
    await recordAudit(
      {
        actorUserId: userId,
        action: "onboarding.ca_details_saved",
        resourceType: "CAProfile",
        resourceId: profile.id,
        metadata: { providerOutcome: verification.outcome },
        request: metadata,
      },
      tx,
    );
  });
 
  return getApplicationView(userId);
}
 
export async function saveFirmDetails(
  userId: string,
  input: FirmDetailsInput,
  metadata: RequestMetadata,
) {
  const application = await getApplication(userId);
  assertMutable(application);
  if (!application.accountType) {
    throw invalidState("Select an account type before submitting firm details");
  }
 
  await prisma.$transaction(async (tx) => {
    const firm = application.firmId
      ? await tx.firm.update({
          where: { id: application.firmId },
          data: {
            name: input.name,
            type: input.type,
            addressLine: input.addressLine ?? null,
            city: input.city ?? null,
            state: input.state ?? null,
            country: input.country,
            contactEmail: input.contactEmail,
            contactPhone: input.contactPhone ?? null,
            registrationNumber: input.registrationNumber ?? null,
          },
        })
      : await tx.firm.create({
          data: {
            name: input.name,
            type: input.type,
            addressLine: input.addressLine ?? null,
            city: input.city ?? null,
            state: input.state ?? null,
            country: input.country,
            contactEmail: input.contactEmail,
            contactPhone: input.contactPhone ?? null,
            registrationNumber: input.registrationNumber ?? null,
            status: FirmStatus.PENDING,
            verificationStatus: VerificationStatus.PENDING,
          },
        });
 
    const nextState = OnboardingState.FIRM_DETAILS_PENDING;
    if (application.state !== nextState) {
      assertTransition(application.state, nextState, "USER");
    }
    await updateState(tx, application, nextState, { firm: { connect: { id: firm.id } } });
    await recordAudit(
      {
        actorUserId: userId,
        action: "onboarding.firm_details_saved",
        resourceType: "Firm",
        resourceId: firm.id,
        firmId: firm.id,
        request: metadata,
      },
      tx,
    );
  });
 
  return getApplicationView(userId);
}
 
export async function submitApplication(userId: string, metadata: RequestMetadata) {
  const application = await getApplication(userId);
  if (
    application.state === OnboardingState.SUBMITTED ||
    application.state === OnboardingState.UNDER_REVIEW
  ) {
    // Idempotent: repeated submissions do not create additional records.
    return getApplicationView(userId);
  }
  assertTransition(application.state, OnboardingState.SUBMITTED, "USER");
 
  if (!application.accountType) {
    throw invalidState("Account type is required before submission");
  }
  if (application.accountType === AccountType.CA && !application.caProfileId) {
    throw invalidState("CA details are required before submission");
  }
  if (!application.firmId) {
    throw invalidState("Firm details are required before submission");
  }
 
  await prisma.$transaction(async (tx) => {
    await updateState(tx, application, OnboardingState.SUBMITTED, { submittedAt: new Date() });
    if (application.caProfileId) {
      await tx.cAProfile.update({
        where: { id: application.caProfileId },
        data: { verificationStatus: VerificationStatus.UNDER_REVIEW },
      });
    }
    await tx.firm.update({
      where: { id: application.firmId! },
      data: { verificationStatus: VerificationStatus.UNDER_REVIEW },
    });
    await recordAudit(
      {
        actorUserId: userId,
        action: "onboarding.submitted",
        resourceType: "OnboardingApplication",
        resourceId: application.id,
        firmId: application.firmId,
        request: metadata,
      },
      tx,
    );
  });
 
  logger.info("onboarding_submitted", { userId });
  return getApplicationView(userId);
}
 
/** Reopens a rejected application so the applicant can correct and resubmit. */
export async function requestChanges(userId: string, metadata: RequestMetadata) {
  const application = await getApplication(userId);
  if (application.state !== OnboardingState.REJECTED) {
    throw invalidState("Only rejected applications can be reopened by the applicant");
  }
  const target = detailsStateFor(application.accountType ?? AccountType.CLIENT);
  assertTransition(application.state, target, "USER");
 
  await prisma.$transaction(async (tx) => {
    await updateState(tx, application, target, { infoRequested: null });
    await recordAudit(
      {
        actorUserId: userId,
        action: "onboarding.reopened",
        resourceType: "OnboardingApplication",
        resourceId: application.id,
        request: metadata,
      },
      tx,
    );
  });
  return getApplicationView(userId);
}