// ============================================
// MasterUz — Юридические реквизиты (общий блок)
// Единственный источник правды для реквизитов.
// ============================================

export function LegalRequisites() {
  return (
    <section className="mt-8 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 text-sm leading-relaxed">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Реквизиты Оператора</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-gray-700 dark:text-gray-300">
        <dt className="font-medium">Полное наименование:</dt>
        <dd>Общество с ограниченной ответственностью «Vladlab»</dd>

        <dt className="font-medium">ИНН:</dt>
        <dd>313 020 180</dd>

        <dt className="font-medium">ОКЭД:</dt>
        <dd>63.12.0 — Деятельность веб-порталов</dd>

        <dt className="font-medium">Юр. адрес:</dt>
        <dd>Республика Узбекистан, г. Ташкент</dd>

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

        <dt className="font-medium">Телефон:</dt>
        <dd>
          <a href="tel:+998957005040" className="text-primary-600 dark:text-primary-400 hover:underline">
            +998 95 700-50-40
          </a>
        </dd>
      </dl>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        ООО «Vladlab» выступает информационным посредником между клиентами и независимыми мастерами,
        не является работодателем мастеров и не оказывает строительно-ремонтных услуг от своего имени.
      </p>
    </section>
  );
}
