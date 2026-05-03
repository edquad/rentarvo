import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { getScopeEntityId } from '../../lib/entityScope.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

function toNum(val: unknown): number {
  return val != null ? Number(val) : 0;
}

// Summary
dashboardRouter.get('/summary', async (req: Request, res: Response) => {
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const entityId = getScopeEntityId(req);
  const [year, mon] = month.split('-').map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 0); // last day of month

  const propertyWhere: any = {};
  if (entityId) propertyWhere.entityId = entityId;

  // Get all properties
  const properties = await prisma.property.findMany({
    where: propertyWhere,
    include: {
      units: { where: { isRentable: true, isActive: true } },
    },
  });

  const propertyIds = properties.map((p) => p.id);

  // Active leases for expected income
  const activeLeases = await prisma.lease.findMany({
    where: {
      status: 'ACTIVE',
      ...(entityId ? { unit: { propertyId: { in: propertyIds } } } : {}),
    },
    include: { unit: { select: { propertyId: true } } },
  });

  // Actual income and expenses for the month
  const txnPropertyFilter = entityId ? { propertyId: { in: propertyIds } } : {};

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.incomeTransaction.groupBy({
      by: ['propertyId'],
      where: { paymentDate: { gte: startDate, lte: endDate }, ...txnPropertyFilter },
      _sum: { amount: true },
    }),
    prisma.expenseTransaction.groupBy({
      by: ['propertyId'],
      where: { expenseDate: { gte: startDate, lte: endDate }, ...txnPropertyFilter },
      _sum: { amount: true },
    }),
  ]);

  const incomeByProperty = new Map(incomeAgg.map((r) => [r.propertyId, toNum(r._sum.amount)]));
  const expenseByProperty = new Map(expenseAgg.map((r) => [r.propertyId, toNum(r._sum.amount)]));

  // Calculate expected income per property from active leases
  const expectedByProperty = new Map<string, number>();
  for (const lease of activeLeases) {
    const propId = lease.unit.propertyId;
    const current = expectedByProperty.get(propId) || 0;
    expectedByProperty.set(propId, current + toNum(lease.monthlyRent));
  }

  // Occupancy
  const totalRentableUnits = properties.reduce((sum: number, p) => sum + p.units.length, 0);
  const occupiedUnits = new Set(activeLeases.map((l) => l.unitId)).size;

  // Build by-property breakdown
  const byProperty = properties.map((p) => {
    const expected = expectedByProperty.get(p.id) || 0;
    const actual = incomeByProperty.get(p.id) || 0;
    const expenses = expenseByProperty.get(p.id) || 0;
    const rentableCount = p.units.length;
    const occupiedCount = activeLeases.filter((l) => l.unit.propertyId === p.id).length;

    return {
      propertyId: p.id,
      name: p.name,
      expectedIncome: expected.toFixed(2),
      actualIncome: actual.toFixed(2),
      expenses: expenses.toFixed(2),
      net: (actual - expenses).toFixed(2),
      occupancyRate: rentableCount > 0 ? Math.min(occupiedCount / rentableCount, 1) : 0,
    };
  });

  const totalExpected = [...expectedByProperty.values()].reduce((a: number, b: number) => a + b, 0);
  const totalActual = [...incomeByProperty.values()].reduce((a: number, b: number) => a + b, 0);
  const totalExpenses = [...expenseByProperty.values()].reduce((a: number, b: number) => a + b, 0);

  // Portfolio snapshot
  const totalValue = properties.reduce(
    (sum: number, p) => sum + toNum(p.currentValue),
    0,
  );
  const totalDebt = properties.reduce(
    (sum: number, p) => sum + toNum(p.mortgageBalance),
    0,
  );

  res.json({
    month,
    totals: {
      expectedIncome: totalExpected.toFixed(2),
      actualIncome: totalActual.toFixed(2),
      incomeDifference: (totalActual - totalExpected).toFixed(2),
      expectedExpenses: totalExpenses.toFixed(2),
      actualExpenses: totalExpenses.toFixed(2),
      netCashFlow: (totalActual - totalExpenses).toFixed(2),
    },
    occupancy: {
      totalUnits: totalRentableUnits,
      occupiedUnits,
      rate: totalRentableUnits > 0 ? Math.min(occupiedUnits / totalRentableUnits, 1) : 0,
    },
    portfolio: {
      totalValue: totalValue.toFixed(2),
      totalDebt: totalDebt.toFixed(2),
      totalEquity: (totalValue - totalDebt).toFixed(2),
    },
    byProperty,
  });
});

// Cash flow time series
dashboardRouter.get('/cashflow', async (req: Request, res: Response) => {
  const from = req.query.from as string;
  const to = req.query.to as string;

  if (!from || !to) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'from and to query params required (YYYY-MM)' } });
    return;
  }

  const startDate = new Date(`${from}-01`);
  const endDate = new Date(`${to}-28`);
  endDate.setMonth(endDate.getMonth() + 1);

  const [income, expenses] = await Promise.all([
    prisma.incomeTransaction.findMany({
      where: { paymentDate: { gte: startDate, lt: endDate } },
      select: { amount: true, paymentDate: true },
    }),
    prisma.expenseTransaction.findMany({
      where: { expenseDate: { gte: startDate, lt: endDate } },
      select: { amount: true, expenseDate: true },
    }),
  ]);

  // Group by month
  const months = new Map<string, { income: number; expenses: number }>();
  for (const tx of income) {
    const key = tx.paymentDate.toISOString().slice(0, 7);
    const entry = months.get(key) || { income: 0, expenses: 0 };
    entry.income += Number(tx.amount);
    months.set(key, entry);
  }
  for (const tx of expenses) {
    const key = tx.expenseDate.toISOString().slice(0, 7);
    const entry = months.get(key) || { income: 0, expenses: 0 };
    entry.expenses += Number(tx.amount);
    months.set(key, entry);
  }

  const series = [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      income: data.income.toFixed(2),
      expenses: data.expenses.toFixed(2),
      net: (data.income - data.expenses).toFixed(2),
    }));

  res.json(series);
});

// Category breakdown
dashboardRouter.get('/category-breakdown', async (req: Request, res: Response) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const kind = (req.query.kind as string) || 'EXPENSE';

  const startDate = from ? new Date(`${from}-01`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endDate = to ? new Date(`${to}-28`) : new Date();

  if (kind === 'EXPENSE') {
    const breakdown = await prisma.expenseTransaction.groupBy({
      by: ['categoryId'],
      where: { expenseDate: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    });
    const categories = await prisma.category.findMany({
      where: { id: { in: breakdown.map((b) => b.categoryId) } },
    });
    const catMap = new Map(categories.map((c) => [c.id, c]));

    res.json(
      breakdown.map((b) => ({
        categoryId: b.categoryId,
        categoryName: catMap.get(b.categoryId)?.name || 'Unknown',
        color: catMap.get(b.categoryId)?.color,
        total: (b._sum.amount || 0).toString(),
      })),
    );
  } else {
    const breakdown = await prisma.incomeTransaction.groupBy({
      by: ['categoryId'],
      where: { paymentDate: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    });
    const categories = await prisma.category.findMany({
      where: { id: { in: breakdown.map((b) => b.categoryId) } },
    });
    const catMap = new Map(categories.map((c) => [c.id, c]));

    res.json(
      breakdown.map((b) => ({
        categoryId: b.categoryId,
        categoryName: catMap.get(b.categoryId)?.name || 'Unknown',
        color: catMap.get(b.categoryId)?.color,
        total: (b._sum.amount || 0).toString(),
      })),
    );
  }
});

// Tenant balances — shows expected vs paid for the current month
dashboardRouter.get('/tenant-balances', async (req: Request, res: Response) => {
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const entityId = getScopeEntityId(req);
  const [year, mon] = month.split('-').map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 0);

  const activeLeases = await prisma.lease.findMany({
    where: {
      status: 'ACTIVE',
      ...(entityId ? { unit: { property: { entityId } } } : {}),
    },
    include: {
      tenant: { select: { id: true, fullName: true } },
      unit: { select: { id: true, label: true, property: { select: { id: true, name: true } } } },
    },
  });

  const tenantPayments = await prisma.incomeTransaction.groupBy({
    by: ['tenantId'],
    where: {
      tenantId: { in: activeLeases.map((l) => l.tenantId) },
      paymentDate: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
  });
  const paidMap = new Map(tenantPayments.map((p) => [p.tenantId, toNum(p._sum.amount)]));

  const balances = activeLeases.map((lease) => {
    const expected = toNum(lease.monthlyRent);
    const paid = paidMap.get(lease.tenantId) || 0;
    return {
      tenantId: lease.tenant.id,
      tenantName: lease.tenant.fullName,
      propertyName: lease.unit.property.name,
      unitLabel: lease.unit.label,
      expected: expected.toFixed(2),
      paid: paid.toFixed(2),
      balance: (expected - paid).toFixed(2),
      status: paid >= expected ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID',
    };
  });

  res.json(balances);
});
