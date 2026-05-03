-- ===========================================================================
-- Rentarvo — Full Database Build Script
-- Generated: 2026-05-02
-- Combines all 5 migrations into a single idempotent DDL script.
-- Run against a fresh PostgreSQL database:
--   psql -h localhost -U rentarvo -d rentarvo -f create_tables.sql
-- ===========================================================================

BEGIN;

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('OWNER', 'MANAGER', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PropertyType" AS ENUM ('MULTI_FAMILY', 'SINGLE_FAMILY', 'ROOM_RENTAL', 'BED_RENTAL', 'COMMERCIAL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "UnitType" AS ENUM ('FLOOR', 'APARTMENT', 'ROOM', 'BED', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeaseStatus" AS ENUM ('ACTIVE', 'ENDED', 'PENDING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProgramType" AS ENUM ('WHA', 'JDA', 'CHD', 'NONE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContactType" AS ENUM ('CASE_WORKER', 'CONTRACTOR', 'VENDOR', 'UTILITY', 'INSURANCE_AGENT', 'ATTORNEY', 'ACCOUNTANT', 'MUNICIPAL', 'PROPERTY_MANAGER', 'OWNER_PARTNER', 'EMERGENCY', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHECK', 'ACH', 'ZELLE', 'VENMO', 'CASHAPP', 'CARD', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'CHATBOT', 'IMPORT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentCategory" AS ENUM ('LEASE', 'TENANT_ID', 'SECTION_8', 'INSPECTION', 'RECEIPT', 'INVOICE', 'PROPERTY_PHOTO', 'INSURANCE', 'TAX', 'ANALYSIS', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ChatbotEntryStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- 1. Users
CREATE TABLE IF NOT EXISTS "users" (
    "id"            TEXT NOT NULL,
    "email"         TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "role"          "UserRole" NOT NULL DEFAULT 'VIEWER',
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- 2. Entities (LLCs / ownership groups)
CREATE TABLE IF NOT EXISTS "entities" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "ein"        TEXT,
    "address"    TEXT,
    "notes"      TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- 3. Properties
CREATE TABLE IF NOT EXISTS "properties" (
    "id"                TEXT NOT NULL,
    "entity_id"         TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "address_line1"     TEXT NOT NULL,
    "city"              TEXT NOT NULL,
    "state"             TEXT NOT NULL,
    "zip"               TEXT NOT NULL,
    "property_type"     "PropertyType" NOT NULL,
    "purchase_price"    DECIMAL(12,2),
    "purchase_date"     DATE,
    "rehab_cost"        DECIMAL(12,2),
    "current_value"     DECIMAL(12,2),
    "mortgage_balance"  DECIMAL(12,2),
    "monthly_mortgage"  DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthly_tax"       DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthly_insurance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthly_hoa"       DECIMAL(12,2),
    "notes"             TEXT,
    "cover_photo_url"   TEXT,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "properties_entity_id_fkey"
        FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "properties_entity_id_idx" ON "properties"("entity_id");

-- 4. Units
CREATE TABLE IF NOT EXISTS "units" (
    "id"             TEXT NOT NULL,
    "property_id"    TEXT NOT NULL,
    "parent_unit_id" TEXT,
    "label"          TEXT NOT NULL,
    "unit_type"      "UnitType" NOT NULL,
    "is_rentable"    BOOLEAN NOT NULL DEFAULT false,
    "bedrooms"       INTEGER,
    "bathrooms"      DECIMAL(3,1),
    "square_feet"    INTEGER,
    "market_rent"    DECIMAL(12,2),
    "is_active"      BOOLEAN NOT NULL DEFAULT true,
    "notes"          TEXT,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "units_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "units_parent_unit_id_fkey"
        FOREIGN KEY ("parent_unit_id") REFERENCES "units"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "units_property_id_idx"             ON "units"("property_id");
CREATE INDEX IF NOT EXISTS "units_parent_unit_id_idx"          ON "units"("parent_unit_id");
CREATE INDEX IF NOT EXISTS "units_property_id_is_rentable_idx" ON "units"("property_id", "is_rentable");

-- 5. Tenants
CREATE TABLE IF NOT EXISTS "tenants" (
    "id"                      TEXT NOT NULL,
    "entity_id"               TEXT,
    "full_name"               TEXT NOT NULL,
    "phone"                   TEXT,
    "email"                   TEXT,
    "emergency_contact_name"  TEXT,
    "emergency_contact_phone" TEXT,
    "id_document_url"         TEXT,
    "notes"                   TEXT,
    "is_active"               BOOLEAN NOT NULL DEFAULT true,
    "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenants_entity_id_fkey"
        FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "chk_tenant_fullname_notempty"
        CHECK (length(trim("full_name")) > 0)
);

CREATE INDEX IF NOT EXISTS "tenants_entity_id_idx" ON "tenants"("entity_id");

-- 6. Leases
CREATE TABLE IF NOT EXISTS "leases" (
    "id"                    TEXT NOT NULL,
    "unit_id"               TEXT NOT NULL,
    "tenant_id"             TEXT NOT NULL,
    "start_date"            DATE NOT NULL,
    "end_date"              DATE,
    "monthly_rent"          DECIMAL(12,2) NOT NULL,
    "tenant_responsibility" DECIMAL(12,2) NOT NULL,
    "program_payment"       DECIMAL(12,2) NOT NULL DEFAULT 0,
    "program_type"          "ProgramType" NOT NULL DEFAULT 'NONE',
    "pet_fee"               DECIMAL(12,2) NOT NULL DEFAULT 0,
    "garage_fee"            DECIMAL(12,2) NOT NULL DEFAULT 0,
    "security_deposit"      DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status"                "LeaseStatus" NOT NULL DEFAULT 'PENDING',
    "notes"                 TEXT,

    CONSTRAINT "leases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "leases_unit_id_fkey"
        FOREIGN KEY ("unit_id") REFERENCES "units"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "leases_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chk_lease_monthly_rent_nonneg"
        CHECK ("monthly_rent" >= 0),
    CONSTRAINT "chk_lease_tenant_resp_nonneg"
        CHECK ("tenant_responsibility" >= 0),
    CONSTRAINT "chk_lease_security_deposit_nonneg"
        CHECK ("security_deposit" >= 0),
    CONSTRAINT "chk_lease_end_after_start"
        CHECK ("end_date" IS NULL OR "end_date" > "start_date")
);

CREATE INDEX IF NOT EXISTS "leases_unit_id_status_idx"   ON "leases"("unit_id", "status");
CREATE INDEX IF NOT EXISTS "leases_tenant_id_status_idx" ON "leases"("tenant_id", "status");

-- 7. Contacts
CREATE TABLE IF NOT EXISTS "contacts" (
    "id"              TEXT NOT NULL,
    "full_name"       TEXT NOT NULL,
    "organization"    TEXT,
    "contact_type"    "ContactType" NOT NULL,
    "role_title"      TEXT,
    "phone"           TEXT,
    "mobile"          TEXT,
    "email"           TEXT,
    "fax"             TEXT,
    "extension"       TEXT,
    "address"         TEXT,
    "program_type"    "ProgramType",
    "portal_url"      TEXT,
    "portal_username" TEXT,
    "portal_notes"    TEXT,
    "notes"           TEXT,
    "is_active"       BOOLEAN NOT NULL DEFAULT true,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contacts_contact_type_idx" ON "contacts"("contact_type");
CREATE INDEX IF NOT EXISTS "contacts_is_active_idx"    ON "contacts"("is_active");

-- 8. Contact ↔ Property links
CREATE TABLE IF NOT EXISTS "contact_property_links" (
    "id"                TEXT NOT NULL,
    "contact_id"        TEXT NOT NULL,
    "property_id"       TEXT NOT NULL,
    "relationship_note" TEXT,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_property_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contact_property_links_contact_id_fkey"
        FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "contact_property_links_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "contact_property_links_contact_id_property_id_key"
    ON "contact_property_links"("contact_id", "property_id");

-- 9. Contact ↔ Tenant links
CREATE TABLE IF NOT EXISTS "contact_tenant_links" (
    "id"                TEXT NOT NULL,
    "contact_id"        TEXT NOT NULL,
    "tenant_id"         TEXT NOT NULL,
    "relationship_note" TEXT,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_tenant_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contact_tenant_links_contact_id_fkey"
        FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "contact_tenant_links_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "contact_tenant_links_contact_id_tenant_id_key"
    ON "contact_tenant_links"("contact_id", "tenant_id");

-- 10. Contact ↔ Lease links
CREATE TABLE IF NOT EXISTS "contact_lease_links" (
    "id"                TEXT NOT NULL,
    "contact_id"        TEXT NOT NULL,
    "lease_id"          TEXT NOT NULL,
    "relationship_note" TEXT,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_lease_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contact_lease_links_contact_id_fkey"
        FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "contact_lease_links_lease_id_fkey"
        FOREIGN KEY ("lease_id") REFERENCES "leases"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "contact_lease_links_contact_id_lease_id_key"
    ON "contact_lease_links"("contact_id", "lease_id");

-- 11. Categories (income & expense)
CREATE TABLE IF NOT EXISTS "categories" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "kind"       "CategoryKind" NOT NULL,
    "tax_bucket" TEXT,
    "color"      TEXT,
    "is_system"  BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- 12. Income transactions
CREATE TABLE IF NOT EXISTS "income_transactions" (
    "id"               TEXT NOT NULL,
    "property_id"      TEXT NOT NULL,
    "unit_id"          TEXT,
    "lease_id"         TEXT,
    "tenant_id"        TEXT,
    "category_id"      TEXT NOT NULL,
    "amount"           DECIMAL(12,2) NOT NULL,
    "payment_date"     DATE NOT NULL,
    "payment_method"   "PaymentMethod",
    "reference_number" TEXT,
    "notes"            TEXT,
    "created_by"       TEXT NOT NULL,
    "source"           "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "idempotency_key"  TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "income_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "income_transactions_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "income_transactions_unit_id_fkey"
        FOREIGN KEY ("unit_id") REFERENCES "units"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "income_transactions_lease_id_fkey"
        FOREIGN KEY ("lease_id") REFERENCES "leases"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "income_transactions_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "income_transactions_category_id_fkey"
        FOREIGN KEY ("category_id") REFERENCES "categories"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "income_transactions_created_by_fkey"
        FOREIGN KEY ("created_by") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chk_income_amount_positive"
        CHECK ("amount" > 0)
);

CREATE INDEX IF NOT EXISTS "income_transactions_property_id_payment_date_idx"
    ON "income_transactions"("property_id", "payment_date" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_income_idempotency"
    ON "income_transactions" ("created_by", "idempotency_key")
    WHERE "idempotency_key" IS NOT NULL;

-- 13. Expense transactions
CREATE TABLE IF NOT EXISTS "expense_transactions" (
    "id"               TEXT NOT NULL,
    "property_id"      TEXT NOT NULL,
    "unit_id"          TEXT,
    "contact_id"       TEXT,
    "category_id"      TEXT NOT NULL,
    "amount"           DECIMAL(12,2) NOT NULL,
    "expense_date"     DATE NOT NULL,
    "payment_method"   "PaymentMethod",
    "reference_number" TEXT,
    "notes"            TEXT,
    "created_by"       TEXT NOT NULL,
    "source"           "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "idempotency_key"  TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "expense_transactions_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "expense_transactions_unit_id_fkey"
        FOREIGN KEY ("unit_id") REFERENCES "units"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "expense_transactions_contact_id_fkey"
        FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "expense_transactions_category_id_fkey"
        FOREIGN KEY ("category_id") REFERENCES "categories"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "expense_transactions_created_by_fkey"
        FOREIGN KEY ("created_by") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chk_expense_amount_positive"
        CHECK ("amount" > 0)
);

CREATE INDEX IF NOT EXISTS "expense_transactions_property_id_expense_date_idx"
    ON "expense_transactions"("property_id", "expense_date" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_expense_idempotency"
    ON "expense_transactions" ("created_by", "idempotency_key")
    WHERE "idempotency_key" IS NOT NULL;

-- 14. Property analyses (deal calculator)
CREATE TABLE IF NOT EXISTS "property_analyses" (
    "id"                      TEXT NOT NULL,
    "name"                    TEXT NOT NULL,
    "property_id"             TEXT,
    "address_text"            TEXT,
    "monthly_rental_income"   DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pet_lease_income"        DECIMAL(12,2) NOT NULL DEFAULT 0,
    "storage_income"          DECIMAL(12,2) NOT NULL DEFAULT 0,
    "misc_income"             DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthly_property_tax"    DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mortgage_insurance"      DECIMAL(12,2) NOT NULL DEFAULT 0,
    "home_insurance"          DECIMAL(12,2) NOT NULL DEFAULT 0,
    "water_sewer"             DECIMAL(12,2) NOT NULL DEFAULT 0,
    "garbage"                 DECIMAL(12,2) NOT NULL DEFAULT 0,
    "electric"                DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gas"                     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hoa_fees"                DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lawn_snow"               DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vacancy_pct"             DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "repairs_pct"             DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "capex_pct"               DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "prop_management_pct"     DECIMAL(5,4) NOT NULL DEFAULT 0,
    "house_cost"              DECIMAL(12,2) NOT NULL DEFAULT 0,
    "down_payment_pct"        DECIMAL(5,4) NOT NULL DEFAULT 0.25,
    "closing_costs"           DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rehab_budget"            DECIMAL(12,2) NOT NULL DEFAULT 0,
    "misc_other_investment"   DECIMAL(12,2) NOT NULL DEFAULT 0,
    "assumptions_notes"       TEXT,
    "created_by"              TEXT NOT NULL,
    "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_analyses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "property_analyses_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "property_analyses_created_by_fkey"
        FOREIGN KEY ("created_by") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "property_analyses_property_id_idx" ON "property_analyses"("property_id");
CREATE INDEX IF NOT EXISTS "property_analyses_created_by_idx"  ON "property_analyses"("created_by");

-- 15. Documents
CREATE TABLE IF NOT EXISTS "documents" (
    "id"                     TEXT NOT NULL,
    "entity_id"              TEXT,
    "property_id"            TEXT,
    "unit_id"                TEXT,
    "tenant_id"              TEXT,
    "lease_id"               TEXT,
    "contact_id"             TEXT,
    "income_transaction_id"  TEXT,
    "expense_transaction_id" TEXT,
    "analysis_id"            TEXT,
    "category"               "DocumentCategory" NOT NULL,
    "original_filename"      TEXT NOT NULL,
    "storage_key"            TEXT NOT NULL,
    "mime_type"              TEXT NOT NULL,
    "size_bytes"             INTEGER NOT NULL,
    "uploaded_by"            TEXT NOT NULL,
    "uploaded_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "documents_entity_id_fkey"
        FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_unit_id_fkey"
        FOREIGN KEY ("unit_id") REFERENCES "units"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_lease_id_fkey"
        FOREIGN KEY ("lease_id") REFERENCES "leases"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_contact_id_fkey"
        FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_income_transaction_id_fkey"
        FOREIGN KEY ("income_transaction_id") REFERENCES "income_transactions"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_expense_transaction_id_fkey"
        FOREIGN KEY ("expense_transaction_id") REFERENCES "expense_transactions"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_analysis_id_fkey"
        FOREIGN KEY ("analysis_id") REFERENCES "property_analyses"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_uploaded_by_fkey"
        FOREIGN KEY ("uploaded_by") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "documents_entity_id_idx"   ON "documents"("entity_id");
CREATE INDEX IF NOT EXISTS "documents_property_id_idx" ON "documents"("property_id");
CREATE INDEX IF NOT EXISTS "documents_tenant_id_idx"   ON "documents"("tenant_id");
CREATE INDEX IF NOT EXISTS "documents_category_idx"    ON "documents"("category");
CREATE INDEX IF NOT EXISTS "documents_contact_id_idx"  ON "documents"("contact_id");

-- 16. Chatbot entries
CREATE TABLE IF NOT EXISTS "chatbot_entries" (
    "id"                   TEXT NOT NULL,
    "user_id"              TEXT NOT NULL,
    "raw_text"             TEXT NOT NULL,
    "parsed_json"          JSONB,
    "confidence"           DOUBLE PRECISION,
    "status"               "ChatbotEntryStatus" NOT NULL DEFAULT 'PENDING',
    "resulting_income_id"  TEXT,
    "resulting_expense_id" TEXT,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chatbot_entries_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 17. Audit logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id"          TEXT NOT NULL,
    "user_id"     TEXT NOT NULL,
    "action"      TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id"   TEXT NOT NULL,
    "before_json" JSONB,
    "after_json"  JSONB,
    "ip_address"  TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 18. Period locks
CREATE TABLE IF NOT EXISTS "period_locks" (
    "id"        TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "year"      INTEGER NOT NULL,
    "month"     INTEGER NOT NULL,
    "locked_by" TEXT NOT NULL,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason"    TEXT,

    CONSTRAINT "period_locks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "period_locks_entity_id_fkey"
        FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "period_locks_locked_by_fkey"
        FOREIGN KEY ("locked_by") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "period_locks_entity_id_year_month_key"
    ON "period_locks"("entity_id", "year", "month");

-- 19. Late fee rules
CREATE TABLE IF NOT EXISTS "late_fee_rules" (
    "id"               TEXT NOT NULL,
    "entity_id"        TEXT NOT NULL,
    "grace_period_days" INTEGER NOT NULL DEFAULT 5,
    "fee_type"         TEXT NOT NULL DEFAULT 'FLAT',
    "fee_amount"       DECIMAL(12,2) NOT NULL DEFAULT 50,
    "max_fee_amount"   DECIMAL(12,2),
    "is_active"        BOOLEAN NOT NULL DEFAULT true,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "late_fee_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "late_fee_rules_entity_id_fkey"
        FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "late_fee_rules_entity_id_key"
    ON "late_fee_rules"("entity_id");

COMMIT;
