/**
 * Запрещает действия мастеру, заблокированному за нарушения дисциплины.
 * Применяется к ключевым endpoint'ам — отклик на заказ, принятие сметы,
 * смена статуса заказа.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { ApiError } from '../utils/ApiError.js';
import { getBlockRemainingMs } from '../services/masterDisciplineService.js';

export async function requireNotBlocked(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      next();
      return;
    }
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { blockedUntil: true },
    });
    const remainingMs = getBlockRemainingMs(u?.blockedUntil ?? null);
    if (remainingMs !== null && u?.blockedUntil) {
      const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
      throw ApiError.forbidden(
        `Аккаунт временно заблокирован за нарушения дисциплины. ` +
        `Доступ откроется ${u.blockedUntil.toISOString()} ` +
        `(осталось ~${days} дн.)`,
      );
    }
    next();
  } catch (e) {
    next(e);
  }
}
