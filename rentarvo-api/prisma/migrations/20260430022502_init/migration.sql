-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('MULTI_FAMILY', 'SINGLE_FAMILY', 'ROOM_RENTAL', 'BED_RENTAL', 'COMMERCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('FLOOR', 'APARTMENT', 'ROOM', 'BED', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('ACTIVE', 'ENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('WHA', 'JDA', 'CHD', 'NONE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('CASE_WORKER', 'CONTRACTOR', 'VENDOR', 'UTILITY', 'INSURANCE_AGENT', 'ATTORNEY', 'ACCOUNTANT', 'MUNICIPAL', 'PROPERTY_MANAGER', 'OWNER_PARTNER', 'EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHECK', 'ACH', 'ZELLE', 'VENMO', 'CASHAPP', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'CHATBOT', 'IMPORT');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('LEASE', 'TENANT_ID', 'SECTION_8', 'INSPECTION', 'RECEIPT', 'INVOICE', 'PROPERTY_PHOTO', 'INSURANCE', 'TAX', 'ANALYSIS', 'OTHER');

-- CreateEnum
CREATE TYPE "ChatbotEntryStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ein" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address_line1" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "property_type" "PropertyType" NOT NULL,
    "purchase_price" DECIMAL(12,2),
    "purchase_date" DATE,
    "rehab_cost" DECIMAL(12,2),
    "current_value" DECIMAL(12,2),
    "mortgage_balance" DECIMAL(12,2),
    "monthly_mortgage" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthly_tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthly_insurance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthly_hoa" DECIMAL(12,2),
    "notes" TEXT,
    "cover_photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "parent_unit_id" TEXT,
    "label" TEXT NOT NULL,
    "unit_type" "UnitType" NOT NULL,
    "is_rentable" BOOLEAN NOT NULL DEFAULT false,
    "bedrooms" INTEGER,
    "bathrooms" DECIMAL(3,1),
    "square_feet" INTEGER,
    "market_rent" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "id_document_url" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leases" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "monthly_rent" DECIMAL(12,2) NOT NULL,
    "tenant_responsibility" DECIMAL(12,2) NOT NULL,
    "program_payment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "program_type" "ProgramType" NOT NULL DEFAULT 'NONE',
    "pet_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "garage_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "security_deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "LeaseStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,

    CONSTRAINT "leases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "organization" TEXT,
    "contact_type" "ContactType" NOT NULL,
    "role_title" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "fax" TEXT,
    "extension" TEXT,
    "address" TEXT,
    "program_type" "ProgramType",
    "portal_url" TEXT,
    "portal_username" TEXT,
    "portal_notes" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_property_links" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "relationship_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_property_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_tenant_links" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "relationship_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_tenant_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_lease_links" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "relationship_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_lease_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "tax_bucket" TEXT,
    "color" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_transactions" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "lease_id" TEXT,
    "tenant_id" TEXT,
    "category_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "payment_method" "PaymentMethod",
    "reference_number" TEXT,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "income_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_transactions" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "contact_id" TEXT,
    "category_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "payment_method" "PaymentMethod",
    "reference_number" TEXT,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_analyses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "property_id" TEXT,
    "address_text" TEXT,
    "monthly_rental_income" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pet_lease_income" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "storage_income" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "misc_income" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthly_property_tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mortgage_insurance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "home_insurance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "water_sewer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "garbage" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "electric" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hoa_fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lawn_snow" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vacancy_pct" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "repairs_pct" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "capex_pct" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "prop_management_pct" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "house_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "down_payment_pct" DECIMAL(5,4) NOT NULL DEFAULT 0.25,
    "closing_costs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rehab_budget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "misc_other_investment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "assumptions_notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "property_id" TEXT,
    "unit_id" TEXT,
    "tenant_id" TEXT,
    "lease_id" TEXT,
    "contact_id" TEXT,
    "income_transaction_id" TEXT,
    "expense_transaction_id" TEXT,
    "analysis_id" TEXT,
    "category" "DocumentCategory" NOT NULL,
    "original_filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "parsed_json" JSONB,
    "confidence" DOUBLE PRECISION,
    "status" "ChatbotEntryStatus" NOT NULL DEFAULT 'PENDING',
    "resulting_income_id" TEXT,
    "resulting_expense_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "properties_entity_id_idx" ON "properties"("entity_id");

-- CreateIndex
CREATE INDEX "units_property_id_idx" ON "units"("property_id");

-- CreateIndex
CREATE INDEX "units_parent_unit_id_idx" ON "units"("parent_unit_id");

-- CreateIndex
CREATE INDEX "units_property_id_is_rentable_idx" ON "units"("property_id", "is_rentable");

-- CreateIndex
CREATE INDEX "leases_unit_id_status_idx" ON "leases"("unit_id", "status");

-- CreateIndex
CREATE INDEX "leases_tenant_id_status_idx" ON "leases"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "contacts_contact_type_idx" ON "contacts"("contact_type");

-- CreateIndex
CREATE INDEX "contacts_is_active_idx" ON "contacts"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "contact_property_links_contact_id_property_id_key" ON "contact_property_links"("contact_id", "property_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_tenant_links_contact_id_tenant_id_key" ON "contact_tenant_links"("contact_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_lease_links_contact_id_lease_id_key" ON "contact_lease_links"("contact_id", "lease_id");

-- CreateIndex
CREATE INDEX "income_transactions_property_id_payment_date_idx" ON "income_transactions"("property_id", "payment_date" DESC);

-- CreateIndex
CREATE INDEX "expense_transactions_property_id_expense_date_idx" ON "expense_transactions"("property_id", "expense_date" DESC);

-- CreateIndex
CREATE INDEX "property_analyses_property_id_idx" ON "property_analyses"("property_id");

-- CreateIndex
CREATE INDEX "property_analyses_created_by_idx" ON "property_analyses"("created_by");

-- CreateIndex
CREATE INDEX "documents_property_id_idx" ON "documents"("property_id");

-- CreateIndex
CREATE INDEX "documents_tenant_id_idx" ON "documents"("tenant_id");

-- CreateIndex
CREATE INDEX "documents_category_idx" ON "documents"("category");

-- CreateIndex
CREATE INDEX "documents_contact_id_idx" ON "documents"("contact_id");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_parent_unit_id_fkey" FOREIGN KEY ("parent_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_property_links" ADD CONSTRAINT "contact_property_links_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_property_links" ADD CONSTRAINT "contact_property_links_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tenant_links" ADD CONSTRAINT "contact_tenant_links_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tenant_links" ADD CONSTRAINT "contact_tenant_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_lease_links" ADD CONSTRAINT "contact_lease_links_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_lease_links" ADD CONSTRAINT "contact_lease_links_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_transactions" ADD CONSTRAINT "income_transactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_transactions" ADD CONSTRAINT "income_transactions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_transactions" ADD CONSTRAINT "income_transactions_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_transactions" ADD CONSTRAINT "income_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_transactions" ADD CONSTRAINT "income_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_transactions" ADD CONSTRAINT "income_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_transactions" ADD CONSTRAINT "expense_transactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_transactions" ADD CONSTRAINT "expense_transactions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_transactions" ADD CONSTRAINT "expense_transactions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_transactions" ADD CONSTRAINT "expense_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_transactions" ADD CONSTRAINT "expense_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_analyses" ADD CONSTRAINT "property_analyses_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_analyses" ADD CONSTRAINT "property_analyses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_income_transaction_id_fkey" FOREIGN KEY ("income_transaction_id") REFERENCES "income_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_expense_transaction_id_fkey" FOREIGN KEY ("expense_transaction_id") REFERENCES "expense_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "property_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_entries" ADD CONSTRAINT "chatbot_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
