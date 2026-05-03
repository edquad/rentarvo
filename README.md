# Rentarvo — Property Management, Simplified

A full-stack property management application for real estate investors managing rental portfolios across multiple LLC entities.

## Tech Stack

- **Backend:** Node.js 20 + Express + TypeScript + Prisma + PostgreSQL 16
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query
- **Monorepo:** pnpm workspaces

## Quick Start

### Prerequisites
- Node.js ≥ 20
- pnpm (`npm install -g pnpm`)
- Docker + Docker Compose

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL
docker compose up -d

# 3. Configure environment
cp .env.example .env

# 4. Run migrations + seed
pnpm db:migrate
pnpm db:seed

# 5. Start development servers
pnpm dev
```

The API runs on **http://localhost:3000** and the UI on **http://localhost:5173**.

### Default Login
- Email: `owner@rentarvo.local`
- Password: `Rentarvo!2026`

## Project Structure

```
rentarvo/
├── rentarvo-api/      # Express API + Prisma ORM
├── rentarvo-ui/       # React + Vite frontend
├── packages/
│   └── shared/        # Shared Zod schemas & TypeScript types
├── deploy/            # AWS deployment configs & scripts
├── .github/workflows/ # CI/CD pipelines
├── docker-compose.yml       # Local development
├── docker-compose.prod.yml  # Production deployment
├── DEPLOYMENT.md      # Deployment guide
└── AWS_DEPLOYMENT.md  # AWS setup guide
```

## Architecture

Rentarvo uses a **separated microservices architecture** optimized for independent deployment on AWS:

- **rentarvo-api**: Node.js/Express backend running on AWS ECS
- **rentarvo-ui**: React SPA served from AWS S3 + CloudFront or ECS
- **Database**: AWS RDS PostgreSQL
- **Shared**: Common TypeScript types and Zod schemas

Both services can be deployed, updated, and scaled independently while sharing type definitions through the monorepo.


## API

Base URL: `/api/v1`

| Module      | Endpoints                    |
|------------|------------------------------|
| Auth       | register, login, me          |
| Entities   | CRUD (LLCs)                  |
| Properties | CRUD with nested units       |
| Units      | CRUD + tree                  |
| Tenants    | CRUD (standalone)            |
| Leases     | CRUD (tenant ↔ unit)         |
| Contacts   | CRUD + junction links        |
| Income     | CRUD + filtering/pagination  |
| Expenses   | CRUD + filtering/pagination  |
| Categories | List (seeded)                |
| Dashboard  | Summary, cashflow, breakdown |

## Database

Managed by Prisma. Schema at `rentarvo-api/prisma/schema.prisma`.

```bash
pnpm db:migrate    # Run migrations
pnpm db:seed       # Seed default data
pnpm db:studio     # Open Prisma Studio
pnpm db:reset      # Reset database
```

## Deployment

Rentarvo is designed for independent service deployment on AWS. See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete instructions.

### Quick Deploy

**Local Development:**
```bash
docker-compose up -d  # Start PostgreSQL + pgAdmin
pnpm dev              # Start API & UI dev servers
```

**Production (AWS):**
```bash
# Automated via GitHub Actions CI/CD
# Push to main branch → automatic build, test, and deploy

# Manual deployment
export AWS_ACCOUNT_ID=your_account_id
./deploy/deploy-to-aws.sh
```

### Deployment Features

- ✅ **Separate Dockerfiles** for API and UI
- ✅ **GitHub Actions CI/CD** with automatic deployment on main branch
- ✅ **AWS ECS** for containerized services
- ✅ **AWS RDS** for managed PostgreSQL
- ✅ **AWS S3 + CloudFront** for static UI assets (optional)
- ✅ **Health checks** and automated rollback support
- ✅ **Path-based build triggers** - only rebuild changed services
- ✅ **Environment-specific configs** for dev/staging/production

## Security Notes

- Passwords hashed with bcrypt (cost 12)
- JWT auth with Bearer tokens
- Rate limiting on login (10/min/IP)
- File uploads go through auth-gated API endpoints
- All monetary values stored as Decimal(12,2)
- Audit logging on all write operations
