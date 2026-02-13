// ============================================
// MasterUz — Order Timeline Component (Антифрод)
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

export function OrderTimeline({
  orderStatus,
  masterConfirmedAt,
  clientConfirmedAt,
}: OrderTimelineProps) {
  const { t } = useTranslation();

  const allSteps = [
    { status: 'PUBLISHED', label: t('orderStatus.PUBLISHED'), desc: t('timeline.publishedDesc') },
    { status: 'ACCEPTED', label: t('orderStatus.ACCEPTED'), desc: t('timeline.acceptedDesc') },
    { status: 'IN_TRANSIT', label: t('orderStatus.IN_TRANSIT'), desc: t('timeline.inTransitDesc') },
    { status: 'IN_PROGRESS', label: t('orderStatus.IN_PROGRESS'), desc: t('timeline.inProgressDesc') },
    { status: 'COMPLETED', label: t('orderStatus.COMPLETED'), desc: t('timeline.completedDesc') },
  ];

  const statusOrder = ['DRAFT', 'PUBLISHED', 'ACCEPTED', 'IN_TRANSIT', 'IN_PROGRESS', 'COMPLETED'];
  const currentIndex = statusOrder.indexOf(orderStatus);

  // Для отменённых
  if (orderStatus === 'CANCELLED') {
    return (
      <div className="card">
        <h3 className="font-semibold mb-4 dark:text-white">{t('timeline.title')}</h3>
        <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
            <XCircle size={16} className="text-red-500 dark:text-red-400" />
          </div>
          <div>
            <p className="font-medium text-red-700 dark:text-red-400">{t('orderStatus.CANCELLED')}</p>
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
        <h3 className="font-semibold mb-4 dark:text-white">{t('timeline.title')}</h3>
        <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
          <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center">
            <AlertTriangle size={16} className="text-orange-500 dark:text-orange-400" />
          </div>
          <div>
            <p className="font-medium text-orange-700 dark:text-orange-400">{t('orderStatus.DISPUTED')}</p>
            <p className="text-xs text-orange-500 dark:text-orange-400/80">{t('timeline.disputedDesc')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-semibold mb-4 dark:text-white">{t('timeline.title')}</h3>

      {/* Индикатор подтверждений (если IN_PROGRESS) */}
      {orderStatus === 'IN_PROGRESS' && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
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

      <div className="space-y-0">
        {allSteps.map((step, idx) => {
          const stepStatusIndex = statusOrder.indexOf(step.status);
          const isCompleted = currentIndex >= stepStatusIndex;
          const isActive = currentIndex === stepStatusIndex;
          const isLast = idx === allSteps.length - 1;
          const Icon = statusIcons[step.status] || Circle;

          return (
            <div key={step.status} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    isCompleted
                      ? isActive
                        ? 'bg-primary-600 text-white ring-4 ring-primary-100 dark:ring-primary-900/40'
                        : 'bg-green-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {isCompleted && !isActive ? <CheckCircle size={16} /> : <Icon size={16} />}
                </div>
                {!isLast && (
                  <div className={`w-0.5 h-8 ${
                    isCompleted && currentIndex > stepStatusIndex
                      ? 'bg-green-300 dark:bg-green-700'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </div>
              <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
                <p className={`font-medium text-sm ${isCompleted ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                  {step.label}
                </p>
                <p className={`text-xs mt-0.5 ${isCompleted ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}>
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
