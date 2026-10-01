// ============================================
// MasterUz — Что из заказа можно отдать наружу
// GET /orders и /orders/:id открыты без входа (optionalAuth).
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>;

// Служебные поля аккаунта — чужому пользователю не нужны никогда
const ACCOUNT_FIELDS = [
  'telegramId', 'balance', 'referralCode', 'referredById', 'riskScore', 'riskUpdatedAt',
  'riskFactors', 'warningCount', 'blockedUntil', 'lastWarningAt', 'language',
] as const;

function stripAccount(user: AnyRecord | null | undefined): void {
  if (!user) return;
  for (const k of ACCOUNT_FIELDS) delete user[k];
}

/** Для любого запросившего: убирает служебные поля клиента, мастера и откликнувшихся. */
export function stripOrderAccounts<T extends AnyRecord>(order: T): T {
  stripAccount(order.client);
  stripAccount(order.master);
  order.responses?.forEach((r: AnyRecord) => stripAccount(r.master));
  delete (order as AnyRecord).embedding;
  delete (order as AnyRecord).adminComment;
  return order;
}

function publicPerson(user: AnyRecord | null | undefined): AnyRecord | null {
  if (!user) return null;
  return {
    id: user.id,
    profile: user.profile && { firstName: user.profile.firstName, avatarUrl: user.profile.avatarUrl },
  };
}

// Точное местоположение — только вошедшим: гостю хватает города и района
const LOCATION_FIELDS = [
  'address', 'street', 'latitude', 'longitude', 'masterLat', 'masterLng', 'masterLocationAt',
] as const;

/** Для гостя без входа: без адреса и координат, люди — только имя и аватар. */
export function toAnonymousOrder(order: AnyRecord): AnyRecord {
  const out: AnyRecord = { ...stripOrderAccounts(order) };
  for (const k of LOCATION_FIELDS) delete out[k];
  out.client = publicPerson(order.client);
  if ('master' in order) out.master = publicPerson(order.master);
  if (order.responses) out.responses = undefined;
  return out;
}
