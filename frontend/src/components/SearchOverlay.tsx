// ============================================
// MasterUz — Global Search Overlay
// Глобальный поиск по заказам, мастерам, услугам
// ============================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight, Wrench, User, FileText, Clock } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useDebounce } from '../hooks';
import { ordersApi, usersApi, catalogApi } from '../api/client';

interface SearchResult {
  type: 'order' | 'master' | 'category';
  id: string;
  title: string;
  subtitle?: string;
  link: string;
}

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debouncedQuery = useDebounce(query, 300);

  // Keyboard: Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Load recent searches
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('masteruz_recent_searches') || '[]');
      setRecentSearches(stored.slice(0, 5));
    } catch { /* ignore */ }
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Search
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    async function search() {
      setLoading(true);
      const items: SearchResult[] = [];

      try {
        // Search orders
        const ordersRes = await ordersApi.list({ search: debouncedQuery, limit: 3 });
        const orders = ordersRes.data.data || [];
        orders.forEach((o: any) => {
          items.push({
            type: 'order',
            id: o.id,
            title: o.title || `${t('orders.order')} #${o.id.slice(0, 8)}`,
            subtitle: o.status,
            link: `/orders/${o.id}`,
          });
        });
      } catch { /* ignore */ }

      try {
        // Search masters
        const mastersRes = await usersApi.searchMasters({ search: debouncedQuery, limit: 3 });
        const masters = mastersRes.data.data || [];
        masters.forEach((m: any) => {
          items.push({
            type: 'master',
            id: m.id,
            title: m.profile?.firstName ? `${m.profile.firstName} ${m.profile.lastName || ''}` : 'Мастер',
            subtitle: m.masterProfile?.specialization,
            link: `/masters/${m.id}`,
          });
        });
      } catch { /* ignore */ }

      try {
        // Search categories
        const catRes = await catalogApi.getCategories();
        const cats = (catRes.data.data || []).filter((c: any) =>
          c.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          (c.nameUz && c.nameUz.toLowerCase().includes(debouncedQuery.toLowerCase())) ||
          (c.nameEn && c.nameEn.toLowerCase().includes(debouncedQuery.toLowerCase()))
        );
        cats.slice(0, 3).forEach((c: any) => {
          items.push({
            type: 'category',
            id: c.id,
            title: c.name,
            subtitle: `${c._count?.subcategories || 0} ${t('common.subcategories')}`,
            link: `/orders?category=${c.slug}`,
          });
        });
      } catch { /* ignore */ }

      setResults(items);
      setLoading(false);
    }

    search();
  }, [debouncedQuery, t]);

  function handleSelect(result: SearchResult) {
    // Save to recent
    const recent = [query, ...recentSearches.filter((s) => s !== query)].slice(0, 5);
    setRecentSearches(recent);
    try { localStorage.setItem('masteruz_recent_searches', JSON.stringify(recent)); } catch { /* noop */ }

    navigate(result.link);
    onClose();
  }

  function handleRecentSearch(q: string) {
    setQuery(q);
  }

  function clearRecent() {
    setRecentSearches([]);
    try { localStorage.removeItem('masteruz_recent_searches'); } catch { /* noop */ }
  }

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKey);
        document.body.style.overflow = '';
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  const iconMap = {
    order: FileText,
    master: User,
    category: Wrench,
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('common.search')}
    >
      <div
        className="max-w-2xl mx-auto mt-16 sm:mt-24 px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden animate-scale-in">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <Search size={20} className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('common.searchPlaceholder')}
              className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 outline-none text-base"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={18} />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="py-2">
                {results.map((result) => {
                  const Icon = iconMap[result.type];
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                        <Icon size={16} className="text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.subtitle}</div>
                        )}
                      </div>
                      <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

            {!loading && query.length >= 2 && results.length === 0 && (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                {t('common.noSearchResults')}
              </div>
            )}

            {/* Recent searches */}
            {!query && recentSearches.length > 0 && (
              <div className="py-2">
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.recentSearches')}</span>
                  <button onClick={clearRecent} className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400">
                    {t('common.clearAll')}
                  </button>
                </div>
                {recentSearches.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleRecentSearch(q)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Clock size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{q}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!query && recentSearches.length === 0 && (
              <div className="py-8 text-center text-gray-400 text-sm">
                {t('common.searchHint')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
