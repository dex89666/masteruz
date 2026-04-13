// ============================================
// MasterUz — Auth Routes
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { telegramAuthSchema, telegramMiniAppAuthSchema, refreshTokenSchema, switchRoleSchema } from './auth.schema.js';
import { isSuperAdmin } from '../../utils/helpers.js';

const router = Router();

// Telegram Login Widget
router.post('/telegram', validateBody(telegramAuthSchema), (req, res, next) =>
  authController.loginTelegram(req, res, next)
);

// Telegram Mini App
router.post('/mini-app', validateBody(telegramMiniAppAuthSchema), (req, res, next) =>
  authController.loginMiniApp(req, res, next)
);

// Обновление токена
router.post('/refresh', validateBody(refreshTokenSchema), (req, res, next) =>
  authController.refresh(req, res, next)
);

// Текущий пользователь
router.get('/me', authenticate, (req, res, next) =>
  authController.me(req, res, next)
);

// Выход
router.post('/logout', authenticate, (req, res, next) =>
  authController.logout(req, res, next)
);

// Переключение роли (только для админов)
router.post('/switch-role', authenticate, validateBody(switchRoleSchema), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { role } = req.body;

    // Проверяем, является ли пользователь админом:
    // 1. Текущая роль ADMIN, или
    // 2. Его ID в списке admin_user_ids в PlatformConfig
    const { prisma } = await import('../../config/database.js');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'Пользователь не найден' });
      return;
    }

    const isCurrentAdmin = user.role === 'ADMIN';
    const isSuper = isSuperAdmin(user.username);

    // Проверяем PlatformConfig — admin_user_ids
    const adminConfig = await prisma.platformConfig.findUnique({ where: { key: 'admin_user_ids' } });
    const adminUserIds: string[] = adminConfig ? adminConfig.value.split(',').map((s: string) => s.trim()) : [];
    const isInAdminList = adminUserIds.includes(userId);

    if (!isCurrentAdmin && !isInAdminList && !isSuper) {
      res.status(403).json({ success: false, message: 'Только администраторы могут переключать роли' });
      return;
    }

    // При первом переключении — сохраняем userId в admin_user_ids
    if (isCurrentAdmin && !isInAdminList) {
      const newList = [...adminUserIds, userId].join(',');
      await prisma.platformConfig.upsert({
        where: { key: 'admin_user_ids' },
        update: { value: newList },
        create: { key: 'admin_user_ids', value: newList, description: 'Список user ID с правами админа (для переключения ролей)' },
      });
    }

    // Меняем роль
    // Если переключаемся на MASTER — создаём masterProfile если его нет (для админов — с registrationPaid=true)
    if (role === 'MASTER') {
      const existingMp = await prisma.masterProfile.findUnique({ where: { userId } });
      if (!existingMp) {
        await prisma.masterProfile.create({
          data: {
            userId,
            specializations: ['general'],
            experienceYears: 0,
            registrationPaid: true, // Админы не платят регистрационный взнос
          },
        });
      } else if (!existingMp.registrationPaid) {
        // Если профиль есть но не оплачен — отмечаем оплаченным (для админов)
        await prisma.masterProfile.update({
          where: { userId },
          data: { registrationPaid: true },
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      include: {
        profile: true,
        masterProfile: true,
      },
    });

    // Генерируем новые токены с обновлённой ролью
    const { authService } = await import('./auth.service.js');
    const tokens = authService.generateTokensPublic({
      userId: updated.id,
      role: updated.role,
      telegramId: (req as any).user?.telegramId || 0,
      phone: updated.phone || '',
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        telegramId: Number(updated.telegramId),
        username: updated.username,
        phone: updated.phone,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive,
        isVerified: updated.isVerified,
        balance: Number(updated.balance),
        referralCode: updated.referralCode,
        profile: updated.profile,
        masterProfile: updated.masterProfile,
        createdAt: updated.createdAt,
        isAdminUser: true, // Если дошли сюда — пользователь точно админ
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
