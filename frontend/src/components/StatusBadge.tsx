// ============================================
// MasterUz — Status Badge Component
// Унифицированный бейдж статуса заказа
// ============================================

import { useTranslation } from '../i18n';

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  PUBLISHED: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  IN_PROGRESS: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
  COMPLETED: { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  CANCELLED: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  PENDING: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-400', dot: 'bg-gray-500' },
  ASSIGNED: { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  REVIEWING: { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export function StatusBadge({ status, size = 'sm', pulse = false }: StatusBadgeProps) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;

  const statusLabel = t(`orderStatus.${status.toUpperCase()}`) || status;

  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-0.5 text-xs'
    : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${pulse ? 'animate-pulse' : ''}`} />
      {statusLabel}
    </span>
  );
}
