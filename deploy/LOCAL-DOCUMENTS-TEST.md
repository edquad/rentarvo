# Local test: Documents + S3 storage

## What was added

- **Documents page** — upload leases, bills, photos, PDFs, Excel (max 25 MB)
- **Categories** — Lease, Bill/Utility, Receipt, Invoice, Property Photo, etc.
- **Link to** property, lease, or tenant on upload
- **Storage**
  - `STORAGE_DRIVER=local` (default) — files in `rentarvo-api/uploads`
  - `STORAGE_DRIVER=s3` — files in AWS S3 (for production)

---

## Step 1 — Start Docker Desktop

Open **Docker Desktop** and wait until it says **Running**.

---

## Step 2 — Start database

```powershell
cd C:\Users\varun\Desktop\project\fati\rentarvo
docker compose up -d postgres
```

---

## Step 3 — Apply DB migrations (required)

Documents need two schema updates: **`description`** column and **`BILL`** category.

```powershell
cd rentarvo-api
npx prisma migrate deploy
cd ..
```

If `migrate deploy` fails (e.g. database already has data but no migration history), run:

```powershell
Get-Content rentarvo-api\prisma\fix-documents-local.sql | docker compose exec -T postgres psql -U rentarvo -d rentarvo
```

Without this step, `/api/v1/documents` returns **400 Bad Request** (Prisma cannot read the `description` field).

Restart the API after migrating (`pnpm dev`).

---

## Step 4 — Local `.env` (API)

In `rentarvo-api\.env` ensure:

```env
DATABASE_URL=postgresql://rentarvo:rentarvo_dev@localhost:5432/rentarvo?schema=public
JWT_SECRET=dev-secret-replace-me
API_PORT=4000
CORS_ORIGIN=http://localhost:5173
STORAGE_DRIVER=local
UPLOAD_DIR=./uploads
```

(No S3 keys needed for local disk testing.)

---

## Step 5 — Run app

```powershell
cd C:\Users\varun\Desktop\project\fati\rentarvo
pnpm dev
```

- UI: http://localhost:5173  
- API: http://localhost:4000  

Login: `owner@rentarvo.local` / `Rentarvo!2026`

---

## Troubleshooting: 400 on Documents

| Symptom | Fix |
|--------|-----|
| `GET /api/v1/documents` → 400 | Run Step 3 SQL (`description` column missing) |
| `POST /api/v1/documents` → 400, category **Other** | Fill **“What is this document?”** (required for Other) |
| `POST` → 400, other category | Check file type (PDF, images, Excel, CSV) and size ≤ 25 MB |

---

## Step 6 — Test documents

1. Open **Documents** in the sidebar  
2. Use the **drag-and-drop** area (or Browse files)  
3. Pick category **Lease** or **Bill / Utility** (or **Other** + short description)  
4. Optional: link **Property** / **Lease** / **Tenant**  
5. Choose a PDF or image  
6. Confirm it appears in the list  
7. Click **Download** — file should open  
8. Delete — row should disappear  

Files on disk: `rentarvo-api\uploads\`

---

## Optional — Test real S3 locally

1. Create bucket: `bash deploy/create-s3-bucket.sh` (AWS CLI required)  
2. Create IAM user + attach `deploy/iam-s3-documents-policy.json` (replace bucket name)  
3. In `rentarvo-api\.env`:

```env
STORAGE_DRIVER=s3
S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
S3_PREFIX=rentarvo
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

4. Restart API (`pnpm dev`) and upload again — check file in S3 console under `rentarvo/documents/`

---

## When local tests pass → deploy to Lightsail

See team lead or run deploy after pushing code and updating `.env.prod` on the server with S3 settings.
