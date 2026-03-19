// ============================================
// MasterUz — Order Timeline Component (Антифрод)
// Горизонтальный прогресс-бар + вертикальный таймлайн
// PUBLISHED → ACCEPTED → IN_TRANSIT → IN_PROGRESS → COMPLETED
// ============================================

import {
  CheckCircle,
  Circle,
  Clock,
  Wrench,
  Truck,
  ThumbsUp,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useTranslation } from '../i18n';

interface OrderTimelineProps {
  orderStatus: string;
  createdAt?: string;
  acceptedAt?: string;
  inTransitAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  masterConfirmedAt?: string;
  clientConfirmedAt?: string;
}

const statusIcons: Record<string, any> = {
  PUBLISHED: Clock,
  ACCEPTED: ThumbsUp,
  IN_TRANSIT: Truck,
  IN_PROGRESS: Wrench,
  COMPLETED: CheckCircle,
};

const stepColors: Record<string, { active: string; completed: string; bar: string }> = {
  PUBLISHED: { active: 'bg-blue-500', completed: 'bg-blue-500', bar: 'bg-blue-500' },
  ACCEPTED: { active: 'bg-indigo-500', completed: 'bg-indigo-500', bar: 'bg-indigo-500' },
  IN_TRANSIT: { active: 'bg-purple-500', completed: 'bg-purple-500', bar: 'bg-purple-500' },
  IN_PROGRESS: { active: 'bg-amber-500', completed: 'bg-amber-500', bar: 'bg-amber-500' },
  COMPLETED: { active: 'bg-green-500', completed: 'bg-green-500', bar: 'bg-green-500' },
};

export function OrderTimeline({
  orderStatus,
  masterConfirmedAt,
  clientConfirmedAt,
}: OrderTimelineProps) {
  const { t } = useTranslation();

  const allSteps = [
    { status: 'PUBLISHED', label: t('orderStatus.PUBLISHED'), icon: '' },
    { status: 'ACCEPTED', label: t('orderStatus.ACCEPTED'), icon: '' },
    { status: 'IN_TRANSIT', label: t('orderStatus.IN_TRANSIT'), icon: '' },
    { status: 'IN_PROGRESS', label: t('orderStatus.IN_PROGRESS'), icon: '' },
    { status: 'COMPLETED', label: t('orderStatus.COMPLETED'), icon: '' },
  ];

  const statusOrder = ['DRAFT', 'PUBLISHED', 'ACCEPTED', 'IN_TRANSIT', 'IN_PROGRESS', 'COMPLETED'];
  const currentIndex = statusOrder.indexOf(orderStatus);

  // Для отменённых
  if (orderStatus === 'CANCELLED') {
    return (
      <div className="card">
        <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
            <XCircle size={20} className="text-red-500 dark:text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400">{t('orderStatus.CANCELLED')}</p>
            <p className="text-xs text-red-500 dark:text-red-400/80">{t('timeline.cancelledDesc')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Для споров
  if (orderStatus === 'DISPUTED') {
    return (
      <div className="card">
        <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center">
            <AlertTriangle size={20} className="text-orange-500 dark:text-orange-400" />
          </div>
          <div>
            <p className="font-semibold text-orange-700 dark:text-orange-400">{t('orderStatus.DISPUTED')}</p>
            <p className="text-xs text-orange-500 dark:text-orange-400/80">{t('timeline.disputedDesc')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Процент завершения
  const completedSteps = allSteps.filter(step => currentIndex >= statusOrder.indexOf(step.status)).length;
  const progressPercent = Math.round(((completedSteps - 1) / (allSteps.length - 1)) * 100);

  return (
    <div className="card">
      {/* ═══ Горизонтальный прогресс-бар ═══ */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm dark:text-white">{t('timeline.title')}</h3>
          <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{progressPercent}%</span>
        </div>

        {/* Полоса прогресса */}
        <div className="relative h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Шаги — горизонтальный stepper */}
        <div className="flex items-start justify-between relative">
          {/* Линия соединения */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 dark:bg-gray-700 z-0" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 z-0 transition-all duration-700"
            style={{ width: `calc(${progressPercent}% - 32px)` }}
          />

          {allSteps.map((step) => {
            const stepStatusIndex = statusOrder.indexOf(step.status);
            const isCompleted = currentIndex > stepStatusIndex;
            const isActive = currentIndex === stepStatusIndex;
            const Icon = statusIcons[step.status] || Circle;
            const colors = stepColors[step.status];

            return (
              <div key={step.status} className="flex flex-col items-center z-10" style={{ width: `${100 / allSteps.length}%` }}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isCompleted
                      ? `${colors.completed} text-white shadow-sm`
                      : isActive
                        ? `${colors.active} text-white ring-4 ring-${step.status === 'IN_PROGRESS' ? 'amber' : 'primary'}-200 dark:ring-${step.status === 'IN_PROGRESS' ? 'amber' : 'primary'}-900/40 shadow-lg animate-pulse`
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {isCompleted ? <CheckCircle size={16} /> : <Icon size={16} />}
                </div>
                <span className={`text-[10px] mt-1.5 text-center leading-tight font-medium ${
                  isCompleted || isActive ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'
                }`}>
                  {step.icon}
                </span>
                <span className={`text-[9px] text-center leading-tight hidden sm:block ${
                  isCompleted || isActive ? 'text-gray-600 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Индикатор подтверждений (если IN_PROGRESS) */}
      {orderStatus === 'IN_PROGRESS' && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">{t('timeline.confirmations')}</p>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              {masterConfirmedAt
                ? <CheckCircle size={14} className="text-green-500" />
                : <Circle size={14} className="text-gray-300 dark:text-gray-600" />}
              <span className={`text-xs ${masterConfirmedAt ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {t('timeline.masterConfirm')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {clientConfirmedAt
                ? <CheckCircle size={14} className="text-green-500" />
                : <Circle size={14} className="text-gray-300 dark:text-gray-600" />}
              <span className={`text-xs ${clientConfirmedAt ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {t('timeline.clientConfirm')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
