// ============================================
// MasterUz — Заявка на партнёрство
// ============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { storesApi } from '../api/client';
import { useTranslation } from '../i18n';
import toast from 'react-hot-toast';

export function PartnerRequestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    storeName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    storeCategory: '',
    message: '',
  });

  const { data: categories } = useQuery({
    queryKey: ['store-categories'],
    queryFn: () => storesApi.getCategories().then(r => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: () => storesApi.submitPartnerRequest(form),
    onSuccess: () => {
      toast.success(t('stores.requestSubmitted'));
      navigate('/stores');
    },
    onError: () => toast.error(t('common.error')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.storeName || !form.contactPerson || !form.phone || !form.storeCategory) {
      toast.error(t('stores.fillRequired'));
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('stores.partnerRequestTitle')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('stores.partnerRequestDesc')}</p>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
          {/* Название */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('stores.storeName')} *</label>
            <input type="text" required value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>

          {/* Контактное лицо */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('stores.contactPerson')} *</label>
            <input type="text" required value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>

          {/* Телефон */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('stores.phone')} *</label>
            <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+998 90 123 45 67"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>

          {/* Категория партнёра */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('stores.category')} *</label>
            <select required value={form.storeCategory} onChange={(e) => setForm({ ...form, storeCategory: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none">
              <option value="">{t('stores.selectCategory')}</option>
              {(categories || []).map((cat: any) => (
                <option key={cat.slug} value={cat.slug}>{cat.icon} {cat.name}</option>
              ))}
              {/* Расширенные категории партнёров */}
              <option value="home-appliances">🏠 Бытовая техника</option>
              <option value="conditioners">❄️ Кондиционеры и климат</option>
              <option value="windows-shop">🪟 Окна и двери</option>
              <option value="sanitary-shop">🚿 Сантехника</option>
              <option value="lighting">💡 Освещение и электрика</option>
              <option value="tools-shop">🔧 Инструменты</option>
              <option value="garden-shop">🌿 Сад и ландшафт</option>
              <option value="furniture-shop">🛋️ Мебель и фурнитура</option>
              <option value="tiles-flooring">🪵 Плитка и напольные покрытия</option>
              <option value="paint-shop">🎨 Краски и лаки</option>
              <option value="other">📦 Другое</option>
            </select>
          </div>

          {/* Гарантия платформы */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">🛡️ Гарантия MasterUz</p>
            <p className="text-xs text-green-700 dark:text-green-400">
              Все товары, заказанные через платформу, покрываются нашей гарантией качества.
              Клиенты получают защиту при покупке, а партнёры — дополнительный трафик и доверие.
            </p>
          </div>

          {/* Адрес + Город */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('stores.city')}</label>
              <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('stores.address')}</label>
              <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
          </div>

          {/* Сообщение */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('stores.message')}</label>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={4} placeholder={t('stores.messagePlaceholder')}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none resize-none" />
          </div>

          {/* Преимущества */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
            <h3 className="font-semibold text-orange-800 dark:text-orange-300 mb-2">{t('stores.whyPartner')}</h3>
            <ul className="text-sm text-orange-700 dark:text-orange-400 space-y-1">
              <li>✅ {t('stores.benefit1')}</li>
              <li>✅ {t('stores.benefit2')}</li>
              <li>✅ {t('stores.benefit3')}</li>
              <li>✅ {t('stores.benefit4')}</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition disabled:opacity-50"
          >
            {mutation.isPending ? t('common.saving') : t('stores.submitRequest')}
          </button>
        </form>
      </div>
    </div>
  );
}
