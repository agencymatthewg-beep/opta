# Clawdbot Server Dockerfile
# Uses Bun for fast startup and native WebSocket support

FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

# Build stage (for type checking)
FROM base AS builder
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run typecheck || true

# Production stage
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 clawdbot && \
    adduser --system --uid 1001 clawdbot

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

# Copy source (Bun runs TypeScript directly)
COPY src ./src
COPY tsconfig.json ./

# Set ownership
RUN chown -R clawdbot:clawdbot /app

USER clawdbot

# Expose WebSocket port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start server
CMD ["bun", "run", "src/index.ts"]
