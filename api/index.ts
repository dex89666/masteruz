// ============================================
// MasterUz — Vercel Serverless Entry Point
// Файл в корне /api/ — Vercel автоматически
// подхватывает как serverless function
// ============================================

// BigInt сериализация (нужна до любого Prisma-импорта)
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

import app from '../backend/src/app';

export default app;
