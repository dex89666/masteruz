// ============================================
// MasterUz — Careers / Вакансии
// ============================================

import { useState } from 'react';
import { Briefcase, Send, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';

const POSITIONS = [
  'Менеджер по работе с мастерами',
  'Менеджер по работе с клиентами',
  'Маркетолог / SMM-специалист',
  'Контент-менеджер',
  'Оператор поддержки',
  'Курьер / логист',
  'Другое',
];

export function CareersPage() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    position: '',
    experience: '',
    about: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone || !form.position) {
      toast.error(t('careers.fillRequired'));
      return;
    }

    // В будущем — отправка на API. Пока — показываем успех и отправляем на email.
    try {
      // Формируем mailto ссылку как fallback
      const subject = encodeURIComponent(`Вакансия: ${form.position} — ${form.name}`);
      const body = encodeURIComponent(
        `Имя: ${form.name}\nТелефон: ${form.phone}\nEmail: ${form.email}\nВакансия: ${form.position}\nОпыт: ${form.experience}\n\nО себе:\n${form.about}`
      );
      window.open(`mailto:vladlabcorp@gmail.com?subject=${subject}&body=${body}`, '_blank');
      setSubmitted(true);
      toast.success(t('careers.sent'));
    } catch {
      toast.error(t('estimateForm.sendError'));
    }
  }

  if (submitted) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[60vh] text-center">
        <CheckCircle size={64} className="text-green-500 mb-4" />
        <h1 className="text-2xl font-bold dark:text-white mb-2">{t('careers.thanks')}</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          {t('careers.thanksText')}{' '}
          <a href="mailto:vladlabcorp@gmail.com" className="text-primary-600 underline">vladlabcorp@gmail.com</a>
        </p>
      </div>
    );
  }

  return (
    <div className="page-container pb-20">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Briefcase size={28} className="text-primary-600" />
          <h1 className="text-2xl font-bold dark:text-white">{t('footer.careers')}</h1>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          {t('careers.lead')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('careers.fullName')} <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t('careers.namePlaceholder')}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('careers.phone')} <span className="text-red-500">*</span>
              </label>
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="+998 90 123-45-67"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('careers.position')} <span className="text-red-500">*</span>
            </label>
            <select
              name="position"
              value={form.position}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="">{t('careers.choosePosition')}</option>
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>{t(`careers.pos${POSITIONS.indexOf(pos)}`)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('careers.experience')}
            </label>
            <input
              name="experience"
              value={form.experience}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t('careers.expPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('careers.about')}
            </label>
            <textarea
              name="about"
              value={form.about}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder={t('careers.aboutPlaceholder')}
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/25"
          >
            <Send size={18} />
            {t('careers.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
