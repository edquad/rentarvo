import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import { authenticate } from '../../middleware/auth.js';
import { logAudit } from '../../lib/audit.js';
import { getScopeEntityId, requireEntityScope } from '../../lib/entityScope.js';

export const documentsRouter = Router();
documentsRouter.use(authenticate);
documentsRouter.use('/:id', requireEntityScope('document', 'Document'));

const optStr = (schema: z.ZodTypeAny) => z.preprocess((v) => (v === '' ? undefined : v), schema);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

const uploadMetaSchema = z.object({
  category: z.enum([
    'LEASE', 'TENANT_ID', 'SECTION_8', 'INSPECTION', 'RECEIPT', 'INVOICE',
    'PROPERTY_PHOTO', 'INSURANCE', 'TAX', 'ANALYSIS', 'OTHER',
  ]),
  propertyId: optStr(z.string().uuid().optional()),
  unitId: optStr(z.string().uuid().optional()),
  tenantId: optStr(z.string().uuid().optional()),
  leaseId: optStr(z.string().uuid().optional()),
  contactId: optStr(z.string().uuid().optional()),
  incomeTransactionId: optStr(z.string().uuid().optional()),
  expenseTransactionId: optStr(z.string().uuid().optional()),
});

// Upload
documentsRouter.post('/', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'File is required' } });
    return;
  }

  const meta = uploadMetaSchema.parse(req.body);
  const storageKey = await storage.save(req.file.originalname, req.file.buffer);

  const entityId = getScopeEntityId(req) || undefined;
  const doc = await prisma.document.create({
    data: {
      ...meta,
      entityId,
      originalFilename: req.file.originalname,
      storageKey,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadedBy: req.user!.userId,
    },
  });

  await logAudit({
    userId: req.user!.userId,
    action: 'DOCUMENT_UPLOAD',
    entityType: 'Document',
    entityId: doc.id,
    afterJson: { filename: doc.originalFilename, category: doc.category },
    ipAddress: req.ip,
  });

  res.status(201).json(doc);
});

// List
documentsRouter.get('/', async (req: Request, res: Response) => {
  const { propertyId, tenantId, leaseId, category, limit = '50', page = '1' } = req.query;
  const entityId = getScopeEntityId(req);
  const where: any = {};
  if (entityId) where.entityId = entityId;
  if (propertyId) where.propertyId = propertyId;
  if (tenantId) where.tenantId = tenantId;
  if (leaseId) where.leaseId = leaseId;
  if (category) where.category = category;

  const take = Math.min(parseInt(limit as string, 10) || 50, 100);
  const skip = (Math.max(parseInt(page as string, 10) || 1, 1) - 1) * take;

  const [docs, total] = await Promise.all([
    prisma.document.findMany({ where, orderBy: { uploadedAt: 'desc' }, take, skip }),
    prisma.document.count({ where }),
  ]);

  res.json({ data: docs, total });
});

// Download
documentsRouter.get('/:id/download', async (req: Request, res: Response) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    return;
  }
  const buffer = await storage.read(doc.storageKey);
  res.setHeader('Content-Disposition', `attachment; filename="${doc.originalFilename}"`);
  res.setHeader('Content-Type', doc.mimeType);
  res.send(buffer);
});

// Delete
documentsRouter.delete('/:id', async (req: Request, res: Response) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    return;
  }
  await storage.delete(doc.storageKey);
  await prisma.document.delete({ where: { id: req.params.id } });

  await logAudit({
    userId: req.user!.userId,
    action: 'DOCUMENT_DELETE',
    entityType: 'Document',
    entityId: doc.id,
    beforeJson: { filename: doc.originalFilename },
    ipAddress: req.ip,
  });

  res.status(204).end();
});
