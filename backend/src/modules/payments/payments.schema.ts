import { z } from 'zod';

export const balanceTopupSchema = z.object({
  amount: z.number().positive('Сумма должна быть больше 0').max(100_000_000, 'Максимум 100 000 000'),
  provider: z.enum(['CLICK', 'PAYME', 'TELEGRAM_STARS']),
});

export const registrationFeeSchema = z.object({
  provider: z.enum(['CLICK', 'PAYME', 'TELEGRAM_STARS']),
});

export const telegramStarsSchema = z.object({
  paymentId: z.string().min(1),
  telegramPaymentId: z.string().min(1),
});

export const commissionPaymentSchema = z.object({
  orderId: z.string().uuid(),
  provider: z.enum(['CLICK', 'PAYME', 'TELEGRAM_STARS']),
});
