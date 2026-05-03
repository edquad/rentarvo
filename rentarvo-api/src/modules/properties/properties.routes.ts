import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { logAudit } from '../../lib/audit.js';
import { requireEntityScope, getScopeEntityId } from '../../lib/entityScope.js';
import { NotesSchema, MoneySchema, sanitizeText, escapeLike, optStr } from '../../lib/validators.js';

export const propertiesRouter = Router();
propertiesRouter.use(authenticate);
propertiesRouter.use('/:id', requireEntityScope('property', 'Property'));

const createPropertySchema = z.object({
  entityId: z.string().min(1).optional(),
  entity: z.object({ name: z.string().min(1), ein: z.string().optional(), address: z.string().optional() }).optional(),
  name: z.string().min(1).transform(sanitizeText),
  addressLine1: z.string().min(1).transform(sanitizeText),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  propertyType: z.enum(['MULTI_FAMILY', 'SINGLE_FAMILY', 'ROOM_RENTAL', 'BED_RENTAL', 'COMMERCIAL', 'OTHER']),
  purchasePrice: optStr(MoneySchema.optional()),
  purchaseDate: z.string().optional(),
  rehabCost: optStr(MoneySchema.optional()),
  currentValue: optStr(MoneySchema.optional()),
  mortgageBalance: optStr(MoneySchema.optional()),
  monthlyMortgage: MoneySchema.default('0'),
  monthlyTax: MoneySchema.default('0'),
  monthlyInsurance: MoneySchema.default('0'),
  monthlyHoa: optStr(MoneySchema.optional()),
  notes: NotesSchema,
  coverPhotoUrl: z.string().optional(),
});

// List
propertiesRouter.get('/', async (req: Request, res: Response) => {
  const { search } = req.query;
  const entityId = getScopeEntityId(req);
  const include = (req.query.include as string)?.split(',') || [];

  const properties = await prisma.property.findMany({
    where: {
      ...(entityId ? { entityId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: escapeLike(search as string), mode: 'insensitive' } },
              { addressLine1: { contains: escapeLike(search as string), mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      entity: true,
      units: include.includes('units'),
      ...(include.includes('activeLeases')
        ? { units: { include: { leases: { where: { status: 'ACTIVE' } } } } }
        : {}),
    },
    orderBy: { name: 'asc' },
  });
  res.json(properties);
});

// Get by ID
propertiesRouter.get('/:id', async (req: Request, res: Response) => {
  const property = await prisma.property.findUnique({
    where: { id: req.params.id },
    include: {
      entity: true,
      units: { include: { childUnits: true, leases: { where: { status: 'ACTIVE' }, include: { tenant: true } } } },
    },
  });
  if (!property) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Property not found' } });
    return;
  }
  res.json(property);
});

// Create
propertiesRouter.post('/', async (req: Request, res: Response) => {
  const data = createPropertySchema.parse(req.body);

  let entityId = data.entityId || getScopeEntityId(req);

  // Inline entity creation
  if (!entityId && data.entity) {
    const newEntity = await prisma.entity.create({ data: data.entity });
    entityId = newEntity.id;
  }

  if (!entityId) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'entityId or entity object required' } });
    return;
  }

  const { entity: _entity, ...propertyData } = data;
  const property = await prisma.property.create({
    data: {
      ...propertyData,
      entityId,
      purchasePrice: data.purchasePrice || undefined,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      rehabCost: data.rehabCost || undefined,
      currentValue: data.currentValue || undefined,
      mortgageBalance: data.mortgageBalance || undefined,
      monthlyHoa: data.monthlyHoa || undefined,
    },
    include: { entity: true },
  });

  await logAudit({
    userId: req.user!.userId,
    action: 'property.create',
    entityType: 'Property',
    entityId: property.id,
    afterJson: property,
    ipAddress: req.ip,
  });

  res.status(201).json(property);
});

// Update
propertiesRouter.put('/:id', async (req: Request, res: Response) => {
  const data = createPropertySchema.partial().parse(req.body);
  const before = await prisma.property.findUnique({ where: { id: req.params.id } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Property not found' } });
    return;
  }

  const { entity: _entity, ...updateData } = data;
  const property = await prisma.property.update({
    where: { id: req.params.id },
    data: {
      ...updateData,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
    },
    include: { entity: true },
  });

  await logAudit({
    userId: req.user!.userId,
    action: 'property.update',
    entityType: 'Property',
    entityId: property.id,
    beforeJson: before,
    afterJson: property,
    ipAddress: req.ip,
  });

  res.json(property);
});

// Delete
propertiesRouter.delete('/:id', async (req: Request, res: Response) => {
  const before = await prisma.property.findUnique({ where: { id: req.params.id } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Property not found' } });
    return;
  }
  await prisma.property.delete({ where: { id: req.params.id } });
  await logAudit({
    userId: req.user!.userId,
    action: 'property.delete',
    entityType: 'Property',
    entityId: req.params.id,
    beforeJson: before,
    ipAddress: req.ip,
  });
  res.status(204).send();
});
