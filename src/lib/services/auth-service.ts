import { OnboardingState, TokenPurpose, UserStatus } from "@prisma/client";
import { prisma } from "../db";
import { recordAudit } from "../audit";
import { generateToken, hashPassword, hashToken, normalizeEmail, verifyPassword } from "../crypto";
import { getEnv } from "../env";
import { ApiError, conflict, forbidden, validationError } from "../http/errors";
import { logger } from "../logger";
import { sendEmail } from "../providers/email";
import {
  passwordResetEmail,
  verificationEmail,
} from "../providers/email/templates";
import type { RequestMetadata } from "../security/request";
import { revokeAllSessions } from "../auth/session";
 
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;
 
const GENERIC_CREDENTIALS_ERROR = "Invalid email or password";
const GENERIC_TOKEN_ERROR = "This link is invalid or has expired";
 
export type DevTokenHint = { devToken?: string };
 
function maybeExposeToken(token: string): DevTokenHint {
  return getEnv().EXPOSE_DEV_TOKENS ? { devToken: token } : {};
}
 
async function issueToken(userId: string, purpose: TokenPurpose, ttlMs: number) {
  const token = generateToken(32);
  await prisma.$transaction(async (tx) => {
    // Previously issued tokens of the same purpose are single-use and superseded.
    await tx.verificationToken.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.verificationToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
  });
  return token;
}
 
async function consumeToken(token: string, purpose: TokenPurpose) {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!record || record.purpose !== purpose || record.consumedAt || record.expiresAt <= new Date()) {
    throw validationError(GENERIC_TOKEN_ERROR);
  }
  const consumed = await prisma.verificationToken.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) {
    throw validationError(GENERIC_TOKEN_ERROR);
  }
  return record;
}
 
export async function registerUser(
  input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
  },
  metadata: RequestMetadata,
): Promise<DevTokenHint & { userId: string }> {
  const normalizedEmail = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
 
  let userId: string;
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email.trim(),
          normalizedEmail,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phoneNumber: input.phoneNumber ?? null,
          status: UserStatus.PENDING_EMAIL_VERIFICATION,
        },
      });
      await tx.onboardingApplication.create({
        data: { userId: created.id, state: OnboardingState.ACCOUNT_CREATED },
      });
      await recordAudit(
        {
          actorUserId: created.id,
          action: "auth.register",
          resourceType: "User",
          resourceId: created.id,
          request: metadata,
        },
        tx,
      );
      return created;
    });
    userId = user.id;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      // Do not disclose whether the email already exists.
      logger.info("register_duplicate_email_suppressed", {});
      throw conflict("If this email can be registered, a verification email has been sent");
    }
    throw error;
  }
 
  const token = await issueToken(userId, TokenPurpose.EMAIL_VERIFICATION, VERIFICATION_TTL_MS);
  await sendEmail(verificationEmail(input.email.trim(), token));
  logger.info("registration_completed", { userId });
  return { userId, ...maybeExposeToken(token) };
}
 
export async function authenticate(
  input: { email: string; password: string },
  metadata: RequestMetadata,
) {
  const normalizedEmail = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { normalizedEmail } });
 
  if (!user) {
    // Equalise timing with the password verification branch.
    await hashPassword(input.password);
    logger.info("login_failed", { reason: "unknown_user" });
    throw new ApiError("UNAUTHENTICATED", GENERIC_CREDENTIALS_ERROR);
  }
 
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    logger.warn("login_blocked_locked_account", { userId: user.id });
    throw new ApiError("UNAUTHENTICATED", GENERIC_CREDENTIALS_ERROR);
  }
 
  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const locked = attempts >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: locked ? new Date(Date.now() + LOCKOUT_MS) : user.lockedUntil,
        status: locked ? UserStatus.LOCKED : user.status,
      },
    });
    await recordAudit({
      actorUserId: user.id,
      action: "auth.login_failed",
      resourceType: "User",
      resourceId: user.id,
      request: metadata,
    });
    logger.info("login_failed", { userId: user.id, reason: "bad_password" });
    throw new ApiError("UNAUTHENTICATED", GENERIC_CREDENTIALS_ERROR);
  }
 
  if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) {
    throw forbidden("Account is not active. Contact support for account recovery.");
  }
 
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      status: user.status === UserStatus.LOCKED ? UserStatus.ACTIVE : user.status,
    },
  });
 
  await recordAudit({
    actorUserId: user.id,
    action: "auth.login",
    resourceType: "User",
    resourceId: user.id,
    request: metadata,
  });
  logger.info("login_succeeded", { userId: user.id });
  return updated;
}
 
export async function verifyEmail(token: string, metadata: RequestMetadata) {
  const record = await consumeToken(token, TokenPurpose.EMAIL_VERIFICATION);
 
  await prisma.$transaction(async (tx) => {
    if (!record.user.emailVerifiedAt) {
      await tx.user.update({
        where: { id: record.userId },
        data: {
          emailVerifiedAt: new Date(),
          status:
            record.user.status === UserStatus.PENDING_EMAIL_VERIFICATION
              ? UserStatus.ACTIVE
              : record.user.status,
        },
      });
    }
    const application = await tx.onboardingApplication.findUnique({
      where: { userId: record.userId },
    });
    if (application && application.state === OnboardingState.ACCOUNT_CREATED) {
      await tx.onboardingApplication.update({
        where: { userId: record.userId },
        data: { state: OnboardingState.EMAIL_VERIFIED, version: { increment: 1 } },
      });
    }
    await recordAudit(
      {
        actorUserId: record.userId,
        action: "auth.email_verified",
        resourceType: "User",
        resourceId: record.userId,
        request: metadata,
      },
      tx,
    );
  });
 
  logger.info("email_verified", { userId: record.userId });
  return record.userId;
}
 
export async function resendVerification(email: string): Promise<DevTokenHint> {
  const user = await prisma.user.findUnique({ where: { normalizedEmail: normalizeEmail(email) } });
  if (!user || user.emailVerifiedAt) {
    // Always respond the same way regardless of account existence.
    return {};
  }
  const token = await issueToken(user.id, TokenPurpose.EMAIL_VERIFICATION, VERIFICATION_TTL_MS);
  await sendEmail(verificationEmail(user.email, token));
  return maybeExposeToken(token);
}
 
export async function requestPasswordReset(
  email: string,
  metadata: RequestMetadata,
): Promise<DevTokenHint> {
  const user = await prisma.user.findUnique({ where: { normalizedEmail: normalizeEmail(email) } });
  if (!user) return {};
 
  const token = await issueToken(user.id, TokenPurpose.PASSWORD_RESET, RESET_TTL_MS);
  await sendEmail(passwordResetEmail(user.email, token));
  await recordAudit({
    actorUserId: user.id,
    action: "auth.password_reset_requested",
    resourceType: "User",
    resourceId: user.id,
    request: metadata,
  });
  logger.info("password_reset_requested", { userId: user.id });
  return maybeExposeToken(token);
}
 
export async function resetPassword(
  input: { token: string; password: string },
  metadata: RequestMetadata,
) {
  const record = await consumeToken(input.token, TokenPurpose.PASSWORD_RESET);
  const passwordHash = await hashPassword(input.password);
 
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        status:
          record.user.status === UserStatus.LOCKED ? UserStatus.ACTIVE : record.user.status,
      },
    });
    await tx.verificationToken.updateMany({
      where: { userId: record.userId, purpose: TokenPurpose.PASSWORD_RESET, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await revokeAllSessions(record.userId, {}, tx);
    await recordAudit(
      {
        actorUserId: record.userId,
        action: "auth.password_reset_completed",
        resourceType: "User",
        resourceId: record.userId,
        request: metadata,
      },
      tx,
    );
  });
 
  logger.info("password_reset_completed", { userId: record.userId });
  return record.userId;
}
 
export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: { currentPassword: string; password: string },
  metadata: RequestMetadata,
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const valid = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!valid) {
    throw validationError("Current password is incorrect");
  }
  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await revokeAllSessions(userId, { exceptSessionId: currentSessionId }, tx);
    await recordAudit(
      {
        actorUserId: userId,
        action: "auth.password_changed",
        resourceType: "User",
        resourceId: userId,
        request: metadata,
      },
      tx,
    );
  });
  logger.info("password_changed", { userId });
}