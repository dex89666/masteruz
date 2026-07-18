// Compatibility shim for tests: when running under `test` environment,
// provide a lightweight mockable DB object with jest-like helpers.
// In non-test envs we re-export the real Prisma client.
import { prisma } from '../config/database';

// Simple re-export: tests and app code import `db` and can set mocks on `prisma` when
// running under NODE_ENV=test (database.ts provides a mock proxy in that case).
export const db: any = prisma as any;
export default db;
