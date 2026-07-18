import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface SubscribeCardFormProps {
  onSuccess?: (token?: string) => void;
}

// Привязка карты по протоколу Payme Subscribe API (Cards):
//   1) cards.create        — создаём токен (номер + срок, БЕЗ CVV)
//   2) cards.get_verify_code — Payme шлёт SMS-код на номер владельца
//   3) cards.verify        — подтверждаем код → карта готова к оплате
// После подтверждения токен сохраняется на бэкенде (/cards).
export function SubscribeCardForm({ onSuccess }: SubscribeCardFormProps) {
  const [step, setStep] = useState<'card' | 'code'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [sentInfo, setSentInfo] = useState<{ phone?: string }>({});
  const [loading, setLoading] = useState(false);

  async function rpc(method: string, params: any) {
    const res = await axios.post('/api/payments/subscribe/rpc', { method, params });
    return res.data?.data?.result;
  }

  // Шаг 1 — создать токен и запросить SMS-код
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const pan = cardNumber.replace(/\s+/g, '');
    const mm = expMonth.padStart(2, '0');
    const yy = expYear.slice(-2).padStart(2, '0');

    if (pan.length < 16 || mm.length !== 2 || yy.length !== 2) {
      toast.error('Проверьте номер карты и срок действия');
      return;
    }

    setLoading(true);
    try {
      // Payme ожидает expire в формате "MMYY"
      const created = await rpc('cards.create', { card: { number: pan, expire: `${mm}${yy}` }, save: true });
      const cardToken = created?.card?.token;
      if (!cardToken) {
        toast.error('Не удалось создать токен карты');
        return;
      }
      setToken(cardToken);

      const sent = await rpc('cards.get_verify_code', { token: cardToken });
      setSentInfo({ phone: sent?.phone });
      setStep('code');
      toast.success(sent?.phone ? `Код отправлен на ${sent.phone}` : 'SMS-код отправлен');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error?.message || 'Ошибка привязки карты');
    } finally {
      setLoading(false);
    }
  }

  // Шаг 2 — подтвердить SMS-код и сохранить карту
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code) {
      toast.error('Введите код из SMS');
      return;
    }
    setLoading(true);
    try {
      const verified = await rpc('cards.verify', { token, code });
      const card = verified?.card;
      if (!card?.verify) {
        toast.error('Карта не подтверждена');
        return;
      }

      // Сохраняем подтверждённый токен на бэкенде
      const pan = cardNumber.replace(/\s+/g, '');
      await axios.post('/api/payments/subscribe/cards', {
        token,
        lastFour: pan.slice(-4),
        expiryMonth: Number(expMonth),
        expiryYear: Number(`20${expYear.slice(-2)}`),
      });

      toast.success('Карта успешно привязана');
      onSuccess?.(token);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error?.message || 'Неверный код');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white';

  if (step === 'code') {
    return (
      <form onSubmit={handleVerify} className="space-y-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {sentInfo.phone ? `Введите код из SMS, отправленного на ${sentInfo.phone}` : 'Введите код из SMS'}
        </p>
        <input
          placeholder="SMS-код"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          maxLength={6}
          inputMode="numeric"
          className={inputCls}
        />
        <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors">
          {loading ? 'Проверка...' : 'Подтвердить'}
        </button>
        <button type="button" onClick={() => setStep('card')} className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
          ← Изменить карту
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCreate} className="space-y-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Номер карты</label>
        <input
          placeholder="8600 1234 5678 9012"
          value={cardNumber}
          onChange={e => setCardNumber(e.target.value)}
          maxLength={19}
          inputMode="numeric"
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Месяц (MM)</label>
          <input placeholder="MM" value={expMonth} onChange={e => setExpMonth(e.target.value.replace(/\D/g, ''))} maxLength={2} inputMode="numeric" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Год (YY)</label>
          <input placeholder="YY" value={expYear} onChange={e => setExpYear(e.target.value.replace(/\D/g, ''))} maxLength={2} inputMode="numeric" className={inputCls} />
        </div>
      </div>
      <p className="text-xs text-gray-400">Payme подтвердит карту по SMS. CVV не требуется.</p>
      <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors">
        {loading ? 'Обработка...' : 'Привязать карту'}
      </button>
    </form>
  );
}

export default SubscribeCardForm;
