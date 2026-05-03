# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY rentarvo-ui ./rentarvo-ui

# Install pnpm
RUN npm install -g pnpm@10

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build UI
RUN pnpm --filter @rentarvo/web build

# Production stage - Use nginx to serve static files
FROM nginx:alpine

COPY rentarvo-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/rentarvo-ui/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
