import { z } from 'zod';

// ─── Enums ───
export const UserRole = z.enum(['OWNER', 'MANAGER', 'VIEWER']);
export const PropertyType = z.enum(['MULTI_FAMILY', 'SINGLE_FAMILY', 'ROOM_RENTAL', 'BED_RENTAL', 'COMMERCIAL', 'OTHER']);
export const UnitType = z.enum(['FLOOR', 'APARTMENT', 'ROOM', 'BED', 'OTHER']);
export const LeaseStatus = z.enum(['ACTIVE', 'ENDED', 'PENDING']);
export const ProgramType = z.enum(['WHA', 'JDA', 'CHD', 'NONE', 'OTHER']);
export const ContactType = z.enum([
  'CASE_WORKER', 'CONTRACTOR', 'VENDOR', 'UTILITY', 'INSURANCE_AGENT',
  'ATTORNEY', 'ACCOUNTANT', 'MUNICIPAL', 'PROPERTY_MANAGER', 'OWNER_PARTNER',
  'EMERGENCY', 'OTHER',
]);
export const PaymentMethod = z.enum(['CASH', 'CHECK', 'ACH', 'ZELLE', 'VENMO', 'CASHAPP', 'CARD', 'OTHER']);
export const CategoryKind = z.enum(['INCOME', 'EXPENSE']);
export const DocumentCategory = z.enum([
  'LEASE', 'TENANT_ID', 'SECTION_8', 'INSPECTION', 'RECEIPT', 'INVOICE',
  'PROPERTY_PHOTO', 'INSURANCE', 'TAX', 'ANALYSIS', 'OTHER',
]);

// ─── Money helper ───
export const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid monetary amount');

// ─── Schemas ───
export const createPropertySchema = z.object({
  entityId: z.string().min(1).optional(),
  entity: z.object({ name: z.string().min(1), ein: z.string().optional(), address: z.string().optional() }).optional(),
  name: z.string().min(1),
  addressLine1: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  propertyType: PropertyType,
  purchasePrice: moneyString.optional(),
  purchaseDate: z.string().optional(),
  rehabCost: moneyString.optional(),
  currentValue: moneyString.optional(),
  mortgageBalance: moneyString.optional(),
  monthlyMortgage: moneyString.default('0'),
  monthlyTax: moneyString.default('0'),
  monthlyInsurance: moneyString.default('0'),
  monthlyHoa: moneyString.optional(),
  notes: z.string().optional(),
  coverPhotoUrl: z.string().optional(),
});

export const createTenantSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const createLeaseSchema = z.object({
  unitId: z.string().uuid(),
  tenantId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string().optional(),
  monthlyRent: moneyString,
  tenantResponsibility: moneyString,
  programPayment: moneyString.default('0'),
  programType: ProgramType.default('NONE'),
  petFee: moneyString.default('0'),
  garageFee: moneyString.default('0'),
  securityDeposit: moneyString.default('0'),
  status: LeaseStatus.default('PENDING'),
  notes: z.string().optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
