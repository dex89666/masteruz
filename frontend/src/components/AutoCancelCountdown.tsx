// ============================================
// MasterUz — Auto-Cancel Countdown Badge
// Подсвечивает заказы PUBLISHED, приближающиеся к авто-отмене.
// ============================================

import { useEffect, useState } from 'react';
import { Flame, Clock } from 'lucide-react';
import { useTranslation } from '../i18n';

interface Props {
  /** ISO-таймстамп момента авто-отмены */
  autoCancelAt?: string | null;
  /** Компактный режим — для карточек в списке */
  compact?: boolean;
}

interface Tone {
  cls: string;
  Icon: typeof Clock;
  pulse: boolean;
}

/** Подбираем цвет/иконку по часам до авто-отмены */
function pickTone(hoursLeft: number): Tone {
  if (hoursLeft <= 6)  return { cls: 'bg-red-500 text-white border-red-600',                           Icon: Flame, pulse: true  };
  if (hoursLeft <= 12) return { cls: 'bg-orange-500 text-white border-orange-600',                     Icon: Flame, pulse: true  };
  if (hoursLeft <= 24) return { cls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700', Icon: Clock, pulse: false };
  return                       { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800', Icon: Clock, pulse: false };
}

function formatLeft(ms: number, t: (k: string, p?: Record<string, string | number>) => string): { label: string; hoursLeft: number } {
  if (ms <= 0) return { label: t('autoCancel.cancelling'), hoursLeft: 0 };
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return { label: t('autoCancel.min', { m }), hoursLeft: 0 };
  if (h < 24)  return { label: t('autoCancel.hMin', { h, m: m.toString().padStart(2, '0') }), hoursLeft: h };
  const d = Math.floor(h / 24);
  const restH = h % 24;
  return { label: t('autoCancel.dH', { d, h: restH }), hoursLeft: h };
}

export function AutoCancelCountdown({ autoCancelAt, compact = false }: Props) {
  const { t, locale } = useTranslation();
  const [, tick] = useState(0);

  useEffect(() => {
    if (!autoCancelAt) return;
    // Обновляем раз в минуту — хватит для UX, не нагружает CPU
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [autoCancelAt]);

  if (!autoCancelAt) return null;

  const ms = new Date(autoCancelAt).getTime() - Date.now();
  const { label, hoursLeft } = formatLeft(ms, t);
  const { cls, Icon, pulse } = pickTone(hoursLeft);

  return (
    <span
      title={t('autoCancel.at', { time: new Date(autoCancelAt).toLocaleString(locale) })}
      className={[
        'inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap',
        compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        pulse ? 'animate-pulse shadow-sm' : '',
        cls,
      ].join(' ')}
    >
      <Icon size={compact ? 10 : 12} />
      {hoursLeft <= 12 ? t('autoCancel.burnsIn', { label }) : t('autoCancel.until', { label })}
    </span>
  );
}

export default AutoCancelCountdown;
