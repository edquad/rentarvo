import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { logAudit } from '../../lib/audit.js';
import { NotesSchema, sanitizeText, escapeLike } from '../../lib/validators.js';

export const entitiesRouter = Router();
entitiesRouter.use(authenticate);

const createEntitySchema = z.object({
  name: z.string().min(1).max(200).transform(sanitizeText),
  ein: z.string().optional(),
  address: z.string().max(500).optional(),
  notes: NotesSchema,
});

// List
entitiesRouter.get('/', async (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const entities = await prisma.entity.findMany({
    where: search ? { name: { contains: escapeLike(search), mode: 'insensitive' } } : undefined,
    orderBy: { name: 'asc' },
    include: { _count: { select: { properties: true } } },
  });
  res.json(entities);
});

// Get by ID
entitiesRouter.get('/:id', async (req: Request, res: Response) => {
  const entity = await prisma.entity.findUnique({
    where: { id: req.params.id },
    include: { properties: { select: { id: true, name: true, addressLine1: true } } },
  });
  if (!entity) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Entity not found' } });
    return;
  }
  res.json(entity);
});

// Create
entitiesRouter.post('/', async (req: Request, res: Response) => {
  const data = createEntitySchema.parse(req.body);
  const entity = await prisma.entity.create({ data });
  await logAudit({
    userId: req.user!.userId,
    action: 'entity.create',
    entityType: 'Entity',
    entityId: entity.id,
    afterJson: entity,
    ipAddress: req.ip,
  });
  res.status(201).json(entity);
});

// Update
entitiesRouter.put('/:id', async (req: Request, res: Response) => {
  const data = createEntitySchema.partial().parse(req.body);
  const before = await prisma.entity.findUnique({ where: { id: req.params.id } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Entity not found' } });
    return;
  }
  const entity = await prisma.entity.update({ where: { id: req.params.id }, data });
  await logAudit({
    userId: req.user!.userId,
    action: 'entity.update',
    entityType: 'Entity',
    entityId: entity.id,
    beforeJson: before,
    afterJson: entity,
    ipAddress: req.ip,
  });
  res.json(entity);
});

// Delete
entitiesRouter.delete('/:id', async (req: Request, res: Response) => {
  const before = await prisma.entity.findUnique({ where: { id: req.params.id } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Entity not found' } });
    return;
  }
  await prisma.entity.delete({ where: { id: req.params.id } });
  await logAudit({
    userId: req.user!.userId,
    action: 'entity.delete',
    entityType: 'Entity',
    entityId: req.params.id,
    beforeJson: before,
    ipAddress: req.ip,
  });
  res.status(204).send();
});
