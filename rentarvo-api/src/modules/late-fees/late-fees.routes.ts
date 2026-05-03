import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { Decimal } from '@prisma/client/runtime/library';

export const lateFeesRouter = Router();
lateFeesRouter.use(authenticate);

const optStr = (schema: z.ZodTypeAny) => z.preprocess((v) => (v === '' ? undefined : v), schema);

const ruleSchema = z.object({
  entityId: z.string().min(1),
  gracePeriodDays: z.preprocess((v) => (typeof v === 'string' ? parseInt(v, 10) : v), z.number().int().min(0).max(30).default(5)),
  feeType: z.enum(['FLAT', 'PERCENT']).default('FLAT'),
  feeAmount: z.string().default('50'),
  maxFeeAmount: optStr(z.string().optional()),
  isActive: z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().default(true)),
});

// Get rule for an entity
lateFeesRouter.get('/:entityId', async (req: Request, res: Response) => {
  const rule = await prisma.lateFeeRule.findUnique({
    where: { entityId: req.params.entityId },
    include: { entity: { select: { id: true, name: true } } },
  });
  if (!rule) {
    res.json(null);
    return;
  }
  res.json(rule);
});

// Create or update rule
lateFeesRouter.put('/:entityId', async (req: Request, res: Response) => {
  const data = ruleSchema.parse({ ...req.body, entityId: req.params.entityId });

  const rule = await prisma.lateFeeRule.upsert({
    where: { entityId: data.entityId },
    create: data,
    update: {
      gracePeriodDays: data.gracePeriodDays,
      feeType: data.feeType,
      feeAmount: data.feeAmount,
      maxFeeAmount: data.maxFeeAmount,
      isActive: data.isActive,
    },
    include: { entity: { select: { id: true, name: true } } },
  });

  res.json(rule);
});

// Preview late fees for a given month (dry-run calculation)
lateFeesRouter.get('/:entityId/preview', async (req: Request, res: Response) => {
  const { year, month } = req.query;
  if (!year || !month) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'year and month are required' } });
    return;
  }

  const y = parseInt(year as string);
  const m = parseInt(month as string);

  const rule = await prisma.lateFeeRule.findUnique({
    where: { entityId: req.params.entityId },
  });

  if (!rule || !rule.isActive) {
    res.json({ fees: [], message: 'No active late fee rule' });
    return;
  }

  // Find all active leases for this entity's properties
  const leases = await prisma.lease.findMany({
    where: {
      status: 'ACTIVE',
      unit: {
        property: { entityId: req.params.entityId },
      },
    },
    include: {
      tenant: { select: { id: true, fullName: true } },
      unit: { select: { id: true, label: true, property: { select: { id: true, name: true } } } },
    },
  });

  // For each lease, check if rent was paid on time
  const startOfMonth = new Date(y, m - 1, 1);
  const endOfMonth = new Date(y, m, 0);
  const dueDateCutoff = new Date(y, m - 1, rule.gracePeriodDays + 1);

  const fees: any[] = [];

  for (const lease of leases) {
    // Sum payments in this month for this lease
    const payments = await prisma.incomeTransaction.aggregate({
      where: {
        leaseId: lease.id,
        paymentDate: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    });

    const totalPaid = Number(payments._sum.amount || 0);
    const rentDue = Number(lease.monthlyRent);

    if (totalPaid < rentDue) {
      // Check if first payment was after grace period
      const firstPayment = await prisma.incomeTransaction.findFirst({
        where: {
          leaseId: lease.id,
          paymentDate: { gte: startOfMonth, lte: endOfMonth },
        },
        orderBy: { paymentDate: 'asc' },
      });

      const isLate = !firstPayment || new Date(firstPayment.paymentDate) > dueDateCutoff;

      if (isLate) {
        let feeCalc: number;
        if (rule.feeType === 'PERCENT') {
          feeCalc = rentDue * (Number(rule.feeAmount) / 100);
        } else {
          feeCalc = Number(rule.feeAmount);
        }
        if (rule.maxFeeAmount) {
          feeCalc = Math.min(feeCalc, Number(rule.maxFeeAmount));
        }

        fees.push({
          leaseId: lease.id,
          tenantName: lease.tenant.fullName,
          propertyName: lease.unit.property.name,
          unitLabel: lease.unit.label,
          rentDue,
          totalPaid,
          shortfall: rentDue - totalPaid,
          lateFee: feeCalc,
          firstPaymentDate: firstPayment?.paymentDate || null,
        });
      }
    }
  }

  res.json({ fees, rule: { gracePeriodDays: rule.gracePeriodDays, feeType: rule.feeType, feeAmount: Number(rule.feeAmount) } });
});
