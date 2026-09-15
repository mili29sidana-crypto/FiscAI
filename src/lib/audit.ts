import { ActorType, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { redact } from "./logger";
import type { RequestMetadata } from "./security/request";
 
export type AuditInput = {
  actorUserId?: string | null;
  actorType?: ActorType;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  firmId?: string | null;
  metadata?: Record<string, unknown>;
  request?: RequestMetadata;
};
 
export async function recordAudit(
  input: AuditInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType ?? ActorType.USER,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      firmId: input.firmId ?? null,
      metadata: input.metadata
        ? (redact(input.metadata) as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      ipAddress: input.request?.ipAddress ?? null,
      userAgent: input.request?.userAgent ?? null,
    },
  });
}