// ============================================
// MasterUz — Linked Cards Management Page
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cardsApi } from '../api/client';
import { useTranslation } from '../i18n';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  ArrowLeft, CreditCard, Plus, Trash2, Star, CheckCircle, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface LinkedCard {
  id: string;
  cardNumber: string;
  cardHolder?: string;
  expiryMonth?: number;
  expiryYear?: number;
  provider: string;
  isDefault: boolean;
}

const PROVIDER_COLORS: Record<string, string> = {
  UZCARD: 'from-blue-600 to-blue-800',
  HUMO: 'from-green-600 to-green-800',
  VISA: 'from-indigo-600 to-indigo-800',
  MASTERCARD: 'from-orange-500 to-red-600',
  OTHER: 'from-gray-600 to-gray-800',
};

const PROVIDER_LABELS: Record<string, string> = {
  UZCARD: 'UzCard',
  HUMO: 'HUMO',
  VISA: 'Visa',
  MASTERCARD: 'MasterCard',
  OTHER: 'Карта',
};

function formatCardInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

export function LinkedCardsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [cards, setCards] = useState<LinkedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryMonth: '',
    expiryYear: '',
  });

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    try {
      const res = await cardsApi.getAll();
      setCards(res.data.data || []);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    const digits = form.cardNumber.replace(/\s/g, '');
    if (digits.length !== 16) {
      toast.error(t('cards.invalidNumber'));
      return;
    }

    setSaving(true);
    try {
      await cardsApi.add({
        cardNumber: digits,
        cardHolder: form.cardHolder || undefined,
        expiryMonth: form.expiryMonth ? Number(form.expiryMonth) : undefined,
        expiryYear: form.expiryYear ? Number(form.expiryYear) : undefined,
      });
      toast.success(t('cards.added'));
      setForm({ cardNumber: '', cardHolder: '', expiryMonth: '', expiryYear: '' });
      setShowAddForm(false);
      await loadCards();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await cardsApi.setDefault(id);
      toast.success(t('cards.defaultSet'));
      await loadCards();
    } catch {
      toast.error(t('common.error'));
    }
  }

  async function handleRemove(id: string) {
    if (!confirm(t('cards.confirmRemove'))) return;
    try {
      await cardsApi.remove(id);
      toast.success(t('cards.removed'));
      await loadCards();
    } catch {
      toast.error(t('common.error'));
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container pb-20">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4"
      >
        <ArrowLeft size={18} className="mr-1" />
        {t('common.back')}
      </button>

      <h1 className="page-title flex items-center gap-2">
        <CreditCard size={24} className="text-primary-600 dark:text-primary-400" />
        {t('cards.title')}
      </h1>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {t('cards.subtitle')}
      </p>

      {/* Список карт */}
      {cards.length > 0 ? (
        <div className="space-y-3 mb-6">
          {cards.map((card) => {
            const gradient = PROVIDER_COLORS[card.provider] || PROVIDER_COLORS.OTHER;
            const label = PROVIDER_LABELS[card.provider] || card.provider;
            return (
              <div
                key={card.id}
                className={`relative rounded-2xl p-5 text-white bg-gradient-to-br ${gradient} shadow-lg overflow-hidden`}
              >
                {/* Декоративные круги */}
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
                <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                      {label}
                    </span>
                    {card.isDefault && (
                      <span className="flex items-center gap-1 text-xs bg-white/20 rounded-full px-2 py-0.5">
                        <Star size={12} fill="currentColor" />
                        {t('cards.default')}
                      </span>
                    )}
                  </div>

                  <div className="text-lg font-mono tracking-widest mb-3">
                    {card.cardNumber}
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      {card.cardHolder && (
                        <div className="text-xs opacity-80 uppercase">{card.cardHolder}</div>
                      )}
                      {card.expiryMonth && card.expiryYear && (
                        <div className="text-xs opacity-60 mt-0.5">
                          {String(card.expiryMonth).padStart(2, '0')}/{String(card.expiryYear).slice(-2)}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!card.isDefault && (
                        <button
                          onClick={() => handleSetDefault(card.id)}
                          className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                          title={t('cards.makeDefault')}
                        >
                          <Star size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(card.id)}
                        className="p-2 rounded-lg bg-white/20 hover:bg-red-500/50 transition-colors"
                        title={t('cards.remove')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card dark:bg-gray-800 dark:ring-gray-700 text-center py-10 mb-6">
          <CreditCard size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('cards.empty')}</p>
        </div>
      )}

      {/* Кнопка добавить / форма */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          disabled={cards.length >= 5}
          className="btn-primary w-full"
        >
          <Plus size={18} className="mr-2" />
          {t('cards.addCard')}
        </button>
      ) : (
        <div className="card dark:bg-gray-800 dark:ring-gray-700">
          <h3 className="font-semibold mb-4 dark:text-white flex items-center gap-2">
            <Plus size={18} className="text-primary-600 dark:text-primary-400" />
            {t('cards.addCard')}
          </h3>
          <form onSubmit={handleAddCard} className="space-y-4">
            <div>
              <label className="label dark:text-gray-300">{t('cards.cardNumber')} *</label>
              <input
                type="text"
                className="input dark:bg-gray-900 dark:border-gray-700 dark:text-white font-mono text-lg tracking-wider"
                placeholder="8600 0000 0000 0000"
                value={form.cardNumber}
                onChange={(e) => setForm({ ...form, cardNumber: formatCardInput(e.target.value) })}
                maxLength={19}
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="label dark:text-gray-300">{t('cards.cardHolder')}</label>
              <input
                type="text"
                className="input dark:bg-gray-900 dark:border-gray-700 dark:text-white uppercase"
                placeholder="IVANOV IVAN"
                value={form.cardHolder}
                onChange={(e) => setForm({ ...form, cardHolder: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label dark:text-gray-300">{t('cards.expiryMonth')}</label>
                <select
                  className="input dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  value={form.expiryMonth}
                  onChange={(e) => setForm({ ...form, expiryMonth: e.target.value })}
                >
                  <option value="">—</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label dark:text-gray-300">{t('cards.expiryYear')}</label>
                <select
                  className="input dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  value={form.expiryYear}
                  onChange={(e) => setForm({ ...form, expiryYear: e.target.value })}
                >
                  <option value="">—</option>
                  {Array.from({ length: 10 }, (_, i) => {
                    const year = new Date().getFullYear() + i;
                    return <option key={year} value={year}>{year}</option>;
                  })}
                </select>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
              <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {t('cards.securityNote')}
              </p>
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                <CheckCircle size={16} className="mr-2" />
                {saving ? t('common.loading') : t('cards.save')}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setForm({ cardNumber: '', cardHolder: '', expiryMonth: '', expiryYear: '' }); }}
                className="btn-secondary"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {cards.length >= 5 && !showAddForm && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
          {t('cards.maxReached')}
        </p>
      )}
    </div>
  );
}
