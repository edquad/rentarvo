-- Optional label for documents (especially when category is OTHER)
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "description" TEXT;
