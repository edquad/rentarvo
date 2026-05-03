import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { errorHandler } from './middleware/error.js';
import { prisma } from './lib/prisma.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { entitiesRouter } from './modules/entities/entities.routes.js';
import { propertiesRouter } from './modules/properties/properties.routes.js';
import { unitsRouter } from './modules/units/units.routes.js';
import { tenantsRouter } from './modules/tenants/tenants.routes.js';
import { leasesRouter } from './modules/leases/leases.routes.js';
import { contactsRouter } from './modules/contacts/contacts.routes.js';
import { incomeRouter } from './modules/income/income.routes.js';
import { expensesRouter } from './modules/expenses/expenses.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { documentsRouter } from './modules/documents/documents.routes.js';
import { periodLocksRouter } from './modules/period-locks/period-locks.routes.js';
import { lateFeesRouter } from './modules/late-fees/late-fees.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';

export const app = express();

// Global middleware
app.use(helmet());
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Validate common query params globally
const ENTITY_ID_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
app.use((req, res, next) => {
  // Validate entityId query param format (C3, M8, H1)
  const qEntityId = req.query.entityId as string | undefined;
  if (qEntityId && !ENTITY_ID_RE.test(qEntityId)) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid entityId format' } });
    return;
  }
  // Validate X-Entity-Id header format
  const hEntityId = req.headers['x-entity-id'] as string | undefined;
  if (hEntityId && !ENTITY_ID_RE.test(hEntityId)) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid X-Entity-Id header format' } });
    return;
  }
  // Entity ID mismatch detection (D)
  if (qEntityId && hEntityId && qEntityId !== hEntityId) {
    res.status(400).json({ error: { code: 'ENTITY_ID_MISMATCH', message: 'entityId query param and X-Entity-Id header must match' } });
    return;
  }
  // Validate page/limit (C4, M7)
  const page = req.query.page as string | undefined;
  const limit = req.query.limit as string | undefined;
  if (page !== undefined) {
    const p = parseInt(page);
    if (isNaN(p) || p < 1) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'page must be a positive integer' } });
      return;
    }
  }
  if (limit !== undefined) {
    const l = parseInt(limit);
    if (isNaN(l) || l < 1 || l > 200) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'limit must be between 1 and 200' } });
      return;
    }
  }
  // Validate date filter params (M5)
  for (const key of ['from', 'to', 'dateFrom', 'dateTo']) {
    const val = req.query[key] as string | undefined;
    if (val) {
      if (!ISO_DATE_RE.test(val) || isNaN(new Date(val).getTime())) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Invalid date format for '${key}'. Use YYYY-MM-DD.` } });
        return;
      }
    }
  }
  // Reject inverted date ranges
  const from = (req.query.from || req.query.dateFrom) as string | undefined;
  const to = (req.query.to || req.query.dateTo) as string | undefined;
  if (from && to && new Date(from) > new Date(to)) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'from/dateFrom must be before to/dateTo' } });
    return;
  }
  // Validate sortBy if present (R19-1): reject unknown fields
  const sortBy = req.query.sortBy as string | undefined;
  if (sortBy) {
    const ALLOWED_SORT_FIELDS = new Set([
      'name', 'fullName', 'label', 'createdAt', 'updatedAt',
      'paymentDate', 'expenseDate', 'amount', 'startDate', 'endDate',
      'status', 'contactType', 'propertyType', 'uploadedAt',
    ]);
    if (!ALLOWED_SORT_FIELDS.has(sortBy)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Invalid sortBy field: '${sortBy}'` } });
      return;
    }
  }
  next();
});

// Health check (with DB ping)
app.get('/api/v1/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(503).json({ status: 'degraded', db: 'disconnected', error: err.message, timestamp: new Date().toISOString() });
  }
});

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/entities', entitiesRouter);
app.use('/api/v1/properties', propertiesRouter);
app.use('/api/v1/units', unitsRouter);
app.use('/api/v1/tenants', tenantsRouter);
app.use('/api/v1/leases', leasesRouter);
app.use('/api/v1/contacts', contactsRouter);
app.use('/api/v1/income', incomeRouter);
app.use('/api/v1/expenses', expensesRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/audit-logs', auditRouter);
app.use('/api/v1/documents', documentsRouter);
app.use('/api/v1/period-locks', periodLocksRouter);
app.use('/api/v1/late-fees', lateFeesRouter);
app.use('/api/v1/reports', reportsRouter);

// Error handler
app.use(errorHandler);
