# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY rentarvo-api ./rentarvo-api

RUN npm install -g pnpm@10

RUN pnpm install --frozen-lockfile

# Generate Prisma Client (DATABASE_URL not required for v5 generate)
RUN cd rentarvo-api && pnpm exec prisma generate

# Build TypeScript
RUN cd rentarvo-api && pnpm exec tsc

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@10

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY rentarvo-api/package.json ./rentarvo-api/package.json
COPY rentarvo-api/prisma ./rentarvo-api/prisma

RUN pnpm install --frozen-lockfile --prod

# Generate Prisma Client in prod image
RUN cd rentarvo-api && pnpm exec prisma generate

# Copy built app from builder
COPY --from=builder /app/rentarvo-api/dist ./rentarvo-api/dist

WORKDIR /app/rentarvo-api

EXPOSE 4000

CMD ["node", "dist/index.js"]
