// ============================================
// MasterUz — Prisma Client (Singleton)
// Поддерживает VPS и Vercel Serverless (Neon)
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
    // Neon serverless: используем short-lived connections
    ...(process.env.VERCEL === '1' && {
      datasourceUrl: process.env.DATABASE_URL,
    }),
  });

// Кешируем Prisma Client между вызовами serverless функций (hot start)
if (config.env !== 'production' || process.env.VERCEL === '1') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
