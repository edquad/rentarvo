import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { logAudit } from '../../lib/audit.js';
import { requireEntityScope, getScopeEntityId } from '../../lib/entityScope.js';
import { MoneySchema, LeaseStartDateSchema, LeaseEndDateSchema, NotesSchema, optStr } from '../../lib/validators.js';

export const leasesRouter = Router();
leasesRouter.use(authenticate);
leasesRouter.use('/:id', requireEntityScope('lease', 'Lease'));

const leaseBaseSchema = z.object({
  unitId: z.string().uuid(),
  tenantId: z.string().uuid(),
  startDate: LeaseStartDateSchema,
  endDate: optStr(LeaseEndDateSchema.optional()),
  monthlyRent: MoneySchema,
  tenantResponsibility: MoneySchema,
  programPayment: MoneySchema.default('0'),
  programType: optStr(z.enum(['WHA', 'JDA', 'CHD', 'NONE', 'OTHER']).default('NONE')),
  petFee: MoneySchema.default('0'),
  garageFee: MoneySchema.default('0'),
  securityDeposit: MoneySchema.default('0'),
  status: optStr(z.enum(['ACTIVE', 'ENDED', 'PENDING']).default('PENDING')),
  notes: NotesSchema,
});

const createLeaseSchema = leaseBaseSchema.refine(
  (data) => {
    if (!data.endDate) return true;
    return new Date(data.endDate) > new Date(data.startDate);
  },
  { message: 'End date must be after start date', path: ['endDate'] },
);

// List
leasesRouter.get('/', async (req: Request, res: Response) => {
  const { propertyId, unitId, tenantId, status } = req.query;
  const entityId = getScopeEntityId(req);
  const unitWhere: any = {};
  if (propertyId) unitWhere.propertyId = propertyId as string;
  if (entityId) unitWhere.property = { entityId };

  const leases = await prisma.lease.findMany({
    where: {
      ...(unitId ? { unitId: unitId as string } : {}),
      ...(tenantId ? { tenantId: tenantId as string } : {}),
      ...(status ? { status: status as any } : {}),
      ...(Object.keys(unitWhere).length > 0 ? { unit: unitWhere } : {}),
    },
    include: {
      unit: { include: { property: { select: { id: true, name: true } } } },
      tenant: { select: { id: true, fullName: true, phone: true } },
    },
    orderBy: { startDate: 'desc' },
  });
  res.json(leases);
});

// Get by ID
leasesRouter.get('/:id', async (req: Request, res: Response) => {
  const lease = await prisma.lease.findUnique({
    where: { id: req.params.id },
    include: {
      unit: { include: { property: true } },
      tenant: true,
      documents: true,
      contactLeaseLinks: { include: { contact: true } },
    },
  });
  if (!lease) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lease not found' } });
    return;
  }
  res.json(lease);
});

// Create
leasesRouter.post('/', async (req: Request, res: Response) => {
  const data = createLeaseSchema.parse(req.body);

  // Verify tenant exists (L3)
  const tenant = await prisma.tenant.findUnique({ where: { id: data.tenantId }, select: { id: true } });
  if (!tenant) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Tenant not found' } });
    return;
  }

  // Validate unit is rentable
  const unit = await prisma.unit.findUnique({ where: { id: data.unitId } });
  if (!unit) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unit not found' } });
    return;
  }
  if (!unit.isRentable) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Cannot attach a lease to a non-rentable unit' },
    });
    return;
  }

  // Check for overlapping active leases on the same unit
  const startDate = new Date(data.startDate);
  const endDate = data.endDate ? new Date(data.endDate) : null;
  const overlapWhere: any = {
    unitId: data.unitId,
    status: { in: ['ACTIVE', 'PENDING'] },
    startDate: endDate ? { lt: endDate } : undefined,
  };
  // If no endDate, any lease starting before this one ends (or ongoing) overlaps
  if (!endDate) {
    // Overlaps if existing lease has no end date or ends after new start
    overlapWhere.OR = [
      { endDate: null },
      { endDate: { gt: startDate } },
    ];
  } else {
    overlapWhere.OR = [
      { endDate: null, startDate: { lt: endDate } },
      { endDate: { gt: startDate }, startDate: { lt: endDate } },
    ];
  }
  delete overlapWhere.startDate; // handled inside OR
  const overlap = await prisma.lease.findFirst({ where: overlapWhere, select: { id: true, tenant: { select: { fullName: true } }, startDate: true, endDate: true } });
  if (overlap) {
    res.status(400).json({
      error: { code: 'LEASE_OVERLAP', message: `This unit already has an overlapping lease (${overlap.tenant?.fullName || 'unknown tenant'})` },
    });
    return;
  }

  const lease = await prisma.lease.create({
    data: {
      ...data,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
    include: { unit: { include: { property: true } }, tenant: true },
  });

  await logAudit({
    userId: req.user!.userId,
    action: 'lease.create',
    entityType: 'Lease',
    entityId: lease.id,
    afterJson: lease,
    ipAddress: req.ip,
  });

  res.status(201).json(lease);
});

// Update
leasesRouter.put('/:id', async (req: Request, res: Response) => {
  const data = leaseBaseSchema.partial().parse(req.body);
  const before = await prisma.lease.findUnique({ where: { id: req.params.id } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lease not found' } });
    return;
  }
  const lease = await prisma.lease.update({
    where: { id: req.params.id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
    include: { unit: { include: { property: true } }, tenant: true },
  });
  await logAudit({
    userId: req.user!.userId,
    action: 'lease.update',
    entityType: 'Lease',
    entityId: lease.id,
    beforeJson: before,
    afterJson: lease,
    ipAddress: req.ip,
  });
  res.json(lease);
});

// Delete
leasesRouter.delete('/:id', async (req: Request, res: Response) => {
  const before = await prisma.lease.findUnique({ where: { id: req.params.id } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lease not found' } });
    return;
  }
  await prisma.lease.delete({ where: { id: req.params.id } });
  await logAudit({
    userId: req.user!.userId,
    action: 'lease.delete',
    entityType: 'Lease',
    entityId: req.params.id,
    beforeJson: before,
    ipAddress: req.ip,
  });
  res.status(204).send();
});
