import { z } from 'zod';

export const createWithdrawalSchema = z.object({
  amount: z.number().positive('Сумма должна быть больше 0'),
  cardId: z.string().uuid('Некорректная карта'),
});

export const rejectWithdrawalSchema = z.object({
  reason: z.string().min(3, 'Укажите причину отклонения').max(500),
});

export const completeWithdrawalSchema = z.object({
  adminNote: z.string().max(500).optional(),
});
