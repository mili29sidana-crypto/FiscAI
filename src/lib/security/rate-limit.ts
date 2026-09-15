import { prisma } from "../db";
import { ApiError } from "../http/errors";
import { logger } from "../logger";
 
export type RateLimitRule = {
  name: string;
  limit: number;
  windowSeconds: number;
};
 
export const RATE_LIMITS = {
  login: { name: "login", limit: 10, windowSeconds: 300 },
  register: { name: "register", limit: 5, windowSeconds: 3600 },
  forgotPassword: { name: "forgot-password", limit: 5, windowSeconds: 3600 },
  resetPassword: { name: "reset-password", limit: 10, windowSeconds: 3600 },
  resendVerification: { name: "resend-verification", limit: 5, windowSeconds: 3600 },
  verifyEmail: { name: "verify-email", limit: 20, windowSeconds: 3600 },
  invitation: { name: "invitation", limit: 30, windowSeconds: 3600 },
} satisfies Record<string, RateLimitRule>;
 
export async function consumeRateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  const key = `${rule.name}:${identifier}`;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + rule.windowSeconds * 1000);
 
  const counter = await prisma.rateLimitCounter.upsert({
    where: { key },
    create: { key, count: 1, windowEnd },
    update: { count: { increment: 1 } },
  });
 
  if (counter.windowEnd <= now) {
    await prisma.rateLimitCounter.update({
      where: { key },
      data: { count: 1, windowEnd },
    });
    return;
  }
 
  if (counter.count > rule.limit) {
    logger.warn("rate_limit_exceeded", { rule: rule.name });
    throw new ApiError("RATE_LIMITED", "Too many requests. Please try again later.");
  }
}
 
export async function resetRateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  await prisma.rateLimitCounter
    .delete({ where: { key: `${rule.name}:${identifier}` } })
    .catch(() => undefined);
}