import { db } from '@/lib/server/db';
import type { Prisma } from '@/generated/prisma/client';

interface AuditEventInput {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}

// Protokolliert sensible Aktionen (Login, Löschungen, Zugriffsfreigaben) revisionssicher.
// Schreibfehler dürfen die eigentliche Aktion nicht verhindern, werden aber geloggt.
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error('Audit-Log konnte nicht geschrieben werden:', error);
  }
}
