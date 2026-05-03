import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { logAudit } from '../../lib/audit.js';
import { getScopeEntityId } from '../../lib/entityScope.js';

export const periodLocksRouter = Router();
periodLocksRouter.use(authenticate);

const lockSchema = z.object({
  entityId: z.string().min(1).optional(),
  year: z.number().int().min(2020).max(2099),
  month: z.number().int().min(1).max(12),
  reason: z.string().optional(),
});

// List locks for an entity
periodLocksRouter.get('/', async (req: Request, res: Response) => {
  const { year } = req.query;
  const entityId = getScopeEntityId(req);
  const where: any = {};
  if (entityId) where.entityId = entityId;
  if (year) where.year = parseInt(year as string);

  const locks = await prisma.periodLock.findMany({
    where,
    include: {
      entity: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
  res.json(locks);
});

// Lock a period
periodLocksRouter.post('/', async (req: Request, res: Response) => {
  const data = lockSchema.parse(req.body);
  // Default entityId from X-Entity-Id header if not in body (H7)
  const entityId = data.entityId || getScopeEntityId(req);
  if (!entityId) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'entityId is required (in body or X-Entity-Id header)' } });
    return;
  }

  // Check if already locked
  const existing = await prisma.periodLock.findUnique({
    where: { entityId_year_month: { entityId, year: data.year, month: data.month } },
  });
  if (existing) {
    res.status(409).json({ error: { code: 'ALREADY_LOCKED', message: `Period ${data.year}-${String(data.month).padStart(2, '0')} is already locked` } });
    return;
  }

  const lock = await prisma.periodLock.create({
    data: { entityId, year: data.year, month: data.month, reason: data.reason, lockedBy: req.user!.userId },
    include: { entity: { select: { id: true, name: true } }, user: { select: { id: true, name: true } } },
  });

  await logAudit({
    userId: req.user!.userId,
    action: 'period.lock',
    entityType: 'PeriodLock',
    entityId: lock.id,
    afterJson: lock,
    ipAddress: req.ip,
  });

  res.status(201).json(lock);
});

// Unlock a period
periodLocksRouter.delete('/:id', async (req: Request, res: Response) => {
  const lock = await prisma.periodLock.findUnique({ where: { id: req.params.id } });
  if (!lock) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Period lock not found' } });
    return;
  }

  await prisma.periodLock.delete({ where: { id: req.params.id } });

  await logAudit({
    userId: req.user!.userId,
    action: 'period.unlock',
    entityType: 'PeriodLock',
    entityId: req.params.id,
    beforeJson: lock,
    ipAddress: req.ip,
  });

  res.json({ success: true });
});

// Check if a date is in a locked period (utility endpoint)
periodLocksRouter.get('/check', async (req: Request, res: Response) => {
  const { entityId, date } = req.query;
  if (!entityId || !date) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'entityId and date are required' } });
    return;
  }

  const d = new Date(date as string);
  const lock = await prisma.periodLock.findUnique({
    where: {
      entityId_year_month: {
        entityId: entityId as string,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
      },
    },
  });

  res.json({ locked: !!lock, lock });
});
