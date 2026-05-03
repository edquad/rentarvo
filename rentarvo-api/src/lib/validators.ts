/**
 * Shared validation primitives for the Rentarvo API.
 * Every route schema MUST use these — no duplicate inline schemas.
 */
import { z } from 'zod';
import { sanitizeText } from './sanitize.js';

/** Preprocess empty strings to undefined for optional fields */
export const optStr = (schema: z.ZodTypeAny) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema);

/** EntityId: lowercase alphanumeric with hyphens, 3–64 chars */
export const EntityIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/, 'Invalid entityId');

/** UUID v4 string */
export const UuidSchema = z.string().uuid();

/** Money amount: string, ≤2 decimals, ≥0, <100 M */
export const MoneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Amount must have at most 2 decimal places')
  .refine((v) => parseFloat(v) >= 0, 'Amount must be non-negative')
  .refine(
    (v) => parseFloat(v) < 100_000_000,
    'Amount must be less than 100,000,000',
  );

/** Positive money: >0 */
export const PositiveMoneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Amount must have at most 2 decimal places')
  .refine((v) => parseFloat(v) > 0, 'Amount must be positive')
  .refine(
    (v) => parseFloat(v) < 100_000_000,
    'Amount must be less than 100,000,000',
  );

/** Payment / transaction date: valid date, year 2000‥currentYear+1 */
export const PaymentDateSchema = z
  .string()
  .refine((v) => !isNaN(new Date(v).getTime()), 'Invalid date')
  .refine((v) => {
    const y = new Date(v).getFullYear();
    return y >= 2000 && y <= new Date().getFullYear() + 1;
  }, 'Date year must be between 2000 and next year');

/** Lease start date: year 2000‥currentYear+5 */
export const LeaseStartDateSchema = z
  .string()
  .refine((v) => !isNaN(new Date(v).getTime()), 'Invalid start date')
  .refine((v) => {
    const y = new Date(v).getFullYear();
    return y >= 2000 && y <= new Date().getFullYear() + 5;
  }, 'Start date year out of range');

/** Lease end date: year 2000‥currentYear+10 */
export const LeaseEndDateSchema = z
  .string()
  .refine((v) => !isNaN(new Date(v).getTime()), 'Invalid end date')
  .refine((v) => {
    const y = new Date(v).getFullYear();
    return y >= 2000 && y <= new Date().getFullYear() + 10;
  }, 'End date year out of range');

/** Name field: trimmed, 2–200 chars, no bidi/null, HTML stripped */
export const NameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(200, 'Name must be 200 characters or fewer')
  .regex(
    /^[^\u202a-\u202e\u2066-\u2069\u0000]+$/,
    'Name contains invalid characters',
  )
  .transform(sanitizeText);

/** Phone: digits + formatting, 7–15 actual digits */
export const PhoneSchema = z
  .string()
  .max(30, 'Phone too long')
  .regex(/^[\d\s().+-]+$/, 'Invalid phone number format')
  .refine(
    (v) => v.replace(/[\s().+-]/g, '').length >= 7,
    'Phone must have at least 7 digits',
  )
  .refine(
    (v) => v.replace(/[\s().+-]/g, '').length <= 15,
    'Phone must have at most 15 digits',
  );

/** Notes: max 2000 chars, HTML/bidi/null stripped */
export const NotesSchema = z
  .string()
  .max(2000, 'Notes must be 2000 characters or fewer')
  .transform(sanitizeText)
  .optional();

/** Page number */
export const PageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(10000)
  .default(1);

/** Results per page */
export const LimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(200)
  .default(50);

// Re-export for routes that need sanitization on non-standard fields
export { sanitizeText, escapeLike } from './sanitize.js';
