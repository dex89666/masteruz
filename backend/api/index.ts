// ============================================
// MasterUz — Vercel Serverless Entry Point
// Catch-all handler: все /api/* запросы → Express app
// ============================================

// BigInt сериализация (нужна до любого Prisma-импорта)
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

import app from '../src/app.js';

export default app;
