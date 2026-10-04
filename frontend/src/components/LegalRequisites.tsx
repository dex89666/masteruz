// ============================================
// MasterUz — Юридические реквизиты (общий блок)
// Единственный источник правды для реквизитов.
// ============================================

import { useTranslation } from '../i18n';

export function LegalRequisites() {
  const { t } = useTranslation();
  return (
    <section className="mt-8 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 text-sm leading-relaxed">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('requisites.title')}</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-gray-700 dark:text-gray-300">
        <dt className="font-medium">{t('requisites.fullName')}:</dt>
        <dd>{t('requisites.fullNameValue')}</dd>

        <dt className="font-medium">{t('footer.requisitesInn')}:</dt>
        <dd>313 020 180</dd>

        <dt className="font-medium">{t('requisites.oked')}:</dt>
        <dd>63.12.0 — {t('requisites.okedValue')}</dd>

        <dt className="font-medium">{t('requisites.address')}:</dt>
        <dd>{t('requisites.addressValue')}</dd>

        <dt className="font-medium">{t('requisites.account')}:</dt>
        <dd className="font-mono">20208000007481543001 (UZS)</dd>

        <dt className="font-medium">{t('requisites.bank')}:</dt>
        <dd>{t('requisites.bankValue')}</dd>

        <dt className="font-medium">{t('requisites.mfo')}:</dt>
        <dd className="font-mono">00083</dd>

        <dt className="font-medium">Email:</dt>
        <dd>
          <a href="mailto:vladlabcorp@gmail.com" className="text-primary-600 dark:text-primary-400 hover:underline">
            vladlabcorp@gmail.com
          </a>
        </dd>

        <dt className="font-medium">Telegram:</dt>
        <dd>
          <a href="https://t.me/masteruz_support" className="text-primary-600 dark:text-primary-400 hover:underline">
            @masteruz_support
          </a>
        </dd>

        <dt className="font-medium">{t('careers.phone')}:</dt>
        <dd>
          <a href="tel:+998957005040" className="text-primary-600 dark:text-primary-400 hover:underline">
            +998 95 700-50-40
          </a>
        </dd>
      </dl>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {t('requisites.note')}
      </p>
    </section>
  );
}
