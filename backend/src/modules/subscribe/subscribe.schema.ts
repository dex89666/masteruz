import { z } from 'zod';

// Разрешённые методы Payme Subscribe API (Cards + Receipts), которые можно
// проксировать. Только реальные методы протокола Payme.
export const SUBSCRIBE_ALLOWED_METHODS = [
  'cards.create',
  'cards.get_verify_code',
  'cards.verify',
  'cards.check',
  'cards.remove',
  'receipts.create',
  'receipts.pay',
] as const;

export const subscribeRpcSchema = z.object({
  method: z.enum(SUBSCRIBE_ALLOWED_METHODS),
  params: z.any(),
});

export type SubscribeRpcPayload = z.infer<typeof subscribeRpcSchema>;
