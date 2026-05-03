import { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma.js';

/** Valid entityId pattern: lowercase alphanumeric with hyphens */
const ENTITY_ID_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

/**
 * Extract the entity scope from the request.
 * Uses X-Entity-Id header as the single source of truth (ignores query param).
 */
export function getScopeEntityId(req: Request): string | undefined {
  const headerVal = req.headers['x-entity-id'] as string | undefined;
  if (!headerVal) return undefined;
  // Reject invalid entityId formats (null bytes, injection payloads, etc.)
  if (!ENTITY_ID_RE.test(headerVal)) return undefined;
  return headerVal;
}

type EntityResolver = (id: string, entityId: string) => Promise<boolean>;

const resolvers: Record<string, EntityResolver> = {
  property: async (id, entityId) => {
    const r = await prisma.property.findFirst({ where: { id, entityId }, select: { id: true } });
    return !!r;
  },
  unit: async (id, entityId) => {
    const r = await prisma.unit.findFirst({ where: { id, property: { entityId } }, select: { id: true } });
    return !!r;
  },
  tenant: async (id, entityId) => {
    const r = await prisma.tenant.findFirst({
      where: {
        id,
        OR: [
          { entityId },
          { leases: { some: { unit: { property: { entityId } } } } },
        ],
      },
      select: { id: true },
    });
    return !!r;
  },
  lease: async (id, entityId) => {
    const r = await prisma.lease.findFirst({
      where: { id, unit: { property: { entityId } } },
      select: { id: true },
    });
    return !!r;
  },
  income: async (id, entityId) => {
    const r = await prisma.incomeTransaction.findFirst({
      where: { id, property: { entityId } },
      select: { id: true },
    });
    return !!r;
  },
  expense: async (id, entityId) => {
    const r = await prisma.expenseTransaction.findFirst({
      where: { id, property: { entityId } },
      select: { id: true },
    });
    return !!r;
  },
  document: async (id, entityId) => {
    const r = await prisma.document.findFirst({
      where: {
        id,
        OR: [
          { entityId },
          { property: { entityId } },
        ],
      },
      select: { id: true },
    });
    return !!r;
  },
};

/** Valid UUID v4 pattern */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware that enforces entity scope on /:id routes.
 * If the request has an entity scope (via query param or X-Entity-Id header),
 * verifies the resource belongs to that entity. Returns 404 if not.
 */
export function requireEntityScope(resourceType: keyof typeof resolvers, displayName = 'Resource') {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Validate :id is a proper UUID (D)
    if (req.params.id && !UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid resource ID format' } });
      return;
    }
    const scopeEntityId = getScopeEntityId(req);
    if (!scopeEntityId || !req.params.id) {
      return next();
    }
    const resolver = resolvers[resourceType];
    if (!resolver) {
      return next();
    }
    const belongs = await resolver(req.params.id, scopeEntityId);
    if (!belongs) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: `${displayName} not found` } });
      return;
    }
    next();
  };
}
