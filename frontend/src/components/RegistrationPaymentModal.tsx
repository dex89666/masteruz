// ============================================
// MasterUz — Registration Fee Payment Modal
// Модалка оплаты регистрационного взноса мастера (400 000 сум)
// Онлайн-оплата — только UzQR (Hamkorbank), пока в подключении
// ============================================

import { useState } from 'react';
import { OnlinePaymentSoon } from './OnlinePaymentSoon';
import { UzQrPaymentModal, UZQR_ENABLED } from './UzQrPaymentModal';
import { useTranslation } from '../i18n';
import { X, Shield, UserCheck, ShieldCheck, TrendingUp, Zap, QrCode } from 'lucide-react';

interface RegistrationPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const reasons = [
  { icon: UserCheck, key: 'regFeeReason1' as const },
  { icon: ShieldCheck, key: 'regFeeReason2' as const },
  { icon: TrendingUp, key: 'regFeeReason3' as const },
  { icon: Zap, key: 'regFeeReason4' as const },
];

export function RegistrationPaymentModal({
  isOpen,
  onClose,
  onSuccess,
}: RegistrationPaymentModalProps) {
  const { t } = useTranslation();
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-100 dark:bg-green-900/30">
              <Shield size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">
                {t('becomeMasterPage.regFeeTitle')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('becomeMasterPage.regFeeDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-5">
          {/* Amount */}
          <div className="text-center py-5 rounded-xl mb-5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 border border-green-200 dark:border-green-800">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {t('becomeMasterPage.regFeeTitle')}
            </p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {t('becomeMasterPage.regFeeAmount')}
            </p>
            <p className="text-xs text-green-600/60 dark:text-green-400/60 mt-1">
                            {t('becomeMasterPage.regFeeReason4')}
            </p>
          </div>

          {/* Why needed */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-5">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3">
              {t('becomeMasterPage.regFeeWhy')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {reasons.map(({ icon: Icon, key }) => (
                <div key={key} className="flex items-start gap-2">
                  <Icon size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {t(`becomeMasterPage.${key}`)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {UZQR_ENABLED ? (
            <button
              onClick={() => setShowQr(true)}
              className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 flex items-center justify-center gap-2"
            >
              <QrCode size={18} /> {t('payQr.payByQr')}
            </button>
          ) : (
            <OnlinePaymentSoon />
          )}
        </div>
      </div>
      <UzQrPaymentModal
        isOpen={showQr}
        purpose={{ type: 'REGISTRATION_FEE' }}
        title={t('payQr.regFeeTitle')}
        onClose={() => setShowQr(false)}
        onPaid={onSuccess}
      />
    </div>
  );
}
