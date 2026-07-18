// ============================================
// MasterUz — Orders Validation Schemas
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { z } from 'zod';

export const createOrderSchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  price: z.number().positive('Цена должна быть больше 0'),
  priceMax: z.number().positive().optional(),
  taskIds: z.array(z.string().uuid()).optional(), // Выбранные задачи
  isUrgent: z.boolean().optional().default(false), // Срочный заказ (+40%)
  images: z.array(z.string().max(2_000_000)).max(10).optional(), // URL или base64 data URL фото
  offerAccepted: z.boolean().refine(val => val === true, { message: 'Необходимо принять условия оферты' }),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address: z.string().max(200).optional(),
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  deadline: z.string().datetime().optional(),
});

export const updateOrderSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).max(2000).optional(),
  price: z.number().positive().optional(),
  deadline: z.string().datetime().optional(),
});

export const orderResponseSchema = z.object({
  priceOffer: z.number().positive().optional(),
  message: z.string().max(500).optional(),
});

export const listOrdersSchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  status: z.string().optional(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  isUrgent: z.string().optional(), // 'true' / 'false'
  minPrice: z.string().transform(Number).optional(),
  maxPrice: z.string().transform(Number).optional(),
  latitude: z.string().transform(Number).optional(),
  longitude: z.string().transform(Number).optional(),
  radius: z.string().transform(Number).optional(), // в км
  sortBy: z.enum(['created_at', 'price', 'distance']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const assignMasterSchema = z.object({
  masterId: z.string().uuid(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'IN_TRANSIT', 'IN_PROGRESS']),
  // Текущие координаты мастера — для геофенс-проверки при IN_PROGRESS
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  // Подтверждение выезда (используется только при ACCEPTED → IN_TRANSIT)
  transitReason: z.enum(['MATERIAL', 'TO_CLIENT']).optional(),
  etaMinutes: z.number().int().min(5).max(480).optional(), // 5 мин — 8 часов
});

export const masterLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).max(500).optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const disputeOrderSchema = z.object({
  reason: z.string().min(10, 'Минимум 10 символов').max(500),
});

export const resolveDisputeSchema = z.object({
  resolution: z.enum(['refund_client', 'pay_master', 'split']),
  note: z.string().max(1000).optional(),
  falseDispute: z.boolean().optional(), // true → списать штраф клиенту за ложный спор
});

export const submitRemainderSchema = z.object({
  method: z.enum(['CASH', 'CARD']),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type SubmitRemainderInput = z.infer<typeof submitRemainderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderResponseInput = z.infer<typeof orderResponseSchema>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;

// ─── Изменение цены по ходу работ ─────────────
export const proposePriceChangeSchema = z.object({
  newPrice: z.number().positive('Цена должна быть больше 0'),
  reason: z.string().min(5, 'Опишите причину изменения').max(1000),
  photos: z.array(z.string().max(2_000_000)).max(10).optional(),
});

export const proposeSettlementSchema = z.object({
  completedAmount: z.number().min(0, 'Сумма не может быть отрицательной'),
  reason: z.string().min(5, 'Опишите выполненные работы').max(1000),
  photos: z.array(z.string().max(2_000_000)).max(10).optional(),
});

export const rejectPriceChangeSchema = z.object({
  comment: z.string().max(1000).optional(),
});

export const moderatePriceChangeSchema = z.object({
  approve: z.boolean(),
  note: z.string().max(1000).optional(),
});
