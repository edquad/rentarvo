-- R19-3: Idempotency-Key atomic enforcement
-- Add idempotency_key column and unique index for income + expense transactions

ALTER TABLE "income_transactions"
  ADD COLUMN "idempotency_key" TEXT;

ALTER TABLE "expense_transactions"
  ADD COLUMN "idempotency_key" TEXT;

-- Unique constraint: (created_by, idempotency_key) ensures only one row per key per user
-- NULL keys are not constrained (allows multiple rows without a key)
CREATE UNIQUE INDEX "uq_income_idempotency"
  ON "income_transactions" ("created_by", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

CREATE UNIQUE INDEX "uq_expense_idempotency"
  ON "expense_transactions" ("created_by", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
