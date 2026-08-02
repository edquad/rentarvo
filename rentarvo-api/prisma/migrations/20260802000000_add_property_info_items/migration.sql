-- CreateTable
CREATE TABLE "property_info_items" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_info_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_info_items_property_id_section_idx" ON "property_info_items"("property_id", "section");

-- AddForeignKey
ALTER TABLE "property_info_items" ADD CONSTRAINT "property_info_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
