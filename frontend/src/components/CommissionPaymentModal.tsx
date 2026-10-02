// ============================================
// MasterUz — Commission Payment Modal
// Модалка оплаты комиссии для мастера
// Онлайн-оплата — только UzQR (Hamkorbank), пока в подключении
// ============================================

import { useState } from 'react';
import { OnlinePaymentSoon } from './OnlinePaymentSoon';
import { UzQrPaymentModal, UZQR_ENABLED } from './UzQrPaymentModal';
import { useTranslation } from '../i18n';
import { useFormatPrice } from '../hooks';
import { X, CreditCard, Zap, QrCode } from 'lucide-react';

interface CommissionPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orderId: string;
  orderTitle: string;
  commissionAmount: number;
  isUrgent?: boolean;
}

export function CommissionPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  orderId,
  orderTitle,
  commissionAmount,
  isUrgent,
}: CommissionPaymentModalProps) {
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();
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
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isUrgent
                ? 'bg-orange-100 dark:bg-orange-900/30'
                : 'bg-primary-100 dark:bg-primary-900/30'
            }`}>
              {isUrgent ? (
                <Zap size={20} className="text-orange-600 dark:text-orange-400" />
              ) : (
                <CreditCard size={20} className="text-primary-600 dark:text-primary-400" />
              )}
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">
                {t('commissionPayment.title')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                {orderTitle}
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

        {/* Amount */}
        <div className="p-5">
          <div className={`text-center py-4 rounded-xl mb-5 ${
            isUrgent
              ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
              : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
          }`}>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {t('commissionPayment.amountToPay')}
            </p>
            <p className={`text-3xl font-bold ${
              isUrgent ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'
            }`}>
              {formatPrice(commissionAmount)}
            </p>
            {isUrgent && (
              <p className="text-xs text-orange-500 dark:text-orange-400 mt-1 flex items-center justify-center gap-1">
                <Zap size={12} />
                {t('commissionPayment.urgentNote')}
              </p>
            )}
          </div>

          {UZQR_ENABLED ? (
            <button
              onClick={() => setShowQr(true)}
              className="w-full mb-5 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 flex items-center justify-center gap-2"
            >
              <QrCode size={18} /> Оплатить {formatPrice(commissionAmount)} по QR-коду
            </button>
          ) : (
            <OnlinePaymentSoon className="mb-5" />
          )}

          {/* What happens after */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 mb-5">
            <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
              {t('commissionPayment.afterPayTitle')}
            </p>
            <ul className="text-xs text-green-700 dark:text-green-400 space-y-1">
              <li>{t('commissionPayment.afterPay1')}</li>
              <li>{t('commissionPayment.afterPay2')}</li>
              <li>{t('commissionPayment.afterPay3')}</li>
              <li>{t('commissionPayment.afterPay4')}</li>
            </ul>
          </div>

        </div>
      </div>
      <UzQrPaymentModal
        isOpen={showQr}
        purpose={{ type: 'ORDER_COMMISSION', orderId }}
        title={`Комиссия — ${orderTitle}`}
        onClose={() => setShowQr(false)}
        onPaid={onSuccess}
      />
    </div>
  );
}
