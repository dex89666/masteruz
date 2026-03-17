// ============================================
// MasterUz — Help & Support Page
// Страница помощи и поддержки
// ============================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n';
import {
  MessageCircle, Phone, Mail, HelpCircle, ChevronDown, ChevronUp,
  FileText, Shield, BookOpen, ExternalLink, Send, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const FAQ_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export function HelpSupportPage() {
  const { t } = useTranslation();
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  function toggleFaq(key: string) {
    setExpandedFaq(expandedFaq === key ? null : key);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.message) {
      toast.error(t('common.error'));
      return;
    }
    // Simulate submit
    setSubmitted(true);
    toast.success(t('support.messageSent'));
  }

  return (
    <div className="page-container pb-20">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
          <HelpCircle size={32} className="text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('support.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto">{t('support.subtitle')}</p>
      </div>

      {/* Quick contacts */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <a
          href="https://t.me/masteruz_support"
          target="_blank"
          rel="noopener noreferrer"
          className="card dark:bg-gray-800 dark:ring-gray-700 text-center hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
            <MessageCircle size={24} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Telegram</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">@masteruz_support</p>
        </a>

        <a
          href="tel:+998901234567"
          className="card dark:bg-gray-800 dark:ring-gray-700 text-center hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
            <Phone size={24} className="text-green-600 dark:text-green-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{t('support.phone')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">+998 90 123-45-67</p>
        </a>

        <a
          href="mailto:info@masteruz.uz"
          className="card dark:bg-gray-800 dark:ring-gray-700 text-center hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
            <Mail size={24} className="text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Email</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">info@masteruz.uz</p>
        </a>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* FAQ Section */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BookOpen size={20} className="text-primary-600" />
            {t('about.faqTitle')}
          </h2>
          <div className="space-y-2">
            {FAQ_KEYS.map((key) => (
              <div
                key={key}
                className="card dark:bg-gray-800 dark:ring-gray-700 !p-0 overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-white pr-4">
                    {t(`about.faq${key}q`)}
                  </span>
                  {expandedFaq === key ? (
                    <ChevronUp size={18} className="text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === key && (
                  <div className="px-4 pb-3 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3 animate-fade-in">
                    {t(`about.faq${key}a`)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact form */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Send size={20} className="text-primary-600" />
            {t('support.writeUs')}
          </h2>

          {submitted ? (
            <div className="card dark:bg-gray-800 dark:ring-gray-700 text-center py-12">
              <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('support.thankYou')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('support.weWillReply')}</p>
              <button onClick={() => setSubmitted(false)} className="btn-secondary dark:bg-gray-700 dark:text-gray-300 text-sm">
                {t('support.sendAnother')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card dark:bg-gray-800 dark:ring-gray-700 space-y-4">
              <div>
                <label className="label dark:text-gray-300">{t('support.yourName')}</label>
                <input
                  type="text"
                  className="input dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('support.namePlaceholder')}
                />
              </div>
              <div>
                <label className="label dark:text-gray-300">Email ({t('common.optional')})</label>
                <input
                  type="email"
                  className="input dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="label dark:text-gray-300">{t('support.subject')}</label>
                <select
                  className="input dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                >
                  <option value="">{t('support.selectSubject')}</option>
                  <option value="order">{t('support.subjectOrder')}</option>
                  <option value="payment">{t('support.subjectPayment')}</option>
                  <option value="master">{t('support.subjectMaster')}</option>
                  <option value="technical">{t('support.subjectTechnical')}</option>
                  <option value="other">{t('support.subjectOther')}</option>
                </select>
              </div>
              <div>
                <label className="label dark:text-gray-300">{t('support.message')}</label>
                <textarea
                  className="textarea dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder={t('support.messagePlaceholder')}
                />
              </div>
              <button type="submit" className="btn-primary w-full">
                <Send size={16} className="mr-2" />
                {t('support.send')}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Useful Links */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('support.usefulLinks')}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: FileText, label: t('home.publicOffer'), link: '/legal/offer' },
            { icon: Shield, label: t('home.privacyPolicy'), link: '/legal/privacy' },
            { icon: BookOpen, label: t('footer.about'), link: '/about' },
            { icon: HelpCircle, label: t('footer.faq'), link: '/about' },
          ].map((item) => (
            <Link
              key={item.link + item.label}
              to={item.link}
              className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 ring-1 ring-gray-100 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <item.icon size={18} className="text-primary-600 dark:text-primary-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
              <ExternalLink size={14} className="text-gray-400 ml-auto" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
