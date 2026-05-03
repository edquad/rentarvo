# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY rentarvo-api ./rentarvo-api

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @rentarvo/api exec prisma generate

# Build API
RUN cd rentarvo-api && npx tsc

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY rentarvo-api/package.json ./rentarvo-api/package.json
COPY rentarvo-api/prisma ./rentarvo-api/prisma

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Generate Prisma client in prod image
RUN cd rentarvo-api && npx prisma generate

# Copy built application from builder
COPY --from=builder /app/rentarvo-api/dist ./rentarvo-api/dist

# Copy seed script for initial setup
COPY rentarvo-api/prisma/seed.ts ./rentarvo-api/prisma/seed.ts

WORKDIR /app/rentarvo-api

EXPOSE 4000

CMD ["node", "dist/index.js"]
