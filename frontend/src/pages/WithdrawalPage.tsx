// ============================================
// MasterUz — Вывод средств мастером
// ============================================
// Мастер выводит заработанное на привязанную карту.
//
// Важно для UX: сумма списывается с баланса СРАЗУ при подаче заявки,
// а не при одобрении. Пользователь должен узнать об этом до нажатия
// кнопки, иначе увидит «пропавшие» деньги и решит, что это баг.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { withdrawalsApi, cardsApi, balanceApi } from '../api/client';
import { useTranslation } from '../i18n';
import { useFormatPrice } from '../hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  Wallet, CreditCard, Clock, CheckCircle2, XCircle, Loader2,
  AlertTriangle, Plus, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

const MIN_AMOUNT = 50_000; // дублирует дефолт бэкенда; сервер — источник истины

const STATUS_META: Record<string, { key: string; cls: string; Icon: any }> = {
  PENDING:    { key: 'withdrawal.statusPENDING',    cls: 'text-orange-600 dark:text-orange-400', Icon: Clock },
  PROCESSING: { key: 'withdrawal.statusPROCESSING', cls: 'text-blue-600 dark:text-blue-400',     Icon: Loader2 },
  COMPLETED:  { key: 'withdrawal.statusCOMPLETED',  cls: 'text-green-600 dark:text-green-400',   Icon: CheckCircle2 },
  REJECTED:   { key: 'withdrawal.statusREJECTED',   cls: 'text-red-600 dark:text-red-400',       Icon: XCircle },
  CANCELLED:  { key: 'withdrawal.statusCANCELLED',  cls: 'text-gray-500 dark:text-gray-400',     Icon: XCircle },
};

export function WithdrawalPage() {
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();
  const currency = t('common.currency');

  const [balance, setBalance] = useState(0);
  const [cards, setCards] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState('');
  const [cardId, setCardId] = useState('');

  const load = useCallback(async () => {
    try {
      const [bal, cardsRes, reqRes] = await Promise.all([
        balanceApi.getBalance(),
        cardsApi.getAll(),
        withdrawalsApi.myRequests({ limit: 20 }),
      ]);
      setBalance(Number(bal.data?.data?.balance ?? bal.data?.data ?? 0));
      const list = cardsRes.data?.data ?? [];
      setCards(list);
      // Предвыбираем основную карту — меньше действий пользователю.
      if (list.length && !cardId) {
        setCardId((list.find((c: any) => c.isDefault) ?? list[0]).id);
      }
      setRequests(reqRes.data?.data ?? []);
    } catch {
      // Молча: экран не должен падать из-за одного упавшего запроса
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const numeric = Number(amount.replace(/\s/g, '')) || 0;
  // Активная заявка блокирует подачу новой — так же, как на сервере.
  const hasActive = requests.some((r) => r.status === 'PENDING' || r.status === 'PROCESSING');
  const canSubmit = numeric >= MIN_AMOUNT && numeric <= balance && !!cardId && !hasActive;

  async function handleSubmit() {
    if (numeric < MIN_AMOUNT) return toast.error(t('withdrawal.minAmount', { amount: formatPrice(MIN_AMOUNT, currency) }));
    if (numeric > balance) return toast.error(t('withdrawal.errAmount'));
    if (!cardId) return toast.error(t('withdrawal.errCard'));

    setSubmitting(true);
    try {
      await withdrawalsApi.create({ amount: numeric, cardId });
      toast.success(t('withdrawal.created'));
      setAmount('');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('withdrawal.errGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm(t('withdrawal.confirmCancel'))) return;
    try {
      await withdrawalsApi.cancel(id);
      toast.success(t('withdrawal.cancelled'));
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('withdrawal.errGeneric'));
    }
  }

  if (loading) return <LoadingSpinner />;

  const inputCls =
    'w-full px-3 py-2.5 border border-gray-300 rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none';

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Wallet className="w-6 h-6" /> {t('withdrawal.title')}
      </h1>

      {/* Доступный баланс */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 p-5 text-white">
        <p className="text-sm opacity-90">{t('withdrawal.available')}</p>
        <p className="text-3xl font-bold mt-1">{formatPrice(balance, currency)}</p>
      </div>

      {/* Форма подачи */}
      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
          <CreditCard className="w-10 h-10 mx-auto text-gray-400 mb-2" />
          <p className="text-gray-600 dark:text-gray-300 mb-3">{t('withdrawal.noCards')}</p>
          <Link
            to="/cards"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium"
          >
            <Plus className="w-4 h-4" /> {t('withdrawal.addCard')}
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('withdrawal.amount')}
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              placeholder={String(MIN_AMOUNT)}
              inputMode="numeric"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-gray-400">
              {t('withdrawal.minAmount', { amount: formatPrice(MIN_AMOUNT, currency) })}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('withdrawal.card')}
            </label>
            <select value={cardId} onChange={(e) => setCardId(e.target.value)} className={inputCls}>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cardNumber} {c.cardHolder ? `— ${c.cardHolder}` : ''}
                </option>
              ))}
            </select>
          </div>

          {numeric > 0 && (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('withdrawal.toReceive')}</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatPrice(numeric, currency)}
                </span>
              </div>
            </div>
          )}

          {/* Ключевое предупреждение: деньги спишутся сразу */}
          <div className="flex gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <Info className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-blue-800 dark:text-blue-200">{t('withdrawal.holdNotice')}</p>
          </div>

          {hasActive && (
            <div className="flex gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t('withdrawal.statusPENDING')} — {t('withdrawal.history').toLowerCase()}
              </p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full px-5 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? t('withdrawal.submitting') : t('withdrawal.submit')}
          </button>
        </div>
      )}

      {/* История */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {t('withdrawal.history')}
        </h2>

        {requests.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">{t('withdrawal.empty')}</p>
        ) : (
          requests.map((r) => {
            const meta = STATUS_META[r.status] ?? STATUS_META.PENDING;
            const StatusIcon = meta.Icon;
            return (
              <div
                key={r.id}
                className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatPrice(Number(r.amount), currency)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{r.cardNumber}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(r.createdAt).toLocaleString('ru')}
                    </p>
                  </div>
                  <span className={`text-xs flex items-center gap-1 shrink-0 ${meta.cls}`}>
                    <StatusIcon className="w-3.5 h-3.5" /> {t(meta.key)}
                  </span>
                </div>

                {r.rejectReason && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                    {t('withdrawal.rejectReason')}: {r.rejectReason}
                  </p>
                )}

                {r.status === 'PENDING' && (
                  <button
                    onClick={() => handleCancel(r.id)}
                    className="mt-2 w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {t('withdrawal.cancel')}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default WithdrawalPage;
