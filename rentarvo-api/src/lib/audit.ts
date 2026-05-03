import { prisma } from './prisma.js';

interface AuditEntry {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  ipAddress?: string | string[];
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      beforeJson: entry.beforeJson ? JSON.parse(JSON.stringify(entry.beforeJson)) : undefined,
      afterJson: entry.afterJson ? JSON.parse(JSON.stringify(entry.afterJson)) : undefined,
      ipAddress: Array.isArray(entry.ipAddress) ? entry.ipAddress[0] : entry.ipAddress,
    },
  });
}
