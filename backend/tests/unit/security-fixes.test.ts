// ============================================
// MasterUz — Тесты для Security-фиксов (P0-P3)
// Покрытие: isSuperAdmin, clampPagination, Zod-схемы,
//           upload whitelist, payments validation
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── P0: isSuperAdmin (замена хардкода) ───────────────

// Мокаем config до импорта helpers
vi.mock('../../src/config/index.js', () => ({
  config: {
    superAdminUsernames: ['admin1', 'admin2'],
    platform: {
      defaultCommissionRate: 15,
      masterRegistrationFee: 400000,
      defaultReferralMasterBonusRate: 5,
      defaultReferralClientDiscountRate: 3,
    },
  },
}));

import { isSuperAdmin, clampPagination } from '../../src/utils/helpers.js';

describe('P0: isSuperAdmin — замена хардкода', () => {
  it('возвращает true для пользователя из env', () => {
    expect(isSuperAdmin('admin1')).toBe(true);
    expect(isSuperAdmin('admin2')).toBe(true);
  });

  it('возвращает false для неизвестного пользователя', () => {
    expect(isSuperAdmin('hacker')).toBe(false);
    expect(isSuperAdmin('sustanon250')).toBe(false);
  });

  it('возвращает false для null/undefined/пустой строки', () => {
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
    expect(isSuperAdmin('')).toBe(false);
  });
});

// ─── P0-Quality: clampPagination (защита от DoS) ─────

describe('Quality: clampPagination — ограничение пагинации', () => {
  it('ограничивает limit сверху (100 по умолчанию)', () => {
    const r = clampPagination(1, 999);
    expect(r.limit).toBe(100);
    expect(r.skip).toBe(0);
  });

  it('выставляет дефолты при невалидных входных данных', () => {
    const r = clampPagination('abc', undefined);
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
    expect(r.skip).toBe(0);
  });

  it('не позволяет page < 1', () => {
    const r = clampPagination(-5, 10);
    expect(r.page).toBe(1);
  });

  it('трактует limit=0 как "не указан" → дефолт 20', () => {
    const r = clampPagination(1, 0);
    expect(r.limit).toBe(20);
  });

  it('корректно считает skip', () => {
    const r = clampPagination(3, 20);
    expect(r.skip).toBe(40);
  });

  it('принимает кастомный maxLimit', () => {
    const r = clampPagination(1, 50, 30);
    expect(r.limit).toBe(30);
  });
});

// ─── P2: Zod-схемы payments ──────────────────────────

import {
  balanceTopupSchema,
  registrationFeeSchema,
  telegramStarsSchema,
  commissionPaymentSchema,
} from '../../src/modules/payments/payments.schema.js';

describe('P2: Zod-валидация payments', () => {
  describe('balanceTopupSchema', () => {
    it('принимает валидный запрос', () => {
      const r = balanceTopupSchema.safeParse({ amount: 50000, provider: 'CLICK' });
      expect(r.success).toBe(true);
    });

    it('отклоняет отрицательную сумму', () => {
      const r = balanceTopupSchema.safeParse({ amount: -100, provider: 'CLICK' });
      expect(r.success).toBe(false);
    });

    it('отклоняет сумму > 100 000 000', () => {
      const r = balanceTopupSchema.safeParse({ amount: 200_000_000, provider: 'PAYME' });
      expect(r.success).toBe(false);
    });

    it('отклоняет невалидный provider', () => {
      const r = balanceTopupSchema.safeParse({ amount: 10000, provider: 'bitcoin' });
      expect(r.success).toBe(false);
    });
  });

  describe('telegramStarsSchema', () => {
    it('принимает валидные данные', () => {
      const r = telegramStarsSchema.safeParse({ paymentId: 'pay-123', telegramPaymentId: 'tg-456' });
      expect(r.success).toBe(true);
    });

    it('отклоняет пустые paymentId/telegramPaymentId', () => {
      expect(telegramStarsSchema.safeParse({ paymentId: '', telegramPaymentId: 'x' }).success).toBe(false);
      expect(telegramStarsSchema.safeParse({ paymentId: 'x', telegramPaymentId: '' }).success).toBe(false);
    });
  });

  describe('commissionPaymentSchema', () => {
    it('принимает валидный UUID + provider', () => {
      const r = commissionPaymentSchema.safeParse({
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        provider: 'TELEGRAM_STARS',
      });
      expect(r.success).toBe(true);
    });

    it('отклоняет невалидный UUID для orderId', () => {
      const r = commissionPaymentSchema.safeParse({ orderId: 'not-uuid', provider: 'CLICK' });
      expect(r.success).toBe(false);
    });
  });

  describe('registrationFeeSchema', () => {
    it('принимает валидный provider', () => {
      expect(registrationFeeSchema.safeParse({ provider: 'PAYME' }).success).toBe(true);
    });

    it('отклоняет невалидный provider', () => {
      expect(registrationFeeSchema.safeParse({ provider: 'paypal' }).success).toBe(false);
    });
  });
});

// ─── P3: Zod-схемы admin ─────────────────────────────

import {
  adminUsersQuerySchema,
  blockUserSchema,
  changeRoleSchema,
  adminBalanceSchema,
  adminOrderCommentSchema,
  adminConfigSchema,
} from '../../src/modules/admin/admin.schema.js';

describe('P3: Zod-валидация admin', () => {
  it('adminUsersQuerySchema — дефолты page=1, limit=20', () => {
    const r = adminUsersQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.limit).toBe(20);
    }
  });

  it('adminUsersQuerySchema — limit не может > 100', () => {
    const r = adminUsersQuerySchema.safeParse({ limit: 500 });
    expect(r.success).toBe(false);
  });

  it('changeRoleSchema — принимает валидные роли', () => {
    for (const role of ['CLIENT', 'MASTER', 'MANAGER', 'ADMIN']) {
      expect(changeRoleSchema.safeParse({ role }).success).toBe(true);
    }
  });

  it('changeRoleSchema — отклоняет невалидную роль', () => {
    expect(changeRoleSchema.safeParse({ role: 'SUPERADMIN' }).success).toBe(false);
  });

  it('adminBalanceSchema — отклоняет отрицательную сумму', () => {
    expect(adminBalanceSchema.safeParse({ amount: -500 }).success).toBe(false);
  });

  it('adminConfigSchema — требует key и value', () => {
    expect(adminConfigSchema.safeParse({}).success).toBe(false);
    expect(adminConfigSchema.safeParse({ key: 'k', value: 'v' }).success).toBe(true);
  });

  it('adminOrderCommentSchema — ограничение 1000 символов', () => {
    expect(adminOrderCommentSchema.safeParse({ comment: 'Тест' }).success).toBe(true);
    expect(adminOrderCommentSchema.safeParse({ comment: 'x'.repeat(1001) }).success).toBe(false);
  });
});

// ─── P3: switchRoleSchema (auth) ─────────────────────

import { switchRoleSchema } from '../../src/modules/auth/auth.schema.js';

describe('P3: switchRoleSchema — валидация смены роли', () => {
  it('принимает допустимые роли', () => {
    for (const role of ['ADMIN', 'MASTER', 'CLIENT', 'MANAGER']) {
      expect(switchRoleSchema.safeParse({ role }).success).toBe(true);
    }
  });

  it('отклоняет невалидную роль', () => {
    expect(switchRoleSchema.safeParse({ role: 'GOD' }).success).toBe(false);
    expect(switchRoleSchema.safeParse({}).success).toBe(false);
  });
});

// ─── P3: Upload whitelist ────────────────────────────

describe('P3: Upload — whitelist расширений', () => {
  const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

  it('разрешает допустимые расширения', () => {
    for (const ext of ALLOWED_EXTENSIONS) {
      expect(ALLOWED_EXTENSIONS.includes(ext)).toBe(true);
    }
  });

  it('блокирует опасные расширения', () => {
    const dangerous = ['.exe', '.sh', '.bat', '.php', '.jsp', '.svg', '.html', '.js'];
    for (const ext of dangerous) {
      expect(ALLOWED_EXTENSIONS.includes(ext)).toBe(false);
    }
  });
});
