// ============================================
// MasterUz — Public Offer (Публичная оферта)
// ============================================

import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export function PublicOfferPage() {
  return (
    <div className="page-container pb-20 max-w-4xl">
      <Link to="/" className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4">
        <ArrowLeft size={18} className="mr-1" /> Главная
      </Link>

      <div className="card dark:bg-gray-800 dark:ring-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <FileText size={28} className="text-primary-600 dark:text-primary-400" />
          <h1 className="text-2xl md:text-3xl font-bold dark:text-white">Публичная оферта</h1>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Дата последнего обновления: 24 февраля 2026 г.</p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300 text-sm md:text-base leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">1. Предмет оферты</h2>
            <p>
              Настоящий документ является публичной офертой (далее — «Оферта») платформы MasterUz
              и определяет условия предоставления информационно-посреднических услуг по связи клиентов
              с исполнителями бытовых услуг (мастерами).
            </p>
            <p>
              Акцептом настоящей Оферты является регистрация на Платформе через Telegram и/или
              создание заказа. С момента акцепта Оферта приобретает силу договора.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">2. Участники платформы</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Клиент</strong> — физическое лицо, размещающее заказ на бытовые услуги</li>
              <li><strong>Мастер</strong> — физическое лицо или ИП, оказывающее бытовые услуги</li>
              <li><strong>Платформа (MasterUz)</strong> — информационный посредник между Клиентом и Мастером</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">3. Порядок работы</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Клиент создаёт заказ (фото + описание или голосовое сообщение)</li>
              <li>Система анализирует заказ и предлагает 3 варианта (Хороший / Отличный / Премиум)</li>
              <li>Клиент выбирает вариант и подтверждает заказ</li>
              <li>Средства блокируются на балансе Клиента (эскроу)</li>
              <li>Платформа уведомляет подходящих мастеров (до 50 человек)</li>
              <li>Мастер откликается на заказ</li>
              <li>Клиент выбирает мастера, мастер оплачивает комиссию</li>
              <li>Мастер выполняет работу, Клиент подтверждает завершение</li>
              <li>Средства переводятся Мастеру за вычетом комиссии</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">4. Комиссия платформы</h2>
            <p>
              Платформа взимает комиссию с Мастера за каждый выполненный заказ. Размер комиссии
              определяется в настройках платформы (по умолчанию 15% от стоимости работ).
              Дополнительно взимается комиссия за выезд мастера.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">5. Срочные заказы</h2>
            <p>
              При выборе опции «Срочный вызов» к стоимости работ применяется надбавка за срочность
              (по умолчанию +40%). Надбавка включается в общую стоимость заказа.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">6. Гарантии</h2>
            <p>
              Платформа MasterUz не является стороной договора между Клиентом и Мастером.
              Платформа обеспечивает:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Верификацию мастеров</li>
              <li>Систему рейтингов и отзывов</li>
              <li>Эскроу-защиту платежей</li>
              <li>Механизм споров и медиации</li>
              <li>Поддержку 24/7 через Telegram</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">7. Отмена и возврат</h2>
            <p>
              Клиент может отменить заказ до назначения мастера — средства возвращаются полностью.
              После назначения мастера отмена возможна через обращение в поддержку. Условия возврата
              определяются индивидуально.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">8. Ответственность</h2>
            <p>
              Платформа не несёт ответственности за качество выполненных работ. Все споры между
              Клиентом и Мастером решаются через встроенную систему диспутов. В случае
              неразрешённого спора стороны вправе обратиться в суд по месту нахождения.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">9. Изменение условий</h2>
            <p>
              Платформа вправе вносить изменения в настоящую Оферту с уведомлением пользователей
              через Telegram и на сайте. Продолжение использования Платформы после изменений
              означает согласие с новыми условиями.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">10. Контакты</h2>
            <ul className="list-none space-y-1">
              <li>📧 Email: <a href="mailto:vladlabcorp@gmail.com" className="text-primary-600 dark:text-primary-400 hover:underline">vladlabcorp@gmail.com</a></li>
              <li>📱 Telegram: <a href="https://t.me/masteruz_support" className="text-primary-600 dark:text-primary-400 hover:underline">@masteruz_support</a></li>
              <li>📞 Телефон: <a href="tel:+998957005040" className="text-primary-600 dark:text-primary-400 hover:underline">+998 95 700-50-40</a></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
