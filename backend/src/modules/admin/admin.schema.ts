import { z } from 'zod';

export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
  role: z.enum(['CLIENT', 'MASTER', 'ADMIN', 'MANAGER']).optional(),
  search: z.string().max(100).optional(),
  isActive: z.coerce.boolean().optional(),
  isVerified: z.coerce.boolean().optional(),
});

export const blockUserSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const changeRoleSchema = z.object({
  role: z.enum(['CLIENT', 'MASTER', 'MANAGER', 'ADMIN']),
});

export const adminBalanceSchema = z.object({
  amount: z.number().positive('Сумма должна быть больше 0'),
  reason: z.string().max(500).optional(),
});

export const adminOrderCommentSchema = z.object({
  comment: z.string().max(1000),
});

export const adminBulkDeleteOrdersSchema = z.object({
  ids: z.array(z.string()).min(1, 'Выберите хотя бы один заказ').max(200),
});

export const adminConfigSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(5000),
  description: z.string().max(500).optional(),
});
