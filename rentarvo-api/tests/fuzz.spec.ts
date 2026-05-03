/**
 * Fuzz test matrix for Rentarvo API hardening (Section K).
 * Run with: npx tsx tests/fuzz.spec.ts
 */

const BASE = 'http://localhost:4000/api/v1';
let TOKEN = '';

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@rentarvo.local', password: 'Rentarvo!2026' }),
  });
  const data = await res.json() as any;
  TOKEN = data.token;
}

function headers(entityId = 'bridge-llc') {
  return {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'X-Entity-Id': entityId,
  };
}

interface TestCase {
  name: string;
  method: string;
  path: string;
  body?: any;
  extraHeaders?: Record<string, string>;
  expect: number | number[];
}

const FUZZ_CASES: TestCase[] = [
  // Money validation
  { name: 'Income: 3 decimal amount', method: 'POST', path: '/income', body: { propertyId: '00000000-0000-0000-0000-000000000001', categoryId: 'x', amount: '10.123', paymentDate: '2026-01-01' }, expect: 400 },
  { name: 'Income: negative amount', method: 'POST', path: '/income', body: { propertyId: '00000000-0000-0000-0000-000000000001', categoryId: 'x', amount: '-5', paymentDate: '2026-01-01' }, expect: 400 },
  { name: 'Income: zero amount', method: 'POST', path: '/income', body: { propertyId: '00000000-0000-0000-0000-000000000001', categoryId: 'x', amount: '0', paymentDate: '2026-01-01' }, expect: 400 },
  { name: 'Income: 100M amount', method: 'POST', path: '/income', body: { propertyId: '00000000-0000-0000-0000-000000000001', categoryId: 'x', amount: '100000000', paymentDate: '2026-01-01' }, expect: 400 },
  { name: 'Expense: string amount', method: 'POST', path: '/expenses', body: { propertyId: '00000000-0000-0000-0000-000000000001', categoryId: 'x', amount: 'abc', expenseDate: '2026-01-01' }, expect: 400 },
  { name: 'Lease: negative rent', method: 'POST', path: '/leases', body: { unitId: '00000000-0000-0000-0000-000000000001', tenantId: '00000000-0000-0000-0000-000000000001', monthlyRent: '-100', tenantResponsibility: '0', startDate: '2026-01-01' }, expect: 400 },

  // Name validation
  { name: 'Tenant: 1-char name', method: 'POST', path: '/tenants', body: { fullName: 'A' }, expect: 400 },
  { name: 'Tenant: HTML in name stripped', method: 'POST', path: '/tenants', body: { fullName: '<script>alert(1)</script>Valid Name' }, expect: [201, 400] },
  { name: 'Contact: empty name', method: 'POST', path: '/contacts', body: { fullName: '', contactType: 'VENDOR' }, expect: 400 },
  { name: 'Contact: 1-char name', method: 'POST', path: '/contacts', body: { fullName: 'A', contactType: 'VENDOR' }, expect: 400 },

  // Phone validation
  { name: 'Tenant: 6-digit phone', method: 'POST', path: '/tenants', body: { fullName: 'Test User', phone: '123456' }, expect: 400 },
  { name: 'Tenant: letters in phone', method: 'POST', path: '/tenants', body: { fullName: 'Test User', phone: 'abc-defg' }, expect: 400 },

  // Notes validation
  { name: 'Tenant: >2000 char notes', method: 'POST', path: '/tenants', body: { fullName: 'Test User', notes: 'x'.repeat(2001) }, expect: 400 },

  // Date validation
  { name: 'Income: invalid date', method: 'POST', path: '/income', body: { propertyId: '00000000-0000-0000-0000-000000000001', categoryId: 'x', amount: '100', paymentDate: 'not-a-date' }, expect: 400 },
  { name: 'Income: year 1999', method: 'POST', path: '/income', body: { propertyId: '00000000-0000-0000-0000-000000000001', categoryId: 'x', amount: '100', paymentDate: '1999-01-01' }, expect: 400 },
  { name: 'Lease: end < start', method: 'POST', path: '/leases', body: { unitId: '00000000-0000-0000-0000-000000000001', tenantId: '00000000-0000-0000-0000-000000000001', monthlyRent: '100', tenantResponsibility: '100', startDate: '2026-06-01', endDate: '2026-01-01' }, expect: 400 },

  // EntityId
  { name: 'EntityId mismatch', method: 'GET', path: '/properties?entityId=bridge-llc', extraHeaders: { 'X-Entity-Id': 'fati-realty-llc' }, expect: 400 },
  { name: 'Invalid entityId format', method: 'GET', path: '/properties', extraHeaders: { 'X-Entity-Id': '../etc/passwd' }, expect: 400 },

  // UUID param
  { name: 'Invalid UUID in path', method: 'GET', path: '/properties/not-a-uuid', expect: 400 },
  { name: 'SQL injection in UUID', method: 'GET', path: "/properties/'; DROP TABLE--", expect: 400 },

  // Pagination
  { name: 'page=0', method: 'GET', path: '/tenants?page=0', expect: 400 },
  { name: 'page=-1', method: 'GET', path: '/tenants?page=-1', expect: 400 },
  { name: 'limit=201', method: 'GET', path: '/tenants?limit=201', expect: 400 },
  { name: 'limit=0', method: 'GET', path: '/tenants?limit=0', expect: 400 },

  // Date range
  { name: 'Inverted date range', method: 'GET', path: '/income?from=2026-12-01&to=2026-01-01', expect: 400 },
  { name: 'Invalid date format', method: 'GET', path: '/income?from=not-a-date', expect: 400 },

  // Auth
  { name: 'No auth token', method: 'GET', path: '/tenants', extraHeaders: { 'Authorization': '' }, expect: 401 },

  // Malformed JSON
  { name: 'Malformed JSON body', method: 'POST', path: '/tenants', body: 'NOT_JSON', expect: 400 },

  // R19-1: sortBy whitelist
  { name: 'sortBy=password rejected', method: 'GET', path: '/tenants?sortBy=password', expect: 400 },
  { name: 'sortBy=__proto__ rejected', method: 'GET', path: '/tenants?sortBy=__proto__', expect: 400 },
  { name: 'sortBy=name accepted', method: 'GET', path: '/tenants?sortBy=name', expect: 200 },

  // R19-2: zero-day lease
  { name: 'Lease: endDate === startDate rejected', method: 'POST', path: '/leases', body: { unitId: '00000000-0000-0000-0000-000000000001', tenantId: '00000000-0000-0000-0000-000000000001', monthlyRent: '1000', tenantResponsibility: '1000', startDate: '2030-06-01', endDate: '2030-06-01' }, expect: 400 },
];

async function run() {
  await login();
  console.log(`Running ${FUZZ_CASES.length} fuzz tests...\n`);

  let pass = 0, fail = 0;
  for (const tc of FUZZ_CASES) {
    try {
      const h = { ...headers(), ...(tc.extraHeaders || {}) };
      if (tc.extraHeaders?.Authorization === '') delete (h as any).Authorization;

      const opts: RequestInit = { method: tc.method, headers: h };
      if (tc.body && tc.method !== 'GET') {
        opts.body = typeof tc.body === 'string' ? tc.body : JSON.stringify(tc.body);
      }

      const res = await fetch(`${BASE}${tc.path}`, opts);
      const expected = Array.isArray(tc.expect) ? tc.expect : [tc.expect];
      if (expected.includes(res.status)) {
        console.log(`  ✅ ${tc.name} → ${res.status}`);
        pass++;
      } else {
        console.log(`  ❌ ${tc.name} → ${res.status} (expected ${tc.expect})`);
        fail++;
      }
    } catch (err: any) {
      console.log(`  ❌ ${tc.name} → ERROR: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail > 0 ? 1 : 0);
}

run();
