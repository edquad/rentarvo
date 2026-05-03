import { PrismaClient, UserRole, CategoryKind } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Rentarvo database...');

  // ─── User (OWNER) ───
  const passwordHash = await bcrypt.hash('Rentarvo!2026', 12);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@rentarvo.local' },
    update: {},
    create: {
      email: 'owner@rentarvo.local',
      passwordHash,
      name: 'Owner',
      role: UserRole.OWNER,
    },
  });
  console.log(`  ✓ User: ${owner.email}`);

  // ─── Entities (LLCs) ───
  const llcs = ['Fati Realty LLC', 'Kismet Realty LLC', 'NORS Realty LLC', 'Bridge LLC'];
  for (const name of llcs) {
    await prisma.entity.upsert({
      where: { id: name.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: { id: name.toLowerCase().replace(/\s+/g, '-'), name },
    });
  }
  console.log(`  ✓ Entities: ${llcs.join(', ')}`);

  // ─── Categories ───
  const incomeCategories = [
    { name: 'Rent — Program Payment', taxBucket: null, color: '#10B981' },
    { name: 'Rent — Tenant Responsibility', taxBucket: null, color: '#34D399' },
    { name: 'Pet Fee', taxBucket: null, color: '#6EE7B7' },
    { name: 'Garage', taxBucket: null, color: '#A7F3D0' },
    { name: 'Security Deposit', taxBucket: null, color: '#D1FAE5' },
    { name: 'Reimbursement', taxBucket: null, color: '#ECFDF5' },
    { name: 'Other Income', taxBucket: null, color: '#059669' },
  ];

  const expenseCategories = [
    { name: 'Mortgage', taxBucket: 'Mortgage Interest', color: '#EF4444' },
    { name: 'Property Tax', taxBucket: 'Taxes', color: '#F87171' },
    { name: 'Insurance', taxBucket: 'Insurance', color: '#FCA5A5' },
    { name: 'Water/Sewer', taxBucket: 'Utilities', color: '#3B82F6' },
    { name: 'Electric', taxBucket: 'Utilities', color: '#60A5FA' },
    { name: 'Gas', taxBucket: 'Utilities', color: '#93C5FD' },
    { name: 'Garbage', taxBucket: 'Utilities', color: '#BFDBFE' },
    { name: 'Wifi', taxBucket: 'Utilities', color: '#DBEAFE' },
    { name: 'Lawn/Snow', taxBucket: 'Cleaning and Maintenance', color: '#22C55E' },
    { name: 'Repairs', taxBucket: 'Repairs', color: '#F59E0B' },
    { name: 'Maintenance', taxBucket: 'Cleaning and Maintenance', color: '#FBBF24' },
    { name: 'CapEx', taxBucket: 'Other', color: '#FCD34D' },
    { name: 'Property Management', taxBucket: 'Management Fees', color: '#8B5CF6' },
    { name: 'Legal/Accounting', taxBucket: 'Legal and Other Professional Fees', color: '#A78BFA' },
    { name: 'Supplies', taxBucket: 'Supplies', color: '#C4B5FD' },
    { name: 'Vacancy', taxBucket: 'Other', color: '#6B7280' },
    { name: 'Other', taxBucket: 'Other', color: '#9CA3AF' },
  ];

  for (const cat of incomeCategories) {
    await prisma.category.upsert({
      where: { id: `income-${cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` },
      update: {},
      create: {
        id: `income-${cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: cat.name,
        kind: CategoryKind.INCOME,
        taxBucket: cat.taxBucket,
        color: cat.color,
        isSystem: true,
      },
    });
  }

  for (const cat of expenseCategories) {
    await prisma.category.upsert({
      where: { id: `expense-${cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` },
      update: {},
      create: {
        id: `expense-${cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: cat.name,
        kind: CategoryKind.EXPENSE,
        taxBucket: cat.taxBucket,
        color: cat.color,
        isSystem: true,
      },
    });
  }
  console.log(`  ✓ Categories: ${incomeCategories.length} income, ${expenseCategories.length} expense`);

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
