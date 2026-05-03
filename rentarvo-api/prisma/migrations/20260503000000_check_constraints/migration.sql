-- CHECK constraints for data integrity (Section H)

-- Income: amount must be positive
ALTER TABLE "income_transactions"
  ADD CONSTRAINT "chk_income_amount_positive"
  CHECK ("amount" > 0);

-- Expense: amount must be positive
ALTER TABLE "expense_transactions"
  ADD CONSTRAINT "chk_expense_amount_positive"
  CHECK ("amount" > 0);

-- Lease: monetary fields non-negative
ALTER TABLE "leases"
  ADD CONSTRAINT "chk_lease_monthly_rent_nonneg"
  CHECK ("monthly_rent" >= 0);

ALTER TABLE "leases"
  ADD CONSTRAINT "chk_lease_tenant_resp_nonneg"
  CHECK ("tenant_responsibility" >= 0);

ALTER TABLE "leases"
  ADD CONSTRAINT "chk_lease_security_deposit_nonneg"
  CHECK ("security_deposit" >= 0);

-- Lease: endDate >= startDate when endDate is set
ALTER TABLE "leases"
  ADD CONSTRAINT "chk_lease_end_after_start"
  CHECK ("end_date" IS NULL OR "end_date" >= "start_date");

-- Tenant: fullName must not be empty
ALTER TABLE "tenants"
  ADD CONSTRAINT "chk_tenant_fullname_notempty"
  CHECK (length(trim("full_name")) > 0);
