import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { logAudit } from '../../lib/audit.js';
import { requireEntityScope, getScopeEntityId } from '../../lib/entityScope.js';
import { NameSchema, PhoneSchema, NotesSchema, optStr, escapeLike } from '../../lib/validators.js';

export const tenantsRouter = Router();
tenantsRouter.use(authenticate);
tenantsRouter.use('/:id', requireEntityScope('tenant', 'Tenant'));

const createTenantSchema = z.object({
  fullName: NameSchema,
  phone: optStr(PhoneSchema.optional()),
  email: optStr(z.string().email().optional()),
  emergencyContactName: z.string().max(200).transform((v) => v.replace(/<[^>]*>/g, '').trim()).optional(),
  emergencyContactPhone: optStr(PhoneSchema.optional()),
  idDocumentUrl: z.string().optional(),
  notes: NotesSchema,
  isActive: z.boolean().default(true),
});

// List
tenantsRouter.get('/', async (req: Request, res: Response) => {
  const { search, activeOnly, unassigned } = req.query;
  const entityId = getScopeEntityId(req);

  let where: any = {};
  if (search) {
    const safeSearch = escapeLike(search as string);
    where.OR = [
      { fullName: { contains: safeSearch, mode: 'insensitive' } },
      { phone: { contains: safeSearch, mode: 'insensitive' } },
      { email: { contains: safeSearch, mode: 'insensitive' } },
    ];
  }
  if (activeOnly === 'true') where.isActive = true;
  if (unassigned === 'true') {
    where.leases = { none: { status: 'ACTIVE' } };
  }
  if (entityId) {
    // Show tenants that belong to this entity directly OR via a lease
    const entityFilter = {
      OR: [
        { entityId },
        { leases: { some: { unit: { property: { entityId } } } } },
      ],
    };
    where = { AND: [where, entityFilter] };
  }

  const tenants = await prisma.tenant.findMany({
    where,
    include: {
      leases: {
        where: { status: 'ACTIVE' },
        include: { unit: { include: { property: { select: { id: true, name: true } } } } },
        take: 1,
      },
    },
    orderBy: { fullName: 'asc' },
  });
  res.json(tenants);
});

// Get by ID
tenantsRouter.get('/:id', async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.params.id },
    include: {
      leases: {
        include: { unit: { include: { property: true } } },
        orderBy: { startDate: 'desc' },
      },
      documents: true,
    },
  });
  if (!tenant) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    return;
  }
  res.json(tenant);
});

// Create
tenantsRouter.post('/', async (req: Request, res: Response) => {
  const data = createTenantSchema.parse(req.body);
  const entityId = getScopeEntityId(req) || undefined;
  const tenant = await prisma.tenant.create({ data: { ...data, entityId } });
  await logAudit({
    userId: req.user!.userId,
    action: 'tenant.create',
    entityType: 'Tenant',
    entityId: tenant.id,
    afterJson: tenant,
    ipAddress: req.ip,
  });
  res.status(201).json(tenant);
});

// Update
tenantsRouter.put('/:id', async (req: Request, res: Response) => {
  const data = createTenantSchema.partial().parse(req.body);
  const before = await prisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    return;
  }
  const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data });
  await logAudit({
    userId: req.user!.userId,
    action: 'tenant.update',
    entityType: 'Tenant',
    entityId: tenant.id,
    beforeJson: before,
    afterJson: tenant,
    ipAddress: req.ip,
  });
  res.json(tenant);
});

// Delete
tenantsRouter.delete('/:id', async (req: Request, res: Response) => {
  const before = await prisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    return;
  }
  await prisma.tenant.delete({ where: { id: req.params.id } });
  await logAudit({
    userId: req.user!.userId,
    action: 'tenant.delete',
    entityType: 'Tenant',
    entityId: req.params.id,
    beforeJson: before,
    ipAddress: req.ip,
  });
  res.status(204).send();
});
