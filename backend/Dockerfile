# ============================================
# MasterUz — Backend Dockerfile
# Агент 5 (DevOps-инженер)
# ============================================

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --only=production; else npm install --only=production; fi && \
    cp -R node_modules /tmp/prod_node_modules && \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Generate Prisma Client
FROM deps AS prisma
COPY prisma ./prisma/
RUN npx prisma generate

# Build TypeScript
FROM prisma AS builder
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# Production image
FROM base AS runner
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 masteruz
    
COPY --from=builder /tmp/prod_node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY package.json ./

# Create uploads & local registry directories
RUN mkdir -p uploads data && chown -R masteruz:nodejs uploads data

USER masteruz

EXPOSE 3000

# Run migrations and start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
