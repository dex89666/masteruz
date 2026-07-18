import { useEffect, useState } from 'react';
import { api, paymentsApi } from '../api/client';
import toast from 'react-hot-toast';

interface SavedCardsListProps {
  orderId: string;
  commissionAmount: number;
  onPaid: () => void;
}

export default function SavedCardsList({ orderId, commissionAmount, onPaid }: SavedCardsListProps) {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchCards() {
    try {
      const res = await api.get('/payments/subscribe/cards');
      setCards(res.data?.data || []);
    } catch (err) {
      // noop
    }
  }

  useEffect(() => { fetchCards(); }, []);

  async function handleQuickPay(cardToken: string) {
    setLoading(true);
    try {
      // Создать платёж за комиссию
      const resp = await paymentsApi.create(orderId, 'PAYME');
      const payment = resp.data?.data?.payment;
      if (!payment) throw new Error('Payment creation failed');

      const charge = await api.post('/payments/subscribe/charge', { paymentId: payment.id, cardToken });
      if (charge.data?.success) {
        toast.success('Платёж успешно выполнен');
        onPaid();
      } else {
        toast.error(charge.data?.error || 'Ошибка при списании');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  if (!cards.length) return null;

  return (
    <div className="space-y-2">
      {cards.map((c) => (
        <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <div className="font-medium">**** **** **** {c.lastFour}</div>
            <div className="text-xs text-gray-500">{c.brand || 'Card'} · {c.expiryMonth}/{String(c.expiryYear).slice(-2)}</div>
          </div>
          <div className="flex items-center gap-2">
            {c.isDefault && <span className="text-xs text-green-600">Default</span>}
            <button
              onClick={() => handleQuickPay(c.token)}
              disabled={loading}
              className="px-3 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Обработка...' : `Оплатить ${commissionAmount / 100000} сум`}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
