// ============================================
// MasterUz — Live Search по каталогу услуг
// Поиск по названию задач, подкатегорий, категорий
// ============================================

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ChevronRight, Wrench, Layers, FolderOpen } from 'lucide-react';
import { useCatalogSearch } from '../hooks/useCatalogData';
import { useTranslation } from '../i18n';

export function CatalogSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { results } = useCatalogSearch(query);
  const navigate = useNavigate();
  const { language } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Закрытие при клике вне
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function getName(item: { name: string; nameUz?: string | null; nameEn?: string | null }) {
    if (language === 'uz' && item.nameUz) return item.nameUz;
    if (language === 'en' && item.nameEn) return item.nameEn;
    return item.name;
  }

  function handleSelect(result: (typeof results)[0]) {
    setIsOpen(false);
    setQuery('');
    if (result.type === 'task' || result.type === 'subcategory') {
      navigate(`/catalog/${result.categorySlug}/${result.slug}`);
    } else {
      navigate(result.parentSlug ? `/catalog/${result.slug}` : `/services/${result.slug}`);
    }
  }

  const typeIcon = {
    task: <Wrench size={14} className="text-primary-500 flex-shrink-0" />,
    subcategory: <Layers size={14} className="text-amber-500 flex-shrink-0" />,
    category: <FolderOpen size={14} className="text-blue-500 flex-shrink-0" />,
  };

  const typeLabel = {
    task: 'Услуга',
    subcategory: 'Раздел',
    category: 'Категория',
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      {/* Поле ввода */}
      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Поиск услуг: сборка кухни, аквариум, электрика..."
          className="w-full pl-12 pr-10 py-4 text-base bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl focus:border-primary-400 dark:focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-white"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        )}
      </div>

      {/* Выпадающий список результатов */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-h-[60vh] overflow-y-auto z-50">
          {results.length === 0 ? (
            <div className="p-6 text-center text-gray-400 dark:text-gray-500">
              <Search size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Ничего не найдено по «{query}»</p>
              <p className="text-xs mt-1">Попробуйте другое слово</p>
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, i) => (
                <button
                  key={`${result.type}-${result.slug}-${i}`}
                  onClick={() => handleSelect(result)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                >
                  {typeIcon[result.type]}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {getName(result)}
                    </div>
                    {result.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                        {result.description}
                      </p>
                    )}
                    {result.minPrice != null && result.minPrice > 0 && (
                      <span className="text-xs text-primary-500 font-medium">
                        от {new Intl.NumberFormat('ru-RU').format(result.minPrice)} сум
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded shrink-0">
                    {typeLabel[result.type]}
                  </span>
                  <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
