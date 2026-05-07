// ============================================
// MasterUz — Auto-Cancel Countdown Badge
// Подсвечивает заказы PUBLISHED, приближающиеся к авто-отмене.
// ============================================

import { useEffect, useState } from 'react';
import { Flame, Clock } from 'lucide-react';

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

function formatLeft(ms: number): { label: string; hoursLeft: number } {
  if (ms <= 0) return { label: 'отмена…', hoursLeft: 0 };
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return { label: `${m} мин`, hoursLeft: 0 };
  if (h < 24)  return { label: `${h} ч ${m.toString().padStart(2, '0')} мин`, hoursLeft: h };
  const d = Math.floor(h / 24);
  const restH = h % 24;
  return { label: `${d} д ${restH} ч`, hoursLeft: h };
}

export function AutoCancelCountdown({ autoCancelAt, compact = false }: Props) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!autoCancelAt) return;
    // Обновляем раз в минуту — хватит для UX, не нагружает CPU
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [autoCancelAt]);

  if (!autoCancelAt) return null;

  const ms = new Date(autoCancelAt).getTime() - Date.now();
  const { label, hoursLeft } = formatLeft(ms);
  const { cls, Icon, pulse } = pickTone(hoursLeft);

  return (
    <span
      title={`Авто-отмена в ${new Date(autoCancelAt).toLocaleString('ru')}`}
      className={[
        'inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap',
        compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        pulse ? 'animate-pulse shadow-sm' : '',
        cls,
      ].join(' ')}
    >
      <Icon size={compact ? 10 : 12} />
      {hoursLeft <= 12 ? `Сгорает через ${label}` : `До авто-отмены ${label}`}
    </span>
  );
}

export default AutoCancelCountdown;
