import { cookies } from "next/headers";
import type { Prisma, Session, User } from "@prisma/client";
import { prisma } from "../db";
import { generateToken, hashToken } from "../crypto";
import { getEnv, isProduction } from "../env";
import type { RequestMetadata } from "../security/request";
 
export type SessionUser = Omit<User, "passwordHash">;
 
export type AuthenticatedSession = {
  session: Session;
  user: SessionUser;
};
 
function stripUser(user: User): SessionUser {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}
 
function absoluteExpiry(): Date {
  return new Date(Date.now() + getEnv().SESSION_ABSOLUTE_TTL_HOURS * 60 * 60 * 1000);
}
 
function idleCutoff(): Date {
  return new Date(Date.now() - getEnv().SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000);
}
 
export async function createSession(
  userId: string,
  metadata: RequestMetadata,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ session: Session; token: string }> {
  const token = generateToken(32);
  const session = await client.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: absoluteExpiry(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    },
  });
  return { session, token };
}
 
export async function setSessionCookie(token: string): Promise<void> {
  const env = getEnv();
  const store = await cookies();
  store.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    domain: env.SESSION_COOKIE_DOMAIN,
    maxAge: env.SESSION_ABSOLUTE_TTL_HOURS * 60 * 60,
  });
}
 
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(getEnv().SESSION_COOKIE_NAME);
}
 
export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(getEnv().SESSION_COOKIE_NAME)?.value ?? null;
}
 
export async function getCurrentSession(): Promise<AuthenticatedSession | null> {
  const token = await readSessionToken();
  if (!token) return null;
 
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt) return null;
 
  const now = new Date();
  if (session.expiresAt <= now || session.lastActiveAt < idleCutoff()) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });
    return null;
  }
 
  const refreshed = await prisma.session.update({
    where: { id: session.id },
    data: { lastActiveAt: now },
  });
 
  return { session: refreshed, user: stripUser(session.user) };
}
 
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
 
export async function revokeAllSessions(
  userId: string,
  options: { exceptSessionId?: string } = {},
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const result = await client.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(options.exceptSessionId ? { id: { not: options.exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
 
/**
 * Issues a new session and revokes the previous one, defeating session fixation
 * and keeping privilege changes bound to a fresh session identifier.
 */
export async function rotateSession(
  userId: string,
  previousSessionId: string | null,
  metadata: RequestMetadata,
): Promise<string> {
  const { token } = await prisma.$transaction(async (tx) => {
    if (previousSessionId) {
      await tx.session.updateMany({
        where: { id: previousSessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return createSession(userId, metadata, tx);
  });
  await setSessionCookie(token);
  return token;
}
 
export function toPublicSession(session: Session, currentSessionId?: string) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,
    expiresAt: session.expiresAt,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    current: session.id === currentSessionId,
  };
}
 
export function toPublicUser(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    status: user.status,
    platformRole: user.platformRole,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}