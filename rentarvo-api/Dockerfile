# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY rentarvo-api ./rentarvo-api

RUN npm install -g pnpm@10

RUN pnpm install --frozen-lockfile

RUN cd rentarvo-api && pnpm exec prisma generate

RUN cd rentarvo-api && pnpm exec tsc

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@10

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY rentarvo-api/package.json ./rentarvo-api/package.json
COPY rentarvo-api/prisma ./rentarvo-api/prisma

# Install full dependencies (we need tsx for running seed and prisma CLI)
RUN pnpm install --frozen-lockfile

# Copy built app and generated Prisma client from builder
COPY --from=builder /app/rentarvo-api/dist ./rentarvo-api/dist
COPY --from=builder /app/node_modules/.pnpm /app/node_modules/.pnpm

WORKDIR /app/rentarvo-api

EXPOSE 4000

CMD ["node", "dist/index.js"]
