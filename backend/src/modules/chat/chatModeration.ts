// ============================================
// MasterUz — Chat Moderation Utility
// Автоматическая фильтрация запрещённых фраз
// Защита от обхода комиссии
// ============================================

// Запрещённые фразы (обход комиссии, контактные данные, мат)
type ModerationCategory =
  | 'bypass'        // обход платформы / комиссии
  | 'contact'       // передача / запрос контактов
  | 'phone'         // номер телефона
  | 'profanity'     // мат и оскорбления
  | 'other';

const CATEGORY_LABEL: Record<ModerationCategory, string> = {
  bypass: 'Обход платформы',
  contact: 'Передача контактов через личные сообщения',
  phone: 'Передача номера телефона',
  profanity: 'Нецензурная лексика',
  other: 'Нарушение правил чата',
};

const BANNED_PHRASES: Array<{
  pattern: RegExp;
  reason: string;
  severity: 'warning' | 'block' | 'flag';
  category: ModerationCategory;
}> = [
  // ─── Обход комиссии ────────────────────
  { pattern: /давай\s*напрямую/i, reason: 'Попытка обхода комиссии', severity: 'flag', category: 'bypass' },
  { pattern: /без\s*комиссии/i, reason: 'Попытка обхода комиссии', severity: 'flag', category: 'bypass' },
  { pattern: /напрямую/i, reason: 'Попытка обхода комиссии', severity: 'flag', category: 'bypass' },
  { pattern: /мимо\s*приложени/i, reason: 'Попытка обхода комиссии', severity: 'flag', category: 'bypass' },
  { pattern: /мимо\s*платформ/i, reason: 'Попытка обхода комиссии', severity: 'flag', category: 'bypass' },
  { pattern: /вне\s*приложени/i, reason: 'Попытка обхода комиссии', severity: 'flag', category: 'bypass' },
  { pattern: /наличк/i, reason: 'Упоминание наличного расчёта', severity: 'flag', category: 'bypass' },
  { pattern: /кэшом/i, reason: 'Упоминание наличного расчёта', severity: 'flag', category: 'bypass' },
  { pattern: /нал(ом|ичными)?/i, reason: 'Упоминание наличного расчёта', severity: 'warning', category: 'bypass' },

  // ─── Обмен контактами ──────────────────
  { pattern: /скинь\s*(номер|телефон|контакт|ник)/i, reason: 'Запрос контактных данных', severity: 'flag', category: 'contact' },
  { pattern: /дай\s*(номер|телефон|контакт|ник)/i, reason: 'Запрос контактных данных', severity: 'flag', category: 'contact' },
  { pattern: /мой\s*(номер|телефон|ник|тг|телеграм)/i, reason: 'Передача контактных данных', severity: 'flag', category: 'contact' },
  { pattern: /(пишите|пиши|напиши(те)?|написать)\s*(мне|в)?\s*(в\s*)?(личк|лс|директ|телеграм|тг|вайбер|whats|вотсап|ватсап|инст)/i, reason: 'Призыв уйти в личные сообщения', severity: 'flag', category: 'contact' },
  { pattern: /\bв\s*личк[уе]\b/i, reason: 'Призыв уйти в личные сообщения', severity: 'flag', category: 'contact' },
  { pattern: /\bв\s*лс\b/i, reason: 'Призыв уйти в личные сообщения', severity: 'flag', category: 'contact' },
  { pattern: /\bпо\s*тг\b/i, reason: 'Призыв уйти в Telegram', severity: 'flag', category: 'contact' },
  { pattern: /позвони\s*мне/i, reason: 'Запрос контактных данных', severity: 'warning', category: 'contact' },
  { pattern: /встретимся/i, reason: 'Попытка договориться вне платформы', severity: 'warning', category: 'bypass' },
  { pattern: /давай\s*встретимся/i, reason: 'Попытка договориться вне платформы', severity: 'flag', category: 'bypass' },
  { pattern: /вотсап|whatsapp|ватсап|вайбер|viber|инстаграм|instagram/i, reason: 'Упоминание сторонних мессенджеров', severity: 'flag', category: 'contact' },
  { pattern: /телеграм|telegram|тг\s*чат|\bтг\b/i, reason: 'Упоминание сторонних мессенджеров', severity: 'flag', category: 'contact' },
  { pattern: /(?:^|[^\w])@[a-zA-Z0-9_]{4,32}\b/i, reason: 'Передача никнейма', severity: 'flag', category: 'contact' },
  { pattern: /\b(?:t\.me|telegram\.me|wa\.me|api\.whatsapp\.com)\b/i, reason: 'Ссылка на сторонний мессенджер', severity: 'flag', category: 'contact' },

  // ─── Телефонные номера ─────────────────
  { pattern: /\+?\d{3}[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/i, reason: 'Передача номера телефона', severity: 'flag', category: 'phone' },
  { pattern: /\b\d{9,12}\b/i, reason: 'Подозрительная последовательность цифр (возможно номер)', severity: 'warning', category: 'phone' },

  // ─── Мат и оскорбления (базовые) ──────
  { pattern: /\bбля[дт]ь?\b/i, reason: 'Нецензурная лексика', severity: 'block', category: 'profanity' },
  { pattern: /\bсука?\b/i, reason: 'Нецензурная лексика', severity: 'block', category: 'profanity' },
  { pattern: /\bпизд/i, reason: 'Нецензурная лексика', severity: 'block', category: 'profanity' },
  { pattern: /\bхуй/i, reason: 'Нецензурная лексика', severity: 'block', category: 'profanity' },
  { pattern: /\bебать?\b/i, reason: 'Нецензурная лексика', severity: 'block', category: 'profanity' },
  { pattern: /\bеба[лн]/i, reason: 'Нецензурная лексика', severity: 'block', category: 'profanity' },
  { pattern: /\bмудак/i, reason: 'Оскорбление', severity: 'block', category: 'profanity' },
  { pattern: /\bдебил/i, reason: 'Оскорбление', severity: 'block', category: 'profanity' },
  { pattern: /\bидиот/i, reason: 'Оскорбление', severity: 'block', category: 'profanity' },
  { pattern: /\bтвар[ьи]/i, reason: 'Оскорбление', severity: 'block', category: 'profanity' },
  { pattern: /\bурод/i, reason: 'Оскорбление', severity: 'block', category: 'profanity' },
  { pattern: /\bлох/i, reason: 'Оскорбление', severity: 'warning', category: 'profanity' },

  // ─── Узбекский мат ────────────────────
  { pattern: /\bsikdir\b/i, reason: 'Нецензурная лексика (уз)', severity: 'block', category: 'profanity' },
  { pattern: /\bqo['']taq\b/i, reason: 'Нецензурная лексика (уз)', severity: 'block', category: 'profanity' },
];

export interface ModerationResult {
  isClean: boolean;
  isFlagged: boolean;
  isBlocked: boolean;
  reasons: string[];
  categories: ModerationCategory[];
  shortLabel: string; // Краткая формулировка нарушения для уведомления автору
  severity: 'clean' | 'warning' | 'block' | 'flag';
}

/**
 * Проверяет текст сообщения на запрещённые фразы
 */
export function moderateMessage(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return {
      isClean: true,
      isFlagged: false,
      isBlocked: false,
      reasons: [],
      categories: [],
      shortLabel: '',
      severity: 'clean',
    };
  }

  const reasons: string[] = [];
  const categories = new Set<ModerationCategory>();
  let maxSeverity: 'clean' | 'warning' | 'block' | 'flag' = 'clean';
  const severityOrder = { clean: 0, warning: 1, flag: 2, block: 3 };

  for (const rule of BANNED_PHRASES) {
    if (rule.pattern.test(text)) {
      reasons.push(rule.reason);
      categories.add(rule.category);
      if (severityOrder[rule.severity] > severityOrder[maxSeverity]) {
        maxSeverity = rule.severity;
      }
    }
  }

  // Приоритет категорий для краткого ярлыка
  const priority: ModerationCategory[] = ['bypass', 'contact', 'phone', 'profanity', 'other'];
  const primary = priority.find((c) => categories.has(c)) ?? 'other';

  return {
    isClean: maxSeverity === 'clean',
    isFlagged: maxSeverity === 'flag' || maxSeverity === 'warning',
    isBlocked: maxSeverity === 'block',
    reasons,
    categories: Array.from(categories),
    shortLabel: CATEGORY_LABEL[primary],
    severity: maxSeverity,
  };
}

/**
 * Заменяет запрещённые слова звёздочками
 */
export function censorMessage(text: string): string {
  let censored = text;
  for (const rule of BANNED_PHRASES) {
    if (rule.severity === 'block') {
      censored = censored.replace(rule.pattern, (match) => '*'.repeat(match.length));
    }
  }
  return censored;
}
