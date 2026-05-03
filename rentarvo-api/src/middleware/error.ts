import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
import pino from 'pino';

const logger = pino({ name: 'rentarvo-api' });

/**
 * Redact file paths and stack traces from error messages to prevent info disclosure.
 */
function redactMessage(msg: string): string {
  // Strip absolute file paths (Unix + Windows)
  let safe = msg.replace(/\/[^\s:]+\.[jt]sx?:\d+:\d+/g, '[redacted]');
  safe = safe.replace(/[A-Z]:\\[^\s:]+\.[jt]sx?:\d+:\d+/gi, '[redacted]');
  // Strip "at ..." stack frames
  safe = safe.replace(/\n\s+at\s.+/g, '');
  return safe;
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Already sent headers — bail
  if (res.headersSent) {
    return;
  }

  // Malformed JSON body (SyntaxError from body-parser)
  if (err instanceof SyntaxError && 'body' in err && (err as any).type === 'entity.parse.failed') {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Malformed JSON in request body' },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors,
      },
    });
    return;
  }

  // Prisma known request errors (constraint violations, not found, etc.)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn({ code: err.code, path: req.path, method: req.method }, 'Prisma known error');
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found' } });
      return;
    }
    if (err.code === 'P2002') {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with that value already exists' } });
      return;
    }
    res.status(400).json({ error: { code: 'DATABASE_ERROR', message: 'Invalid request' } });
    return;
  }

  // Prisma validation errors (bad UUID, wrong type, etc.)
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.warn({ path: req.path, method: req.method }, 'Prisma validation error');
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data format' } });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  Sentry.captureException(err);

  // Never expose stack traces or file paths to the client
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? redactMessage(err.message) : 'Internal server error',
    },
  });
}
