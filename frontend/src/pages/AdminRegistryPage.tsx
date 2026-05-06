// ============================================
// MasterUz — Admin Local Registry
// Страница для админа: просмотр локальных JSON-реестров
// (клиенты / мастера / согласия). Только ADMIN/MANAGER.
// ============================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Hammer, ShieldCheck, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store';

type Tab = 'clients' | 'masters' | 'consents';

interface ClientRow {
  id: string;
  fullName: string;
  phone: string;
  serviceType: string;
  paidAmount: number;
  createdAt: string;
  notes?: string;
}

interface MasterRow {
  id: string;
  pinfl: string;
  fullName: string;
  phone: string;
  address: string;
  workTypes: string[];
  completedWork?: string;
  createdAt: string;
}

interface ConsentRow {
  id: string;
  acceptedOffer: boolean;
  acceptedPrivacy: boolean;
  acceptedDataProcessing: boolean;
  documentsVersion: string;
  ip: string;
  userAgent: string;
  acceptedAt: string;
}

export function AdminRegistryPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('clients');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [masters, setMasters] = useState<MasterRow[]>([]);
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAllowed = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [c, m, k] = await Promise.all([
        api.get('/local-registry/clients'),
        api.get('/local-registry/masters'),
        api.get('/local-registry/consents'),
      ]);
      setClients(c.data?.data || []);
      setMasters(m.data?.data || []);
      setConsents(k.data?.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Не удалось загрузить реестр');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAllowed) load();
  }, [isAllowed]);

  if (!isAllowed) {
    return (
      <div className="page-container max-w-2xl">
        <div className="card text-center">
          <h1 className="text-xl font-bold mb-2">Доступ ограничен</h1>
          <p className="text-gray-600 dark:text-gray-400">Этот раздел доступен только администраторам.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container pb-20 max-w-6xl">
      <Link to="/admin" className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 mb-4">
        <ArrowLeft size={18} className="mr-1" /> Админ-панель
      </Link>

      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Локальный реестр</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Файловое хранилище в <code>backend/data/</code> — переходный слой до полной миграции в БД.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Табы */}
      <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
        <TabButton active={tab === 'clients'} onClick={() => setTab('clients')} icon={<Users size={16} />} label="Клиенты" count={clients.length} />
        <TabButton active={tab === 'masters'} onClick={() => setTab('masters')} icon={<Hammer size={16} />} label="Мастера" count={masters.length} />
        <TabButton active={tab === 'consents'} onClick={() => setTab('consents')} icon={<ShieldCheck size={16} />} label="Согласия" count={consents.length} />
      </div>

      {/* Содержимое */}
      <div className="card overflow-x-auto">
        {tab === 'clients' && <ClientsTable rows={clients} />}
        {tab === 'masters' && <MastersTable rows={masters} />}
        {tab === 'consents' && <ConsentsTable rows={consents} />}
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}

function TabButton({ active, onClick, icon, label, count }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 -mb-px border-b-2 text-sm font-medium transition-colors ${
        active
          ? 'border-primary-600 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      {icon}
      {label}
      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">{count}</span>
    </button>
  );
}

function ClientsTable({ rows }: { rows: ClientRow[] }) {
  if (!rows.length) return <Empty text="Клиентов пока нет" />;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
        <tr>
          <Th>Имя</Th>
          <Th>Телефон</Th>
          <Th>Услуга</Th>
          <Th>Сумма, сум</Th>
          <Th>Дата</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
            <Td>{r.fullName}</Td>
            <Td className="font-mono">{r.phone}</Td>
            <Td>{r.serviceType}</Td>
            <Td className="font-mono">{r.paidAmount.toLocaleString('ru-RU')}</Td>
            <Td className="text-gray-500">{formatDate(r.createdAt)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MastersTable({ rows }: { rows: MasterRow[] }) {
  if (!rows.length) return <Empty text="Мастеров пока нет" />;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
        <tr>
          <Th>ПИНФЛ</Th>
          <Th>ФИО</Th>
          <Th>Телефон</Th>
          <Th>Адрес</Th>
          <Th>Виды работ</Th>
          <Th>Дата</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 align-top">
            <Td className="font-mono">{r.pinfl}</Td>
            <Td>{r.fullName}</Td>
            <Td className="font-mono">{r.phone}</Td>
            <Td className="max-w-[14rem]">{r.address}</Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {r.workTypes.map((w) => (
                  <span key={w} className="px-2 py-0.5 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                    {w}
                  </span>
                ))}
              </div>
            </Td>
            <Td className="text-gray-500">{formatDate(r.createdAt)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ConsentsTable({ rows }: { rows: ConsentRow[] }) {
  if (!rows.length) return <Empty text="Согласий пока нет" />;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
        <tr>
          <Th>Дата</Th>
          <Th>IP</Th>
          <Th>Версия</Th>
          <Th>Оферта</Th>
          <Th>Политика</Th>
          <Th>ПДн</Th>
          <Th>User-Agent</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
            <Td className="text-gray-500 whitespace-nowrap">{formatDate(r.acceptedAt)}</Td>
            <Td className="font-mono">{r.ip}</Td>
            <Td className="font-mono text-xs">{r.documentsVersion}</Td>
            <Td>{r.acceptedOffer ? '✅' : '—'}</Td>
            <Td>{r.acceptedPrivacy ? '✅' : '—'}</Td>
            <Td>{r.acceptedDataProcessing ? '✅' : '—'}</Td>
            <Td className="max-w-[20rem] truncate text-xs text-gray-500">
              <span title={r.userAgent}>{r.userAgent}</span>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-gray-700 dark:text-gray-300 ${className}`}>{children}</td>;
}

function Empty({ text }: { text: string }) {
  return <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">{text}</div>;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}
