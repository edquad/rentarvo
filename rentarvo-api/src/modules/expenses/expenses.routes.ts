import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { logAudit } from '../../lib/audit.js';
import { requireEntityScope, getScopeEntityId } from '../../lib/entityScope.js';
import { PositiveMoneySchema, PaymentDateSchema, NotesSchema, optStr } from '../../lib/validators.js';

export const expensesRouter = Router();
expensesRouter.use(authenticate);
expensesRouter.use('/:id', requireEntityScope('expense', 'Expense transaction'));

const createExpenseSchema = z.object({
  propertyId: z.string().uuid(),
  unitId: optStr(z.string().uuid().optional()),
  contactId: optStr(z.string().uuid().optional()),
  categoryId: z.string().min(1, 'Category is required'),
  amount: PositiveMoneySchema,
  expenseDate: PaymentDateSchema,
  paymentMethod: optStr(z.enum(['CASH', 'CHECK', 'ACH', 'ZELLE', 'VENMO', 'CASHAPP', 'CARD', 'OTHER']).optional()),
  referenceNumber: z.string().max(100).optional(),
  notes: NotesSchema,
  source: z.enum(['MANUAL', 'CHATBOT', 'IMPORT']).default('MANUAL'),
});

// List
expensesRouter.get('/', async (req: Request, res: Response) => {
  const { propertyId, from, to, categoryId, contactId, page = '1', limit = '50' } = req.query;
  const entityId = getScopeEntityId(req);
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  let where: any = {};
  if (propertyId) where.propertyId = propertyId;
  if (entityId) where.property = { entityId };
  if (categoryId) where.categoryId = categoryId;
  if (contactId) where.contactId = contactId;
  if (from || to) {
    where.expenseDate = {};
    if (from) where.expenseDate.gte = new Date(from as string);
    if (to) where.expenseDate.lte = new Date(to as string);
  }

  const [transactions, total] = await Promise.all([
    prisma.expenseTransaction.findMany({
      where,
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, label: true } },
        contact: { select: { id: true, fullName: true, organization: true } },
        category: { select: { id: true, name: true, color: true } },
      },
      orderBy: { expenseDate: 'desc' },
      skip,
      take: parseInt(limit as string),
    }),
    prisma.expenseTransaction.count({ where }),
  ]);

  res.json({ data: transactions, total, page: parseInt(page as string), limit: parseInt(limit as string) });
});

// Get by ID
expensesRouter.get('/:id', async (req: Request, res: Response) => {
  const tx = await prisma.expenseTransaction.findUnique({
    where: { id: req.params.id },
    include: {
      property: true,
      unit: true,
      contact: true,
      category: true,
      documents: true,
    },
  });
  if (!tx) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Expense transaction not found' } });
    return;
  }
  res.json(tx);
});

// Create
expensesRouter.post('/', async (req: Request, res: Response) => {
  const data = createExpenseSchema.parse(req.body);

  // Verify property exists and get its entity
  const property = await prisma.property.findUnique({ where: { id: data.propertyId }, select: { entityId: true } });
  if (!property) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Property not found' } });
    return;
  }

  // Verify category exists (M4)
  const cat = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } });
  if (!cat) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Category not found' } });
    return;
  }

  // Entity scope check: if entityId header present, verify property belongs to that entity
  const scopeEntityId = req.headers['x-entity-id'] as string | undefined;
  if (scopeEntityId && property.entityId !== scopeEntityId) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Property does not belong to the selected entity' } });
    return;
  }

  // Period lock check
  const expDate = new Date(data.expenseDate);
  const lock = await prisma.periodLock.findUnique({
    where: {
      entityId_year_month: {
        entityId: property.entityId,
        year: expDate.getFullYear(),
        month: expDate.getMonth() + 1,
      },
    },
  });
  if (lock) {
    res.status(403).json({ error: { code: 'PERIOD_LOCKED', message: `Period ${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')} is locked` } });
    return;
  }

  // Idempotency-Key support (R19-3)
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  if (idempotencyKey) {
    const existing = await prisma.expenseTransaction.findFirst({
      where: { createdBy: req.user!.userId, idempotencyKey },
      include: { property: true, category: true, contact: true },
    });
    if (existing) {
      res.status(200).json(existing);
      return;
    }
  }

  // Advisory-locked dedupe + create (serializes concurrent identical transactions)
  const dedupeKey = `${data.propertyId}|${data.categoryId}|${data.amount}|${data.expenseDate}|${data.contactId || ''}`;

  try {
    const result = await prisma.$transaction(async (txc) => {
      await txc.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dedupeKey}))`;

      const dupeWindow = new Date(Date.now() - 60_000);
      const dupe = await txc.expenseTransaction.findFirst({
        where: {
          propertyId: data.propertyId,
          categoryId: data.categoryId,
          amount: data.amount,
          expenseDate: expDate,
          contactId: data.contactId || null,
          createdAt: { gte: dupeWindow },
        },
        select: { id: true },
      });
      if (dupe) return null;

      return txc.expenseTransaction.create({
        data: {
          ...data,
          expenseDate: new Date(data.expenseDate),
          createdBy: req.user!.userId,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        include: { property: true, category: true, contact: true },
      });
    });

    if (!result) {
      res.status(409).json({ error: { code: 'DUPLICATE_TRANSACTION', message: 'A matching transaction was just recorded. If intentional, wait 60 seconds and retry.' } });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'expense.create',
      entityType: 'ExpenseTransaction',
      entityId: result.id,
      afterJson: result,
      ipAddress: req.ip,
    });

    res.status(201).json(result);
  } catch (err: any) {
    // P2002 = unique constraint violation on idempotency_key (concurrent race)
    if (err.code === 'P2002' && idempotencyKey) {
      const existing = await prisma.expenseTransaction.findFirst({
        where: { createdBy: req.user!.userId, idempotencyKey },
        include: { property: true, category: true, contact: true },
      });
      if (existing) {
        res.status(200).json(existing);
        return;
      }
    }
    throw err;
  }
});

// Update
expensesRouter.put('/:id', async (req: Request, res: Response) => {
  const data = createExpenseSchema.partial().parse(req.body);
  const before = await prisma.expenseTransaction.findUnique({ where: { id: req.params.id }, include: { property: { select: { entityId: true } } } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Expense transaction not found' } });
    return;
  }

  // Period lock check on original date
  const origDate = new Date(before.expenseDate);
  const origLock = await prisma.periodLock.findUnique({
    where: { entityId_year_month: { entityId: (before as any).property.entityId, year: origDate.getFullYear(), month: origDate.getMonth() + 1 } },
  });
  if (origLock) {
    res.status(403).json({ error: { code: 'PERIOD_LOCKED', message: `Period ${origDate.getFullYear()}-${String(origDate.getMonth() + 1).padStart(2, '0')} is locked` } });
    return;
  }

  // If the date is being changed, also check the new date's period
  if (data.expenseDate) {
    const newDate = new Date(data.expenseDate);
    const newPropId = data.propertyId || before.propertyId;
    const newProp = await prisma.property.findUnique({ where: { id: newPropId }, select: { entityId: true } });
    if (newProp) {
      const newLock = await prisma.periodLock.findUnique({
        where: { entityId_year_month: { entityId: newProp.entityId, year: newDate.getFullYear(), month: newDate.getMonth() + 1 } },
      });
      if (newLock) {
        res.status(403).json({ error: { code: 'PERIOD_LOCKED', message: `Period ${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')} is locked` } });
        return;
      }
    }
  }

  const tx = await prisma.expenseTransaction.update({
    where: { id: req.params.id },
    data: {
      ...data,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
    },
  });
  await logAudit({
    userId: req.user!.userId,
    action: 'expense.update',
    entityType: 'ExpenseTransaction',
    entityId: tx.id,
    beforeJson: before,
    afterJson: tx,
    ipAddress: req.ip,
  });
  res.json(tx);
});

// Delete
expensesRouter.delete('/:id', async (req: Request, res: Response) => {
  const before = await prisma.expenseTransaction.findUnique({ where: { id: req.params.id }, include: { property: { select: { entityId: true } } } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Expense transaction not found' } });
    return;
  }

  // Period lock check
  const expDate = new Date(before.expenseDate);
  const lock = await prisma.periodLock.findUnique({
    where: { entityId_year_month: { entityId: (before as any).property.entityId, year: expDate.getFullYear(), month: expDate.getMonth() + 1 } },
  });
  if (lock) {
    res.status(403).json({ error: { code: 'PERIOD_LOCKED', message: `Period ${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')} is locked` } });
    return;
  }

  await prisma.expenseTransaction.delete({ where: { id: req.params.id } });
  await logAudit({
    userId: req.user!.userId,
    action: 'expense.delete',
    entityType: 'ExpenseTransaction',
    entityId: req.params.id,
    beforeJson: before,
    ipAddress: req.ip,
  });
  res.status(204).send();
});
