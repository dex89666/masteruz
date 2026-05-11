// ============================================
// MasterUz — Customer Risk Badge
// Показывает мастеру риск-скор клиента 0..100
// ============================================

import { Shield, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';

type RiskBand = 'low' | 'normal' | 'caution' | 'high';

interface Props {
  risk: { score: number; band: RiskBand };
  size?: 'sm' | 'md';
}

const PRESET: Record<RiskBand, { icon: any; cls: string; label: string; hint: string }> = {
  low: {
    icon: CheckCircle2,
    cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    label: 'Надёжный',
    hint: 'Клиент с хорошей историей — низкий риск отмены.',
  },
  normal: {
    icon: Shield,
    cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    label: 'Обычный',
    hint: 'Стандартный профиль клиента.',
  },
  caution: {
    icon: AlertTriangle,
    cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    label: 'Осторожно',
    hint: 'У клиента есть отмены или жалобы. Рекомендуем уточнять детали заранее.',
  },
  high: {
    icon: AlertOctagon,
    cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
    label: 'Высокий риск',
    hint: 'Много отмен или конфликтных ситуаций. Подумайте дважды перед принятием.',
  },
};

export function ClientRiskBadge({ risk, size = 'sm' }: Props) {
  const p = PRESET[risk.band] ?? PRESET.normal;
  const Icon = p.icon;
  const px = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${px} font-semibold rounded-full border ${p.cls}`}
      title={`${p.hint} (риск-скор: ${risk.score}/100)`}
    >
      <Icon size={size === 'md' ? 16 : 14} />
      {p.label}
      <span className="opacity-70 font-normal">· {risk.score}</span>
    </span>
  );
}

export default ClientRiskBadge;
