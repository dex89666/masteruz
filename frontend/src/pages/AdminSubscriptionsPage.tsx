// ============================================
// MasterUz — Admin Subscriptions Page
// Управление PRO-подписками: grant / extend / cancel.
// ============================================

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Crown, Plus, Clock, X, Search, Loader2 } from 'lucide-react';
import { adminApi } from '../api/client';

interface SubRow {
  id: string;
  masterId: string;
  plan: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  amountPaid: string | number;
  createdAt: string;
  master?: {
    id: string;
    username: string;
    profile?: { firstName: string | null; lastName: string | null } | null;
  };
}

const PLAN_LABELS: Record<string, string> = {
  TRIAL: 'Trial',
  MONTH: '1 мес',
  QUARTER: '3 мес',
  FIVE_MONTH: '5 мес',
  YEAR: 'Год',
  REFERRAL: 'Реферал',
  FOUNDER: 'Founder',
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Активна', cls: 'bg-emerald-100 text-emerald-700' },
  EXPIRED: { label: 'Истекла', cls: 'bg-slate-100 text-slate-600' },
  CANCELLED: { label: 'Отменена', cls: 'bg-red-100 text-red-700' },
  REFUNDED: { label: 'Возврат', cls: 'bg-amber-100 text-amber-700' },
};

const ALL_PLANS = ['TRIAL', 'MONTH', 'QUARTER', 'FIVE_MONTH', 'YEAR', 'REFERRAL', 'FOUNDER'] as const;
const ALL_STATUSES = ['ACTIVE', 'EXPIRED', 'CANCELLED', 'REFUNDED'] as const;

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fullName(row: SubRow) {
  const p = row.master?.profile;
  return [p?.firstName, p?.lastName].filter(Boolean).join(' ') || row.master?.username || row.masterId.slice(0, 8);
}

export function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(30);
  const [plan, setPlan] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantPlan, setGrantPlan] = useState<string>('MONTH');
  const [grantDays, setGrantDays] = useState<number>(30);
  const [grantReason, setGrantReason] = useState('');
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  async function load() {
    setLoading(true);
    try {
      const res = await adminApi.listSubscriptions({
        page,
        limit,
        plan: plan || undefined,
        status: status || undefined,
        search: search || undefined,
      });
      setRows(res.data.data as SubRow[]);
      setTotal(res.data.pagination?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, plan, status, search]);

  async function handleExtend(row: SubRow) {
    const raw = window.prompt(`Продлить «${fullName(row)}» на сколько дней?`, '30');
    if (!raw) return;
    const days = Number(raw);
    if (!Number.isFinite(days) || days <= 0) return;
    const reason = window.prompt('Причина (необязательно):') || undefined;
    try {
      await adminApi.extendSubscription(row.id, days, reason);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Не удалось продлить');
    }
  }

  async function handleCancel(row: SubRow) {
    if (!window.confirm(`Отменить подписку «${fullName(row)}»? Возврат средств не выполняется.`)) return;
    const reason = window.prompt('Причина отмены:') || undefined;
    try {
      await adminApi.cancelSubscription(row.id, reason);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Не удалось отменить');
    }
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    setGrantError(null);
    setGrantBusy(true);
    try {
      await adminApi.grantSubscription(grantUserId.trim(), grantPlan, grantDays, grantReason || undefined);
      setGrantOpen(false);
      setGrantUserId('');
      setGrantReason('');
      setGrantDays(30);
      setGrantPlan('MONTH');
      await load();
    } catch (err: any) {
      setGrantError(err?.response?.data?.error?.message || 'Не удалось выдать');
    } finally {
      setGrantBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/admin" className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Назад</span>
          </Link>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <h1 className="font-semibold text-slate-900">Управление PRO</h1>
          </div>
          <button
            onClick={() => setGrantOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Выдать
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по мастеру…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  setSearch(searchInput.trim());
                }
              }}
              className="pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <select
            value={plan}
            onChange={(e) => { setPage(1); setPlan(e.target.value); }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="">Все планы</option>
            {ALL_PLANS.map((p) => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
          </select>
          <select
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value); }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="">Все статусы</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s].label}</option>)}
          </select>
          <div className="ml-auto text-sm text-slate-500">
            Найдено: <span className="font-medium text-slate-900">{total}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 flex items-center justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">Подписок не найдено</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Мастер</th>
                  <th className="px-4 py-2.5">План</th>
                  <th className="px-4 py-2.5">Статус</th>
                  <th className="px-4 py-2.5">Период</th>
                  <th className="px-4 py-2.5">Оплачено</th>
                  <th className="px-4 py-2.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const st = STATUS_LABELS[row.status] ?? { label: row.status, cls: 'bg-slate-100 text-slate-600' };
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900">{fullName(row)}</div>
                        <div className="text-xs text-slate-400">@{row.master?.username || row.masterId.slice(0, 8)}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-medium">
                          {PLAN_LABELS[row.plan] || row.plan}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                        {formatDate(row.currentPeriodStart)} — {formatDate(row.currentPeriodEnd)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {Number(row.amountPaid).toLocaleString('ru-RU')} сум
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => handleExtend(row)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-emerald-50 text-emerald-700 text-xs"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            Продлить
                          </button>
                          {row.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleCancel(row)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-red-50 text-red-700 text-xs"
                            >
                              <X className="w-3.5 h-3.5" />
                              Отменить
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 text-sm"
            >
              Назад
            </button>
            <span className="text-sm text-slate-600">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 text-sm"
            >
              Вперёд
            </button>
          </div>
        )}
      </div>

      {grantOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleGrant} className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Выдать PRO вручную</h2>
              <button type="button" onClick={() => setGrantOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ID мастера</label>
                <input
                  required
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                  placeholder="uuid пользователя"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">План</label>
                  <select
                    value={grantPlan}
                    onChange={(e) => setGrantPlan(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    {ALL_PLANS.map((p) => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Дней</label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    required
                    value={grantDays}
                    onChange={(e) => setGrantDays(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Причина (необязательно)</label>
                <input
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="маркетинг / компенсация / тест"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              {grantError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{grantError}</div>
              )}
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setGrantOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-sm"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={grantBusy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-60"
              >
                {grantBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Выдать
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
