// ============================================
// MasterUz — Chat Moderation Utility
// Автоматическая фильтрация запрещённых фраз
// Защита от обхода комиссии
// ============================================

// Запрещённые фразы (обход комиссии, контактные данные, мат)
const BANNED_PHRASES: Array<{ pattern: RegExp; reason: string; severity: 'warning' | 'block' | 'flag' }> = [
  // ─── Обход комиссии ────────────────────
  { pattern: /давай\s*напрямую/i, reason: 'Попытка обхода комиссии', severity: 'flag' },
  { pattern: /без\s*комиссии/i, reason: 'Попытка обхода комиссии', severity: 'flag' },
  { pattern: /напрямую/i, reason: 'Попытка обхода комиссии', severity: 'flag' },
  { pattern: /мимо\s*приложени/i, reason: 'Попытка обхода комиссии', severity: 'flag' },
  { pattern: /мимо\s*платформ/i, reason: 'Попытка обхода комиссии', severity: 'flag' },
  { pattern: /вне\s*приложени/i, reason: 'Попытка обхода комиссии', severity: 'flag' },
  { pattern: /наличк/i, reason: 'Упоминание наличного расчёта', severity: 'flag' },
  { pattern: /кэшом/i, reason: 'Упоминание наличного расчёта', severity: 'flag' },
  { pattern: /нал(ом|ичными)?/i, reason: 'Упоминание наличного расчёта', severity: 'warning' },

  // ─── Обмен контактами ──────────────────
  { pattern: /скинь\s*(номер|телефон|контакт|ник)/i, reason: 'Запрос контактных данных', severity: 'flag' },
  { pattern: /дай\s*(номер|телефон|контакт|ник)/i, reason: 'Запрос контактных данных', severity: 'flag' },
  { pattern: /мой\s*(номер|телефон|ник|тг|телеграм)/i, reason: 'Передача контактных данных', severity: 'flag' },
  { pattern: /(пишите|пиши|напиши(те)?|написать)\s*(мне|в)?\s*(в\s*)?(личк|лс|директ|телеграм|тг|вайбер|whats|вотсап|ватсап|инст)/i, reason: 'Призыв уйти в личные сообщения', severity: 'flag' },
  { pattern: /\bв\s*личк[уе]\b/i, reason: 'Призыв уйти в личные сообщения', severity: 'flag' },
  { pattern: /\bв\s*лс\b/i, reason: 'Призыв уйти в личные сообщения', severity: 'flag' },
  { pattern: /\bпо\s*тг\b/i, reason: 'Призыв уйти в Telegram', severity: 'flag' },
  { pattern: /позвони\s*мне/i, reason: 'Запрос контактных данных', severity: 'warning' },
  { pattern: /встретимся/i, reason: 'Попытка договориться вне платформы', severity: 'warning' },
  { pattern: /давай\s*встретимся/i, reason: 'Попытка договориться вне платформы', severity: 'flag' },
  { pattern: /вотсап|whatsapp|ватсап|вайбер|viber|инстаграм|instagram/i, reason: 'Упоминание сторонних мессенджеров', severity: 'flag' },
  { pattern: /телеграм|telegram|тг\s*чат|\bтг\b/i, reason: 'Упоминание сторонних мессенджеров', severity: 'flag' },
  // Никнейм Telegram/Instagram: @username (4+ символов)
  { pattern: /(?:^|[^\w])@[a-zA-Z0-9_]{4,32}\b/i, reason: 'Передача никнейма', severity: 'flag' },
  // Ссылки на мессенджеры
  { pattern: /\b(?:t\.me|telegram\.me|wa\.me|api\.whatsapp\.com)\b/i, reason: 'Ссылка на сторонний мессенджер', severity: 'flag' },

  // ─── Телефонные номера ─────────────────
  { pattern: /\+?\d{3}[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/i, reason: 'Передача номера телефона', severity: 'flag' },
  { pattern: /\b\d{9,12}\b/i, reason: 'Подозрительная последовательность цифр (возможно номер)', severity: 'warning' },

  // ─── Мат и оскорбления (базовые) ──────
  { pattern: /\bбля[дт]ь?\b/i, reason: 'Нецензурная лексика', severity: 'block' },
  { pattern: /\bсука?\b/i, reason: 'Нецензурная лексика', severity: 'block' },
  { pattern: /\bпизд/i, reason: 'Нецензурная лексика', severity: 'block' },
  { pattern: /\bхуй/i, reason: 'Нецензурная лексика', severity: 'block' },
  { pattern: /\bебать?\b/i, reason: 'Нецензурная лексика', severity: 'block' },
  { pattern: /\bеба[лн]/i, reason: 'Нецензурная лексика', severity: 'block' },
  { pattern: /\bмудак/i, reason: 'Оскорбление', severity: 'block' },
  { pattern: /\bдебил/i, reason: 'Оскорбление', severity: 'block' },
  { pattern: /\bидиот/i, reason: 'Оскорбление', severity: 'block' },
  { pattern: /\bтвар[ьи]/i, reason: 'Оскорбление', severity: 'block' },
  { pattern: /\bурод/i, reason: 'Оскорбление', severity: 'block' },
  { pattern: /\bлох/i, reason: 'Оскорбление', severity: 'warning' },

  // ─── Узбекский мат ────────────────────
  { pattern: /\bsikdir\b/i, reason: 'Нецензурная лексика (уз)', severity: 'block' },
  { pattern: /\bqo['']taq\b/i, reason: 'Нецензурная лексика (уз)', severity: 'block' },
];

export interface ModerationResult {
  isClean: boolean;
  isFlagged: boolean;
  isBlocked: boolean;
  reasons: string[];
  severity: 'clean' | 'warning' | 'block' | 'flag';
}

/**
 * Проверяет текст сообщения на запрещённые фразы
 */
export function moderateMessage(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return { isClean: true, isFlagged: false, isBlocked: false, reasons: [], severity: 'clean' };
  }

  const reasons: string[] = [];
  let maxSeverity: 'clean' | 'warning' | 'block' | 'flag' = 'clean';
  const severityOrder = { clean: 0, warning: 1, flag: 2, block: 3 };

  for (const rule of BANNED_PHRASES) {
    if (rule.pattern.test(text)) {
      reasons.push(rule.reason);
      if (severityOrder[rule.severity] > severityOrder[maxSeverity]) {
        maxSeverity = rule.severity;
      }
    }
  }

  return {
    isClean: maxSeverity === 'clean',
    isFlagged: maxSeverity === 'flag' || maxSeverity === 'warning',
    isBlocked: maxSeverity === 'block',
    reasons,
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
