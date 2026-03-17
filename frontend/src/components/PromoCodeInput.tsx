// ============================================
// MasterUz — PromoCodeInput (ввод промокода на оформлении заказа)
// ============================================

import { useState } from 'react';
import { Tag, X, Loader2 } from 'lucide-react';
import { promoApi } from '../api/client';
import { useTranslation } from '../i18n';
import toast from 'react-hot-toast';
import type { PromoValidation } from '../types';

interface PromoCodeInputProps {
  orderPrice: number;
  onApplied: (promo: PromoValidation | null) => void;
}

export function PromoCodeInput({ orderPrice, onApplied }: PromoCodeInputProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [applied, setApplied] = useState<PromoValidation | null>(null);

  async function handleValidate() {
    if (!code.trim()) return;
    setValidating(true);
    try {
      const res = await promoApi.validate(code.trim(), orderPrice);
      const promo = res.data.data;
      setApplied(promo);
      onApplied(promo);
      toast.success(`${t('promo.applied')}: ${promo.description}`);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || t('promo.invalid');
      toast.error(msg);
      setApplied(null);
      onApplied(null);
    }
    setValidating(false);
  }

  function handleRemove() {
    setApplied(null);
    setCode('');
    onApplied(null);
  }

  if (applied) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl ring-1 ring-green-200">
        <Tag size={16} className="text-green-600" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-700">{applied.code}</p>
          <p className="text-xs text-green-600">{applied.description}</p>
        </div>
        <span className="text-sm font-bold text-green-700">
          -{applied.calculatedDiscount.toLocaleString('ru')} {t('common.currency')}
        </span>
        <button onClick={handleRemove} className="p-1 hover:bg-green-100 rounded-full">
          <X size={14} className="text-green-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t('promo.placeholder')}
          className="input pl-9 py-2 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
        />
      </div>
      <button
        onClick={handleValidate}
        disabled={!code.trim() || validating}
        className="btn-primary py-2 px-4 text-sm"
      >
        {validating ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          t('promo.apply')
        )}
      </button>
    </div>
  );
}
