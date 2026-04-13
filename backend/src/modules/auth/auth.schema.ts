// ============================================
// MasterUz — Auth Validation Schemas
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { z } from 'zod';

export const telegramAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

export const telegramMiniAppAuthSchema = z.object({
  initData: z.string().min(1, 'initData обязательно'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken обязателен'),
});

export const switchRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MASTER', 'CLIENT', 'MANAGER']),
});

export type TelegramAuthInput = z.infer<typeof telegramAuthSchema>;
export type TelegramMiniAppAuthInput = z.infer<typeof telegramMiniAppAuthSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
