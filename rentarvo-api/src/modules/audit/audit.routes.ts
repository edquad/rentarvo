import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';

export const auditRouter = Router();
auditRouter.use(authenticate);

// GET /audit-logs?entityType=Property&entityId=xxx
auditRouter.get('/', async (req: Request, res: Response) => {
  const { entityType, entityId, limit = '50', page = '1' } = req.query;

  const where: any = {};
  if (entityType) where.entityType = { equals: entityType as string, mode: 'insensitive' };
  if (entityId) where.entityId = entityId as string;

  const take = Math.min(parseInt(limit as string, 10) || 50, 100);
  const skip = (Math.max(parseInt(page as string, 10) || 1, 1) - 1) * take;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ data: logs, total, page: parseInt(page as string, 10), limit: take });
});
