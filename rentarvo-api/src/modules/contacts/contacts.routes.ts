import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { logAudit } from '../../lib/audit.js';
import { NameSchema, PhoneSchema, NotesSchema, optStr, escapeLike } from '../../lib/validators.js';

export const contactsRouter = Router();
contactsRouter.use(authenticate);

const createContactSchema = z.object({
  fullName: NameSchema,
  organization: z.string().max(200).optional().transform((v) => v ? v.replace(/<[^>]*>/g, '').trim() : v),
  contactType: z.enum([
    'CASE_WORKER', 'CONTRACTOR', 'VENDOR', 'UTILITY', 'INSURANCE_AGENT',
    'ATTORNEY', 'ACCOUNTANT', 'MUNICIPAL', 'PROPERTY_MANAGER', 'OWNER_PARTNER',
    'EMERGENCY', 'OTHER',
  ]),
  roleTitle: z.string().max(200).optional(),
  phone: optStr(PhoneSchema.optional()),
  mobile: optStr(PhoneSchema.optional()),
  email: optStr(z.string().email().optional()),
  fax: z.string().optional(),
  extension: z.string().optional(),
  address: z.string().max(500).optional(),
  programType: optStr(z.enum(['WHA', 'JDA', 'CHD', 'NONE', 'OTHER']).nullable().optional()),
  portalUrl: optStr(z.string().url().optional()),
  portalUsername: z.string().optional(),
  portalNotes: NotesSchema,
  notes: NotesSchema,
  isActive: z.boolean().default(true),
});

// List
contactsRouter.get('/', async (req: Request, res: Response) => {
  const contactType = req.query.contactType as string | undefined;
  const propertyId = req.query.propertyId as string | undefined;
  const tenantId = req.query.tenantId as string | undefined;
  const leaseId = req.query.leaseId as string | undefined;
  const search = req.query.search as string | undefined;
  const programType = req.query.programType as string | undefined;

  let where: any = {};
  if (contactType) where.contactType = contactType;
  if (programType) where.programType = programType;
  if (search) {
    const safeSearch = escapeLike(search as string);
    where.OR = [
      { fullName: { contains: safeSearch, mode: 'insensitive' } },
      { organization: { contains: safeSearch, mode: 'insensitive' } },
    ];
  }
  if (propertyId) where.contactPropertyLinks = { some: { propertyId: propertyId as string } };
  if (tenantId) where.contactTenantLinks = { some: { tenantId: tenantId as string } };
  if (leaseId) where.contactLeaseLinks = { some: { leaseId: leaseId as string } };

  const contacts = await prisma.contact.findMany({
    where,
    include: {
      _count: { select: { contactPropertyLinks: true, contactTenantLinks: true, contactLeaseLinks: true } },
    },
    orderBy: { fullName: 'asc' },
  });
  res.json(contacts);
});

// Get by ID
contactsRouter.get('/:id', async (req: Request, res: Response) => {
  const contact = await prisma.contact.findUnique({
    where: { id: req.params.id },
    include: {
      contactPropertyLinks: { include: { property: { select: { id: true, name: true } } } },
      contactTenantLinks: { include: { tenant: { select: { id: true, fullName: true } } } },
      contactLeaseLinks: { include: { lease: { include: { unit: { include: { property: true } }, tenant: true } } } },
    },
  });
  if (!contact) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
    return;
  }
  res.json(contact);
});

// Create
contactsRouter.post('/', async (req: Request, res: Response) => {
  const data = createContactSchema.parse(req.body);
  const contact = await prisma.contact.create({ data });
  await logAudit({
    userId: req.user!.userId,
    action: 'contact.create',
    entityType: 'Contact',
    entityId: contact.id,
    afterJson: contact,
    ipAddress: req.ip,
  });
  res.status(201).json(contact);
});

// Update
contactsRouter.put('/:id', async (req: Request, res: Response) => {
  const data = createContactSchema.partial().parse(req.body);
  const before = await prisma.contact.findUnique({ where: { id: req.params.id } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
    return;
  }
  const contact = await prisma.contact.update({ where: { id: req.params.id }, data });
  await logAudit({
    userId: req.user!.userId,
    action: 'contact.update',
    entityType: 'Contact',
    entityId: contact.id,
    beforeJson: before,
    afterJson: contact,
    ipAddress: req.ip,
  });
  res.json(contact);
});

// Delete
contactsRouter.delete('/:id', async (req: Request, res: Response) => {
  const before = await prisma.contact.findUnique({ where: { id: req.params.id } });
  if (!before) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
    return;
  }
  await prisma.contact.delete({ where: { id: req.params.id } });
  await logAudit({
    userId: req.user!.userId,
    action: 'contact.delete',
    entityType: 'Contact',
    entityId: req.params.id,
    beforeJson: before,
    ipAddress: req.ip,
  });
  res.status(204).send();
});

// ─── Link endpoints ───

// Property links
contactsRouter.post('/:id/links/properties', async (req: Request, res: Response) => {
  const { propertyId, relationshipNote } = z.object({ propertyId: z.string().uuid(), relationshipNote: z.string().optional() }).parse(req.body);
  const link = await prisma.contactPropertyLink.create({
    data: { contactId: req.params.id, propertyId, relationshipNote },
  });
  res.status(201).json(link);
});

contactsRouter.delete('/:id/links/properties/:propertyId', async (req: Request, res: Response) => {
  await prisma.contactPropertyLink.deleteMany({
    where: { contactId: req.params.id, propertyId: req.params.propertyId },
  });
  res.status(204).send();
});

// Tenant links
contactsRouter.post('/:id/links/tenants', async (req: Request, res: Response) => {
  const { tenantId, relationshipNote } = z.object({ tenantId: z.string().uuid(), relationshipNote: z.string().optional() }).parse(req.body);
  const link = await prisma.contactTenantLink.create({
    data: { contactId: req.params.id, tenantId, relationshipNote },
  });
  res.status(201).json(link);
});

contactsRouter.delete('/:id/links/tenants/:tenantId', async (req: Request, res: Response) => {
  await prisma.contactTenantLink.deleteMany({
    where: { contactId: req.params.id, tenantId: req.params.tenantId },
  });
  res.status(204).send();
});

// Lease links
contactsRouter.post('/:id/links/leases', async (req: Request, res: Response) => {
  const { leaseId, relationshipNote } = z.object({ leaseId: z.string().uuid(), relationshipNote: z.string().optional() }).parse(req.body);
  const link = await prisma.contactLeaseLink.create({
    data: { contactId: req.params.id, leaseId, relationshipNote },
  });
  res.status(201).json(link);
});

contactsRouter.delete('/:id/links/leases/:leaseId', async (req: Request, res: Response) => {
  await prisma.contactLeaseLink.deleteMany({
    where: { contactId: req.params.id, leaseId: req.params.leaseId },
  });
  res.status(204).send();
});
