// ============================================
// MasterUz — единицы измерения в смете
// В БД единица хранится русским сокращением ('шт', 'м²'…) — это данные,
// их не меняем. Переводим только подпись при показе.
// ============================================

export const ESTIMATE_UNITS = ['шт', 'м', 'м²', 'м³', 'п.м.', 'кг', 'л', 'комплект', 'услуга'] as const;

const UNIT_KEYS: Record<string, string> = {
  'шт': 'units.pcs',
  'м': 'units.m',
  'м²': 'units.m2',
  'м³': 'units.m3',
  'п.м.': 'units.lm',
  'кг': 'units.kg',
  'л': 'units.l',
  'комплект': 'units.set',
  'услуга': 'units.service',
};

/** Подпись единицы на языке пользователя; неизвестную единицу показываем как есть. */
export function unitLabel(unit: string, t: (key: string) => string): string {
  const key = UNIT_KEYS[unit];
  return key ? t(key) : unit;
}
