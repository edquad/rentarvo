-- AlterTable: Add entity_id to tenants
ALTER TABLE "tenants" ADD COLUMN "entity_id" TEXT;

-- AlterTable: Add entity_id to documents
ALTER TABLE "documents" ADD COLUMN "entity_id" TEXT;

-- CreateIndex
CREATE INDEX "tenants_entity_id_idx" ON "tenants"("entity_id");

-- CreateIndex
CREATE INDEX "documents_entity_id_idx" ON "documents"("entity_id");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
