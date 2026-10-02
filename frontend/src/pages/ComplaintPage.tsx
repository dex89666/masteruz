// ============================================
// MasterUz — Complaint Page
// Юридическая форма подачи жалобы (для соответствия офере и закону).
// ============================================

import { useState } from 'react';
import { AlertTriangle, Send, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { track } from '../lib/analytics';
import { useTranslation } from '../i18n';

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
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim() || !form.contact.trim()) {
      toast.error(t('complaint.fillRequired'));
      return;
    }
    if (form.description.trim().length < 20) {
      toast.error(t('complaint.describeMore'));
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
      toast.success(t('complaint.registered'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('complaint.sendFailed'));
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
          <h1 className="text-2xl font-bold mb-2">{t('complaint.accepted')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            {t('complaint.regNumber')}: <span className="font-mono text-xs">{submitted}</span>
          </p>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {t('complaint.willReview')}
          </p>
          <button
            onClick={() => setSubmitted(null)}
            className="px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition"
          >
            {t('complaint.another')}
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
        <h1 className="text-3xl font-bold mb-2">{t('footer.complaint')}</h1>
        <p className="text-gray-500 dark:text-gray-400">
          {t('complaint.lead')}
        </p>
      </div>

      <form onSubmit={onSubmit} className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
        <Field label={`${t('complaint.subject')} *`} required>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => update('subject', e.target.value)}
            maxLength={200}
            placeholder={t('complaint.subjectPlaceholder')}
            className="form-input"
          />
        </Field>

        <Field label={`${t('complaint.description')} *`} required hint={t('complaint.min20')}>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            maxLength={5000}
            rows={6}
            placeholder={t('complaint.descPlaceholder')}
            className="form-input resize-none"
          />
        </Field>

        <Field label={`${t('complaint.contact')} *`} required hint={t('complaint.contactHint')}>
          <input
            type="text"
            value={form.contact}
            onChange={(e) => update('contact', e.target.value)}
            maxLength={200}
            placeholder={t('complaint.contactPlaceholder')}
            className="form-input"
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label={t('complaint.fullName')} hint={t('complaint.optional')}>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              maxLength={200}
              className="form-input"
            />
          </Field>
          <Field label={t('complaint.orderNumber')} hint={t('complaint.orderHint')}>
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
          {submitting ? t('complaint.sending') : t('complaint.submit')}
        </button>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          {t('complaint.disclaimer')}
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
