// ============================================
// MasterUz — Ремонт под ключ (Страница)
// ============================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { turnkeyApi } from '../api/client';
import { useTranslation } from '../i18n';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';
import { icons, LucideIcon } from 'lucide-react';

export function TurnkeyPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  // Калькулятор
  const [calcForm, setCalcForm] = useState({
    propertyType: 'apartment',
    area: 50,
    rooms: 2,
    designIncluded: false,
    furnitureIncluded: false,
  });

  const { data: estimate, refetch: calcRefetch } = useQuery({
    queryKey: ['turnkey-estimate', calcForm],
    queryFn: () => turnkeyApi.getEstimate(calcForm).then(r => r.data.data),
    enabled: false,
  });

  const handleCalculate = () => {
    calcRefetch();
  };

  // Создание заявки
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    propertyType: 'apartment',
    area: '',
    rooms: '',
    budgetMin: '',
    budgetMax: '',
    address: '',
    city: 'Ташкент',
    designIncluded: false,
    furnitureIncluded: false,
  });

  const createMutation = useMutation({
    mutationFn: () => turnkeyApi.create({
      ...form,
      area: form.area ? Number(form.area) : undefined,
      rooms: form.rooms ? Number(form.rooms) : undefined,
      budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
      budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
    }),
    onSuccess: () => {
      toast.success(t('turnkey.requestCreated'));
      navigate('/turnkey/my');
    },
    onError: () => toast.error(t('common.error')),
  });

  const propertyTypes = [
    { value: 'apartment', label: t('turnkey.apartment'), icon: 'Building2' },
    { value: 'house', label: t('turnkey.house'), icon: 'Home' },
    { value: 'office', label: t('turnkey.office'), icon: 'Landmark' },
    { value: 'commercial', label: t('turnkey.commercial'), icon: 'Store' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">{t('turnkey.title')}</h1>
          <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">{t('turnkey.subtitle')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowForm(true)}
              className="px-8 py-3 bg-white text-purple-600 font-bold rounded-xl hover:bg-purple-50 transition shadow-lg"
            >
              {t('turnkey.createRequest')}
            </button>
            <a href="#calculator" className="px-8 py-3 border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition">
              {t('turnkey.calculateCost')}
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Как мы работаем */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">{t('turnkey.howWeWork')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { icon: 'ClipboardList', title: t('turnkey.step1Title'), desc: t('turnkey.step1Desc') },
              { icon: 'RulerIcon', title: t('turnkey.step2Title'), desc: t('turnkey.step2Desc') },
              { icon: 'Hammer', title: t('turnkey.step3Title'), desc: t('turnkey.step3Desc') },
              { icon: 'Key', title: t('turnkey.step4Title'), desc: t('turnkey.step4Desc') },
            ].map((step, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-5 text-center shadow-sm relative">
                {(() => { const Icon = (icons as Record<string, LucideIcon>)[step.icon]; return Icon ? <Icon size={28} className="mx-auto text-purple-500" /> : null; })()}
                <div className="absolute -top-3 -left-1 w-7 h-7 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Включённые услуги */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-12">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('turnkey.included')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: 'Ruler', text: t('turnkey.inc1') },
              { icon: 'Layers', text: t('turnkey.inc2') },
              { icon: 'Zap', text: t('turnkey.inc3') },
              { icon: 'Droplets', text: t('turnkey.inc4') },
              { icon: 'Palette', text: t('turnkey.inc5') },
              { icon: 'Sparkles', text: t('turnkey.inc6') },
              { icon: 'Sofa', text: t('turnkey.inc7') },
              { icon: 'Package', text: t('turnkey.inc8') },
              { icon: 'CheckCircle', text: t('turnkey.inc9') },
            ].map((item, i) => {
              const Icon = (icons as Record<string, LucideIcon>)[item.icon];
              return (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  {Icon ? <Icon size={16} className="text-purple-500" /> : null} {item.text}
                </div>
              );
            })}
          </div>
        </div>

        {/* Калькулятор */}
        <div id="calculator" className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-12">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('turnkey.calculator')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('turnkey.propertyType')}</label>
              <select value={calcForm.propertyType} onChange={(e) => setCalcForm({ ...calcForm, propertyType: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                {propertyTypes.map(pt => <option key={pt.value} value={pt.value}>{pt.icon} {pt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('turnkey.area')} (м²)</label>
              <input type="number" value={calcForm.area} onChange={(e) => setCalcForm({ ...calcForm, area: Number(e.target.value) })}
                min={10} max={1000}
                className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('turnkey.rooms')}</label>
              <input type="number" value={calcForm.rooms} onChange={(e) => setCalcForm({ ...calcForm, rooms: Number(e.target.value) })}
                min={1} max={20}
                className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
            <div className="flex flex-col gap-2 justify-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={calcForm.designIncluded} onChange={(e) => setCalcForm({ ...calcForm, designIncluded: e.target.checked })}
                  className="w-4 h-4 accent-purple-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{t('turnkey.withDesign')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={calcForm.furnitureIncluded} onChange={(e) => setCalcForm({ ...calcForm, furnitureIncluded: e.target.checked })}
                  className="w-4 h-4 accent-purple-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{t('turnkey.withFurniture')}</span>
              </label>
            </div>
          </div>

          <button onClick={handleCalculate}
            className="w-full py-3 bg-purple-500 text-white font-semibold rounded-xl hover:bg-purple-600 transition mb-4">
            {t('turnkey.calculate')}
          </button>

          {estimate && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
              <h3 className="font-bold text-purple-800 dark:text-purple-300 mb-3">{t('turnkey.estimateResult')}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{t('turnkey.priceRange')}:</span>
                  <p className="font-bold text-purple-700 dark:text-purple-300">
                    {estimate.priceMin.toLocaleString()} — {estimate.priceMax.toLocaleString()} {t('common.currency')}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{t('turnkey.estimatedDays')}:</span>
                  <p className="font-bold text-purple-700 dark:text-purple-300">
                    {estimate.estimatedDaysMin} — {estimate.estimatedDaysMax} {t('turnkey.days')}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{t('turnkey.pricePerSqm')}:</span>
                  <p className="font-bold text-purple-700 dark:text-purple-300">
                    {estimate.pricePerSqmMin.toLocaleString()} — {estimate.pricePerSqmMax.toLocaleString()} {t('common.currency')}/м²
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Форма заявки */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8 border-2 border-purple-200 dark:border-purple-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('turnkey.requestForm')}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('turnkey.projectTitle')} *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t('turnkey.titlePlaceholder')}
                  className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('turnkey.propertyType')}</label>
                <select value={form.propertyType} onChange={(e) => setForm({ ...form, propertyType: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                  {propertyTypes.map(pt => <option key={pt.value} value={pt.value}>{pt.icon} {pt.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('turnkey.area')} (м²)</label>
                  <input type="number" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}
                    className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('turnkey.rooms')}</label>
                  <input type="number" value={form.rooms} onChange={(e) => setForm({ ...form, rooms: e.target.value })}
                    className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('turnkey.budgetMin')}</label>
                  <input type="number" value={form.budgetMin} onChange={(e) => setForm({ ...form, budgetMin: e.target.value })}
                    placeholder="10 000 000"
                    className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('turnkey.budgetMax')}</label>
                  <input type="number" value={form.budgetMax} onChange={(e) => setForm({ ...form, budgetMax: e.target.value })}
                    placeholder="50 000 000"
                    className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('turnkey.addressLabel')}</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('turnkey.descriptionLabel')}</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4} placeholder={t('turnkey.descriptionPlaceholder')}
                  className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.designIncluded} onChange={(e) => setForm({ ...form, designIncluded: e.target.checked })}
                    className="w-4 h-4 accent-purple-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t('turnkey.includeDesign')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.furnitureIncluded} onChange={(e) => setForm({ ...form, furnitureIncluded: e.target.checked })}
                    className="w-4 h-4 accent-purple-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t('turnkey.includeFurniture')}</span>
                </label>
              </div>

              {!isAuthenticated && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 p-3 rounded-xl text-sm">
                  {t('cart.loginRequired')}
                </div>
              )}

              <button
                onClick={() => isAuthenticated ? createMutation.mutate() : navigate('/login')}
                disabled={createMutation.isPending || !form.title}
                className="w-full py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition disabled:opacity-50"
              >
                {createMutation.isPending ? t('common.saving') : t('turnkey.submitRequest')}
              </button>
            </div>
          </div>
        )}

        {/* Навигация к связанным разделам */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link to="/catalog/interior-design" className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition group">
            {(() => { const P = (icons as Record<string, LucideIcon>)['Palette']; return P ? <P size={28} className="text-purple-500 mb-2" /> : null; })()}
            <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-purple-500 transition">{t('turnkey.designLink')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('turnkey.designLinkDesc')}</p>
          </Link>
          <Link to="/catalog/custom-furniture" className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition group">
            {(() => { const S = (icons as Record<string, LucideIcon>)['Sofa']; return S ? <S size={28} className="text-purple-500 mb-2" /> : null; })()}
            <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-purple-500 transition">{t('turnkey.furnitureLink')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('turnkey.furnitureLinkDesc')}</p>
          </Link>
          <Link to="/stores" className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition group">
            {(() => { const B = (icons as Record<string, LucideIcon>)['Layers']; return B ? <B size={28} className="text-orange-500 mb-2" /> : null; })()}
            <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-orange-500 transition">{t('turnkey.materialsLink')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('turnkey.materialsLinkDesc')}</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
