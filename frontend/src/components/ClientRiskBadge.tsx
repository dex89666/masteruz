// ============================================
// MasterUz — Customer Risk Badge
// Показывает мастеру риск-скор клиента 0..100
// ============================================

import { Shield, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../i18n';

type RiskBand = 'low' | 'normal' | 'caution' | 'high';

interface Props {
  risk: { score: number; band: RiskBand };
  size?: 'sm' | 'md';
}

const PRESET: Record<RiskBand, { icon: any; cls: string; label: string; hint: string }> = {
  low: {
    icon: CheckCircle2,
    cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    label: 'clientRisk.lowLabel',
    hint: 'clientRisk.lowHint',
  },
  normal: {
    icon: Shield,
    cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    label: 'clientRisk.normalLabel',
    hint: 'clientRisk.normalHint',
  },
  caution: {
    icon: AlertTriangle,
    cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    label: 'clientRisk.cautionLabel',
    hint: 'clientRisk.cautionHint',
  },
  high: {
    icon: AlertOctagon,
    cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
    label: 'clientRisk.highLabel',
    hint: 'clientRisk.highHint',
  },
};

export function ClientRiskBadge({ risk, size = 'sm' }: Props) {
  const { t } = useTranslation();
  const p = PRESET[risk.band] ?? PRESET.normal;
  const Icon = p.icon;
  const px = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${px} font-semibold rounded-full border ${p.cls}`}
      title={`${t(p.hint)} (${t('clientRisk.score')}: ${risk.score}/100)`}
    >
      <Icon size={size === 'md' ? 16 : 14} />
      {t(p.label)}
      <span className="opacity-70 font-normal">· {risk.score}</span>
    </span>
  );
}

export default ClientRiskBadge;
