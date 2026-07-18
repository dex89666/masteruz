// ============================================
// MasterUz — Prisma Client (Singleton)
// ============================================

import { PrismaClient } from '@prisma/client';
import { config } from './index.js';

// In test environment provide a lightweight mockable proxy that mirrors
// Prisma model methods with `mockResolvedValueOnce`/`mockResolvedValue` helpers
function createMockPrisma(): PrismaClient {
  class MockFn {
    private queue: any[] = [];
    private defaultValue: any = null;
    calls: any[] = [];
    constructor() {
      const f: any = (...args: any[]) => {
        this.calls.push(args);
        if (this.queue.length) return Promise.resolve(this.queue.shift());
        if (f.impl) return Promise.resolve(f.impl(...args));
        return Promise.resolve(this.defaultValue);
      };
      f.mockResolvedValueOnce = (v: any) => { this.queue.push(v); return f; };
      f.mockResolvedValue = (v: any) => { this.defaultValue = v; return f; };
      f.mockRejectedValueOnce = (v: any) => { this.queue.push(Promise.reject(v)); return f; };
      f.mockImplementation = (impl: any) => { f.impl = impl; return f; };
      return f;
    }
  }

  function makeMockModel() {
    const methodCache = new Map<string | symbol, any>();
    return new Proxy({}, {
      get(_, prop) {
        if (!methodCache.has(prop)) methodCache.set(prop, new MockFn());
        return methodCache.get(prop);
      }
    });
  }

  const models = new Map<string | symbol, any>();
  return new Proxy({}, {
    get(_, model) {
      if (!models.has(model)) models.set(model, makeMockModel());
      return models.get(model);
    }
  }) as unknown as PrismaClient;
}

function createRealPrisma(): PrismaClient {
  const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
  };

  const client =
    globalForPrisma.prisma ??
    new PrismaClient({
      log: config.env === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

  if (config.env !== 'production') {
    globalForPrisma.prisma = client;
  }

  return client;
}

export const prisma =
  process.env.NODE_ENV === 'test' ? createMockPrisma() : createRealPrisma();

export default prisma;
