import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { getScopeEntityId } from '../../lib/entityScope.js';

export const reportsRouter = Router();
reportsRouter.use(authenticate);

// Schedule E Export — summary by property for a tax year
reportsRouter.get('/schedule-e', async (req: Request, res: Response) => {
  const { year } = req.query;
  const entityId = getScopeEntityId(req);
  if (!year) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'year is required' } });
    return;
  }

  const y = parseInt(year as string);
  const cy = new Date().getFullYear();
  if (isNaN(y) || y < 2000 || y > cy + 1) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `year must be between 2000 and ${cy + 1}` } });
    return;
  }
  const startDate = new Date(y, 0, 1);
  const endDate = new Date(y, 11, 31);

  const propertyWhere: any = {};
  if (entityId) propertyWhere.entityId = entityId;

  const properties = await prisma.property.findMany({
    where: propertyWhere,
    select: {
      id: true,
      name: true,
      addressLine1: true,
      city: true,
      state: true,
      zip: true,
      propertyType: true,
    },
    orderBy: { name: 'asc' },
  });

  const result: any[] = [];

  for (const property of properties) {
    // Get income by tax bucket
    const incomeRows = await prisma.incomeTransaction.findMany({
      where: {
        propertyId: property.id,
        paymentDate: { gte: startDate, lte: endDate },
      },
      include: {
        category: { select: { name: true, taxBucket: true } },
      },
    });

    const incomeByBucket: Record<string, number> = {};
    let totalIncome = 0;
    for (const row of incomeRows) {
      const bucket = row.category.taxBucket || row.category.name;
      incomeByBucket[bucket] = (incomeByBucket[bucket] || 0) + Number(row.amount);
      totalIncome += Number(row.amount);
    }

    // Get expenses by tax bucket
    const expenseRows = await prisma.expenseTransaction.findMany({
      where: {
        propertyId: property.id,
        expenseDate: { gte: startDate, lte: endDate },
      },
      include: {
        category: { select: { name: true, taxBucket: true } },
      },
    });

    const expenseByBucket: Record<string, number> = {};
    let totalExpenses = 0;
    for (const row of expenseRows) {
      const bucket = row.category.taxBucket || row.category.name;
      expenseByBucket[bucket] = (expenseByBucket[bucket] || 0) + Number(row.amount);
      totalExpenses += Number(row.amount);
    }

    result.push({
      property: {
        id: property.id,
        name: property.name,
        address: `${property.addressLine1}, ${property.city}, ${property.state} ${property.zip}`,
        type: property.propertyType,
      },
      income: {
        byBucket: incomeByBucket,
        total: totalIncome,
      },
      expenses: {
        byBucket: expenseByBucket,
        total: totalExpenses,
      },
      netIncome: totalIncome - totalExpenses,
    });
  }

  const grandTotals = {
    totalIncome: result.reduce((s, r) => s + r.income.total, 0),
    totalExpenses: result.reduce((s, r) => s + r.expenses.total, 0),
    netIncome: result.reduce((s, r) => s + r.netIncome, 0),
  };

  res.json({ year: y, properties: result, grandTotals });
});

// CSV export of Schedule E
reportsRouter.get('/schedule-e/csv', async (req: Request, res: Response) => {
  const { year } = req.query;
  const entityId = getScopeEntityId(req);
  if (!year) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'year is required' } });
    return;
  }

  const y = parseInt(year as string);
  const cy = new Date().getFullYear();
  if (isNaN(y) || y < 2000 || y > cy + 1) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `year must be between 2000 and ${cy + 1}` } });
    return;
  }
  const startDate = new Date(y, 0, 1);
  const endDate = new Date(y, 11, 31);

  const propertyWhere: any = {};
  if (entityId) propertyWhere.entityId = entityId;

  const properties = await prisma.property.findMany({
    where: propertyWhere,
    orderBy: { name: 'asc' },
  });

  const rows: string[] = [];
  rows.push('Property,Address,Type,Category,Amount Type,Tax Bucket,Amount');

  for (const property of properties) {
    const incomeRows = await prisma.incomeTransaction.findMany({
      where: { propertyId: property.id, paymentDate: { gte: startDate, lte: endDate } },
      include: { category: { select: { name: true, taxBucket: true } } },
    });
    for (const row of incomeRows) {
      const bucket = row.category.taxBucket || row.category.name;
      rows.push(`"${property.name}","${property.addressLine1}, ${property.city}, ${property.state} ${property.zip}","${property.propertyType}","${row.category.name}","Income","${bucket}",${Number(row.amount).toFixed(2)}`);
    }

    const expenseRows = await prisma.expenseTransaction.findMany({
      where: { propertyId: property.id, expenseDate: { gte: startDate, lte: endDate } },
      include: { category: { select: { name: true, taxBucket: true } } },
    });
    for (const row of expenseRows) {
      const bucket = row.category.taxBucket || row.category.name;
      rows.push(`"${property.name}","${property.addressLine1}, ${property.city}, ${property.state} ${property.zip}","${property.propertyType}","${row.category.name}","Expense","${bucket}",${Number(row.amount).toFixed(2)}`);
    }
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="schedule-e-${y}.csv"`);
  res.send(rows.join('\n'));
});
