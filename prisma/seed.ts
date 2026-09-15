import { PlatformRole, UserStatus } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { hashPassword, normalizeEmail } from "../src/lib/crypto";
import { getEnv } from "../src/lib/env";
 
async function main(): Promise<void> {
  const env = getEnv();
  const email = env.BOOTSTRAP_PLATFORM_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_PLATFORM_ADMIN_PASSWORD;
 
  if (!email || !password) {
    console.log(
      "Skipping bootstrap admin: set BOOTSTRAP_PLATFORM_ADMIN_EMAIL and BOOTSTRAP_PLATFORM_ADMIN_PASSWORD",
    );
    return;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a bootstrap admin in production");
  }
 
  const passwordHash = await hashPassword(password);
  const admin = await prisma.user.upsert({
    where: { normalizedEmail: normalizeEmail(email) },
    update: { platformRole: PlatformRole.PLATFORM_ADMIN, status: UserStatus.ACTIVE },
    create: {
      email,
      normalizedEmail: normalizeEmail(email),
      passwordHash,
      firstName: "Platform",
      lastName: "Admin",
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      platformRole: PlatformRole.PLATFORM_ADMIN,
    },
    select: { id: true, email: true },
  });
 
  const reviewerEmail = `reviewer.${normalizeEmail(email)}`;
  const reviewer = await prisma.user.upsert({
    where: { normalizedEmail: normalizeEmail(reviewerEmail) },
    update: { platformRole: PlatformRole.VERIFICATION_REVIEWER, status: UserStatus.ACTIVE },
    create: {
      email: reviewerEmail,
      normalizedEmail: normalizeEmail(reviewerEmail),
      passwordHash,
      firstName: "Verification",
      lastName: "Reviewer",
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      platformRole: PlatformRole.VERIFICATION_REVIEWER,
    },
    select: { id: true, email: true },
  });
 
  console.log(`Seeded platform admin ${admin.email} and reviewer ${reviewer.email}`);
}
 
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });