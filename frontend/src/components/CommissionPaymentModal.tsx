// ============================================
// MasterUz — Commission Payment Modal
// Модалка оплаты комиссии для мастера
// ============================================

import { useState } from 'react';
import { paymentsApi } from '../api/client';
import { useTranslation } from '../i18n';
import { useFormatPrice } from '../hooks';
import {
  X, CreditCard, Smartphone, Star, Zap,
  CheckCircle, Loader2, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CommissionPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orderId: string;
  orderTitle: string;
  commissionAmount: number;
  isUrgent?: boolean;
}

type Provider = 'CLICK' | 'PAYME' | 'TELEGRAM_STARS';

const providers: { id: Provider; name: string; icon: any; color: string; desc: string }[] = [
  {
    id: 'CLICK',
    name: 'Click',
    icon: CreditCard,
    color: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    desc: 'Банковская карта (Uzcard/Humo)',
  },
  {
    id: 'PAYME',
    name: 'Payme',
    icon: Smartphone,
    color: 'bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800',
    desc: 'Payme кошелёк / карта',
  },
  {
    id: 'TELEGRAM_STARS',
    name: 'Telegram Stars',
    icon: Star,
    color: 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
    desc: 'Оплата звёздами Telegram',
  },
];

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
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [processing, setProcessing] = useState(false);

  if (!isOpen) return null;

  async function handlePay() {
    if (!selectedProvider) {
      toast.error(t('commissionPayment.selectProvider'));
      return;
    }

    setProcessing(true);
    try {
      const response = await paymentsApi.create(orderId, selectedProvider);
      const { paymentData } = response.data.data;

      if (selectedProvider === 'TELEGRAM_STARS') {
        // Telegram Stars — оплата прошла сразу
        toast.success(t('commissionPayment.success'));
        onSuccess();
        onClose();
      } else if (paymentData?.url) {
        // Click / Payme — открываем ссылку оплаты
        window.open(paymentData.url, '_blank');
        toast.success(t('commissionPayment.redirected'));
        // Закрываем модалку — webhook обработает результат
        onClose();
      } else {
        toast.success(t('commissionPayment.processing'));
        onClose();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('commissionPayment.error'));
    } finally {
      setProcessing(false);
    }
  }

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

          {/* Provider selection */}
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('commissionPayment.chooseMethod')}
          </p>
          <div className="space-y-2 mb-5">
            {providers.map((provider) => {
              const Icon = provider.icon;
              const isSelected = selectedProvider === provider.id;
              return (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-400'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${provider.color}`}>
                    <Icon size={20} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                      {provider.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {provider.desc}
                    </p>
                  </div>
                  {isSelected && (
                    <CheckCircle size={20} className="text-primary-500 dark:text-primary-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Security note */}
          <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 mb-5 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
            <Shield size={16} className="shrink-0 text-green-500 mt-0.5" />
            <p>{t('commissionPayment.securityNote')}</p>
          </div>

          {/* What happens after */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 mb-5">
            <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
              {t('commissionPayment.afterPayTitle')}
            </p>
            <ul className="text-xs text-green-700 dark:text-green-400 space-y-1">
              <li>✅ {t('commissionPayment.afterPay1')}</li>
              <li>📱 {t('commissionPayment.afterPay2')}</li>
              <li>📍 {t('commissionPayment.afterPay3')}</li>
              <li>💬 {t('commissionPayment.afterPay4')}</li>
            </ul>
          </div>

          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={!selectedProvider || processing}
            className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
              isUrgent
                ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                : 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700'
            }`}
          >
            {processing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('commissionPayment.processing')}
              </>
            ) : (
              <>
                <CreditCard size={18} />
                {t('commissionPayment.payBtn')} {formatPrice(commissionAmount)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
