import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { logAudit } from '../../lib/audit.js';
import { requireEntityScope, getScopeEntityId } from '../../lib/entityScope.js';
import { MoneySchema, NotesSchema, optStr } from '../../lib/validators.js';

export const unitsRouter = Router();
unitsRouter.use(authenticate);
unitsRouter.use('/:id', requireEntityScope('unit', 'Unit'));

const createUnitSchema = z.object({
  propertyId: z.string().uuid(),
  parentUnitId: optStr(z.string().uuid().nullable().optional()),
  label: z.string().min(1).max(100),
  unitType: z.enum(['FLOOR', 'APARTMENT', 'ROOM', 'BED', 'OTHER']),
  isRentable: z.boolean().default(false),
  bedrooms: z.number().int().nullable().optional(),
  bathrooms: z.number().nullable().optional(),
  squareFeet: z.number().int().nullable().optional(),
  marketRent: optStr(MoneySchema.nullable().optional()),
  notes: NotesSchema,
});

// List
unitsRouter.get('/', async (req: Request, res: Response) => {
  const { propertyId, parentUnitId, rentableOnly } = req.query;
  const entityId = getScopeEntityId(req);
  const units = await prisma.unit.findMany({
    where: {
      ...(propertyId ? { propertyId: propertyId as string } : {}),
      ...(entityId ? { property: { entityId } } : {}),
      ...(parentUnitId ? { parentUnitId: parentUnitId as string } : {}),
      ...(rentableOnly === 'true' ? { isRentable: true } : {}),
    },
    include: { childUnits: true },
    orderBy: { label: 'asc' },
  });
  res.json(units);
});

// Get tree
unitsRouter.get('/:id/tree', async (req: Request, res: Response) => {
  const unit = await prisma.unit.findUnique({
    where: { id: req.params.id },
    include: {
      childUnits: {
        include: {
          childUnits: {
            include: { childUnits: true },
          },
        },
      },
    },
  });
  if (!unit) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unit not found' } });
    return;
  }
  res.json(unit);
});

// Get by ID
unitsRouter.get('/:id', async (req: Request, res: Response) => {
  const unit = await prisma.unit.findUnique({
    where: { id: req.params.id },
    include: { childUnits: true, leases: { where: { status: 'ACTIVE' }, include: { tenant: true } } },
  });
  if (!unit) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unit not found' } });
    return;
  }
  res.json(unit);
});

// Create
unitsRouter.post('/', async (req: Request, res: Response) => {
  const data = createUnitSchema.parse(req.body);

  // Validate parent belongs to same property
  if (data.parentUnitId) {
    const parent = await prisma.unit.findUnique({ where: { id: data.parentUnitId } });
    if (!parent || parent.propertyId !== data.propertyId) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Parent unit must belong to the same property' },
      });
      return;
    }
  }

  const unit = await prisma.unit.create({ data: { ...data, marketRent: data.marketRent || undefined } });

  await logAudit({
    userId: req.user!.userId,
    action: 'unit.create',
    entityType: 'Unit',
    entityId: unit.id,
    afterJson: unit,
    ipAddress: req.ip,
  });

  res.status(201).json(unit);
});

// Update
unitsRouter.put('/:id', async (req: Request, res: Response) => {
  const data = createUnitSchema.partial().parse(req.body);
  const before = await prisma.unit.findUnique({ where: { id: req.params.id } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unit not found' } });
    return;
  }
  const unit = await prisma.unit.update({
    where: { id: req.params.id },
    data: { ...data, marketRent: data.marketRent || undefined },
  });
  await logAudit({
    userId: req.user!.userId,
    action: 'unit.update',
    entityType: 'Unit',
    entityId: unit.id,
    beforeJson: before,
    afterJson: unit,
    ipAddress: req.ip,
  });
  res.json(unit);
});

// Delete
unitsRouter.delete('/:id', async (req: Request, res: Response) => {
  const before = await prisma.unit.findUnique({ where: { id: req.params.id } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unit not found' } });
    return;
  }
  await prisma.unit.delete({ where: { id: req.params.id } });
  await logAudit({
    userId: req.user!.userId,
    action: 'unit.delete',
    entityType: 'Unit',
    entityId: req.params.id,
    beforeJson: before,
    ipAddress: req.ip,
  });
  res.status(204).send();
});
