// ============================================
// MasterUz — Prisma Client (Singleton)
// ============================================

import { PrismaClient } from '@prisma/client';
import { config } from './index.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.env === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (config.env !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
