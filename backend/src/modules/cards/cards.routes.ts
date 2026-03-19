// ============================================
// MasterUz — Cards Routes (привязка карт)
// ============================================

import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * Маскировка номера карты: 8600 **** **** 1234
 */
function maskCardNumber(num: string): string {
  const digits = num.replace(/\s+/g, '');
  if (digits.length < 8) return digits;
  return digits.slice(0, 4) + ' **** **** ' + digits.slice(-4);
}

/**
 * Валидация номера карты (минимальная: 16 цифр, Luhn необязателен)
 */
function validateCardNumber(num: string): boolean {
  const digits = num.replace(/[\s-]/g, '');
  return /^\d{16}$/.test(digits);
}

/**
 * Определение провайдера по BIN (первые цифры)
 */
function detectProvider(num: string): string {
  const digits = num.replace(/\s+/g, '');
  if (digits.startsWith('8600')) return 'UZCARD';
  if (digits.startsWith('9860')) return 'HUMO';
  if (digits.startsWith('4')) return 'VISA';
  if (digits.startsWith('5')) return 'MASTERCARD';
  return 'OTHER';
}

// GET /api/cards — получить все карты пользователя
router.get('/', authenticate, async (req, res, next) => {
  try {
    const cards = await prisma.linkedCard.findMany({
      where: { userId: req.user!.userId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        cardNumber: true,
        cardHolder: true,
        expiryMonth: true,
        expiryYear: true,
        provider: true,
        isDefault: true,
        createdAt: true,
      },
    });
    res.json(cards);
  } catch (error) {
    next(error);
  }
});

// POST /api/cards — привязать новую карту
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { cardNumber, cardHolder, expiryMonth, expiryYear } = req.body;

    if (!cardNumber) throw ApiError.badRequest('Укажите номер карты');
    if (!validateCardNumber(cardNumber)) throw ApiError.badRequest('Неверный формат номера карты (16 цифр)');

    const provider = detectProvider(cardNumber);
    const masked = maskCardNumber(cardNumber);

    // Проверяем нет ли такой же карты
    const existing = await prisma.linkedCard.findFirst({
      where: { userId: req.user!.userId, cardNumber: masked, isActive: true },
    });
    if (existing) throw ApiError.badRequest('Эта карта уже привязана');

    // Проверяем кол-во карт (макс 5)
    const count = await prisma.linkedCard.count({
      where: { userId: req.user!.userId, isActive: true },
    });
    if (count >= 5) throw ApiError.badRequest('Максимум 5 привязанных карт');

    // Если первая карта — делаем дефолтной
    const isDefault = count === 0;

    const card = await prisma.linkedCard.create({
      data: {
        userId: req.user!.userId,
        cardNumber: masked,
        cardHolder: cardHolder?.trim() || null,
        expiryMonth: expiryMonth ? parseInt(expiryMonth, 10) : null,
        expiryYear: expiryYear ? parseInt(expiryYear, 10) : null,
        provider,
        isDefault,
      },
    });

    logger.info({ userId: req.user!.userId, provider }, 'Карта привязана');
    res.status(201).json(card);
  } catch (error) {
    next(error);
  }
});

// PUT /api/cards/:id/default — сделать карту основной
router.put('/:id/default', authenticate, async (req, res, next) => {
  try {
    const card = await prisma.linkedCard.findUnique({ where: { id: req.params.id } });
    if (!card || card.userId !== req.user!.userId) throw ApiError.notFound('Карта не найдена');

    await prisma.$transaction([
      prisma.linkedCard.updateMany({
        where: { userId: req.user!.userId },
        data: { isDefault: false },
      }),
      prisma.linkedCard.update({
        where: { id: req.params.id },
        data: { isDefault: true },
      }),
    ]);

    res.json({ message: 'Карта назначена основной' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/cards/:id — удалить (деактивировать) карту
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const card = await prisma.linkedCard.findUnique({ where: { id: req.params.id } });
    if (!card || card.userId !== req.user!.userId) throw ApiError.notFound('Карта не найдена');

    await prisma.linkedCard.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    // Если удалили дефолтную — назначаем следующую
    if (card.isDefault) {
      const next = await prisma.linkedCard.findFirst({
        where: { userId: req.user!.userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (next) {
        await prisma.linkedCard.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    res.json({ message: 'Карта удалена' });
  } catch (error) {
    next(error);
  }
});

export default router;
