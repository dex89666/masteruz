// ============================================
// MasterUz — Разработка (контакт)
// ============================================

import { Code2, Phone, Mail, MessageCircle, ExternalLink, Globe } from 'lucide-react';
import { useTranslation } from '../i18n';

export function DevelopmentPage() {
  const { t } = useTranslation();
  return (
    <div className="page-container pb-20">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Code2 size={28} className="text-primary-600" />
          <h1 className="text-2xl font-bold dark:text-white">{t('footer.development')}</h1>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          {t('devPage.lead')}
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center">
              <Code2 size={32} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold dark:text-white">{t('devPage.name')}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{t('devPage.role')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <a
              href="tel:+998957005040"
              className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors group"
            >
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                <Phone size={20} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">+998 95 700-50-40</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('devPage.call')}</p>
              </div>
              <ExternalLink size={16} className="text-gray-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>

            <a
              href="mailto:vladlabcorp@gmail.com"
              className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group"
            >
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                <Mail size={20} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">vladlabcorp@gmail.com</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('devPage.email')}</p>
              </div>
              <ExternalLink size={16} className="text-gray-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>

            <a
              href="https://t.me/vladimir_bsh"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-sky-50 dark:bg-sky-900/20 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors group"
            >
              <div className="w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center shrink-0">
                <MessageCircle size={20} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">@vladimir_bsh</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Telegram</p>
              </div>
              <ExternalLink size={16} className="text-gray-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>

            <a
              href="https://vladlabcorp.uz"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group"
            >
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center shrink-0">
                <Globe size={20} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">vladlabcorp.uz</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('devPage.website')}</p>
              </div>
              <ExternalLink size={16} className="text-gray-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>

        <div className="mt-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold dark:text-white mb-3">{t('devPage.whatWeDo')}</h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2"><span className="text-primary-500 mt-0.5">•</span> {t('devPage.w1')}</li>
            <li className="flex items-start gap-2"><span className="text-primary-500 mt-0.5">•</span> {t('devPage.w2')}</li>
            <li className="flex items-start gap-2"><span className="text-primary-500 mt-0.5">•</span> {t('devPage.w3')}</li>
            <li className="flex items-start gap-2"><span className="text-primary-500 mt-0.5">•</span> {t('devPage.w4')}</li>
            <li className="flex items-start gap-2"><span className="text-primary-500 mt-0.5">•</span> {t('devPage.w5')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
