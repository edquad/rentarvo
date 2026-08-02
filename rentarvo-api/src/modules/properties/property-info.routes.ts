import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requireEntityScope } from '../../lib/entityScope.js';
import { sanitizeText } from '../../lib/validators.js';

export const propertyInfoRouter = Router({ mergeParams: true });
propertyInfoRouter.use(authenticate);
propertyInfoRouter.use(requireEntityScope('property', 'Property'));

const VALID_SECTIONS = ['KEYS', 'ACCESS', 'UTILITIES', 'VENDORS', 'NOTES', 'CUSTOM'] as const;

const createItemSchema = z.object({
  section: z.enum(VALID_SECTIONS),
  label: z.string().min(1).max(200).transform(sanitizeText),
  value: z.string().min(1).max(5000).transform(sanitizeText),
  sortOrder: z.number().int().min(0).optional(),
});

const updateItemSchema = createItemSchema.partial();

// List all info items for a property, grouped by section
propertyInfoRouter.get('/', async (req: Request, res: Response) => {
  const items = await prisma.propertyInfoItem.findMany({
    where: { propertyId: req.params.id },
    orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const grouped: Record<string, typeof items> = {};
  for (const s of VALID_SECTIONS) grouped[s] = [];
  for (const item of items) {
    if (!grouped[item.section]) grouped[item.section] = [];
    grouped[item.section].push(item);
  }

  res.json({ items, grouped });
});

// Create an info item
propertyInfoRouter.post('/', async (req: Request, res: Response) => {
  const data = createItemSchema.parse(req.body);

  const maxSort = await prisma.propertyInfoItem.aggregate({
    where: { propertyId: req.params.id, section: data.section },
    _max: { sortOrder: true },
  });

  const item = await prisma.propertyInfoItem.create({
    data: {
      propertyId: req.params.id,
      section: data.section,
      label: data.label,
      value: data.value,
      sortOrder: data.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  res.status(201).json(item);
});

// Update an info item
propertyInfoRouter.put('/:itemId', async (req: Request, res: Response) => {
  const data = updateItemSchema.parse(req.body);

  const existing = await prisma.propertyInfoItem.findFirst({
    where: { id: req.params.itemId, propertyId: req.params.id },
  });
  if (!existing) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Info item not found' } });
    return;
  }

  const updated = await prisma.propertyInfoItem.update({
    where: { id: req.params.itemId },
    data,
  });

  res.json(updated);
});

// Delete an info item
propertyInfoRouter.delete('/:itemId', async (req: Request, res: Response) => {
  const existing = await prisma.propertyInfoItem.findFirst({
    where: { id: req.params.itemId, propertyId: req.params.id },
  });
  if (!existing) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Info item not found' } });
    return;
  }

  await prisma.propertyInfoItem.delete({ where: { id: req.params.itemId } });
  res.status(204).send();
});
