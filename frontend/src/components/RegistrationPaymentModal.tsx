// ============================================
// MasterUz — Registration Fee Payment Modal
// Модалка оплаты регистрационного взноса мастера (400 000 сум)
// ============================================

import { useState } from 'react';
import { paymentsApi } from '../api/client';
import { useTranslation } from '../i18n';
import {
  X, CreditCard, Smartphone, Star,
  CheckCircle, Loader2, Shield,
  UserCheck, ShieldCheck, TrendingUp, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface RegistrationPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Provider = 'CLICK' | 'PAYME' | 'TELEGRAM_STARS';

const providers: { id: Provider; name: string; icon: any; color: string; desc: string }[] = [
  {
    id: 'CLICK',
    name: 'Click',
    icon: CreditCard,
    color: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    desc: 'Uzcard / Humo',
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
    desc: 'Telegram Stars ⭐',
  },
];

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
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [processing, setProcessing] = useState(false);

  if (!isOpen) return null;

  async function handlePay() {
    if (!selectedProvider) {
      toast.error(t('becomeMasterPage.selectProvider'));
      return;
    }

    setProcessing(true);
    try {
      const response = await paymentsApi.createRegistrationFee(selectedProvider);
      const { paymentData } = response.data.data;

      if (selectedProvider === 'TELEGRAM_STARS') {
        toast.success(t('becomeMasterPage.regFeeSuccess'));
        onSuccess();
        onClose();
      } else if (paymentData?.url) {
        window.open(paymentData.url, '_blank');
        toast.success(t('becomeMasterPage.regFeeRedirected'));
        onClose();
      } else {
        toast.success(t('becomeMasterPage.regFeeProcessing'));
        onClose();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
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
              💰 {t('becomeMasterPage.regFeeReason4')}
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

          {/* Provider selection */}
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('becomeMasterPage.selectProvider')}
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
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400'
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
                    <CheckCircle size={20} className="text-green-500 dark:text-green-400" />
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

          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={!selectedProvider || processing}
            className="w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-200 dark:shadow-green-900/30"
          >
            {processing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('becomeMasterPage.regFeeProcessing')}
              </>
            ) : (
              <>
                <CreditCard size={18} />
                {t('becomeMasterPage.regFeePayBtn')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
