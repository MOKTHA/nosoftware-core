# HeyNXT Core Service Workers - Dockerfile
# Multi-stage build for optimized worker container

# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/

RUN pnpm build

# =============================================================================
# Stage 2: Production Runtime
# =============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 heynxt && \
    adduser -u 1001 -G heynxt -D heynxt
USER heynxt

# Expose port (for health checks, optional)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Start command
CMD ["node", "dist/index.js"]
