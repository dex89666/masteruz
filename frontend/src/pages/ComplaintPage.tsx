// ============================================
// MasterUz — Complaint Page
// Юридическая форма подачи жалобы (для соответствия офере и закону).
// ============================================

import { useState } from 'react';
import { AlertTriangle, Send, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { track } from '../lib/analytics';

interface FormState {
  subject: string;
  description: string;
  contact: string;
  fullName: string;
  orderId: string;
}

const INITIAL: FormState = {
  subject: '',
  description: '',
  contact: '',
  fullName: '',
  orderId: '',
};

export function ComplaintPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim() || !form.contact.trim()) {
      toast.error('Заполните тему, описание и контакт для связи');
      return;
    }
    if (form.description.trim().length < 20) {
      toast.error('Опишите ситуацию подробнее (минимум 20 символов)');
      return;
    }

    try {
      setSubmitting(true);
      const { data } = await api.post('/complaints', {
        subject: form.subject.trim(),
        description: form.description.trim(),
        contact: form.contact.trim(),
        fullName: form.fullName.trim() || undefined,
        orderId: form.orderId.trim() || undefined,
      });
      const id = data?.data?.id ?? '';
      track('complaint_submitted', { id });
      setSubmitted(id);
      setForm(INITIAL);
      toast.success('Жалоба зарегистрирована');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Не удалось отправить жалобу');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="page-container pb-20 max-w-2xl">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Жалоба принята</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            Регистрационный номер: <span className="font-mono text-xs">{submitted}</span>
          </p>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Мы рассмотрим обращение в установленный законом срок и свяжемся с вами по указанным контактам.
          </p>
          <button
            onClick={() => setSubmitted(null)}
            className="px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition"
          >
            Подать ещё одну жалобу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container pb-20 max-w-2xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={32} className="text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Подать жалобу</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Юридический канал обращения к ООО «Vladlab». Все жалобы регистрируются и рассматриваются согласно
          публичной оферте и законодательству Республики Узбекистан.
        </p>
      </div>

      <form onSubmit={onSubmit} className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
        <Field label="Тема жалобы *" required>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => update('subject', e.target.value)}
            maxLength={200}
            placeholder="Например: некачественное выполнение работ"
            className="form-input"
          />
        </Field>

        <Field label="Описание ситуации *" required hint="Минимум 20 символов">
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            maxLength={5000}
            rows={6}
            placeholder="Опишите подробно: что произошло, когда, какие шаги уже предприняли"
            className="form-input resize-none"
          />
        </Field>

        <Field label="Контакт для ответа *" required hint="Телефон или email">
          <input
            type="text"
            value={form.contact}
            onChange={(e) => update('contact', e.target.value)}
            maxLength={200}
            placeholder="+998 90 123-45-67 или you@example.com"
            className="form-input"
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="ФИО" hint="Необязательно">
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              maxLength={200}
              className="form-input"
            />
          </Field>
          <Field label="Номер заказа" hint="Если жалоба связана с заказом">
            <input
              type="text"
              value={form.orderId}
              onChange={(e) => update('orderId', e.target.value)}
              maxLength={100}
              className="form-input"
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          {submitting ? 'Отправка...' : 'Отправить жалобу'}
        </button>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          Отправляя жалобу, вы подтверждаете достоверность указанных сведений. Передача заведомо ложных сведений
          преследуется по закону.
        </p>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-400 dark:text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

export default ComplaintPage;
