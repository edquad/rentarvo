-- R19-2: Zero-day lease fix — endDate must be strictly after startDate
ALTER TABLE "leases" DROP CONSTRAINT IF EXISTS "chk_lease_end_after_start";
ALTER TABLE "leases"
  ADD CONSTRAINT "chk_lease_end_after_start"
  CHECK ("end_date" IS NULL OR "end_date" > "start_date");
