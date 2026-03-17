// ============================================
// MasterUz — Terms of Service (Условия использования)
// ============================================

import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';

export function TermsOfServicePage() {
  return (
    <div className="page-container pb-20 max-w-4xl">
      <Link to="/" className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4">
        <ArrowLeft size={18} className="mr-1" /> Главная
      </Link>

      <div className="card dark:bg-gray-800 dark:ring-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen size={28} className="text-primary-600 dark:text-primary-400" />
          <h1 className="text-2xl md:text-3xl font-bold dark:text-white">Условия использования</h1>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Дата последнего обновления: 24 февраля 2026 г.</p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300 text-sm md:text-base leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">1. Принятие условий</h2>
            <p>
              Используя платформу MasterUz (веб-сайт, Telegram Mini App), вы подтверждаете, что прочитали,
              поняли и согласны соблюдать настоящие Условия использования. Если вы не согласны —
              прекратите использование Платформы.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">2. Регистрация</h2>
            <p>
              Регистрация осуществляется через Telegram. Пользователь обязуется предоставить
              достоверные данные. Платформа оставляет за собой право заблокировать аккаунт
              при предоставлении ложных сведений.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">3. Правила для клиентов</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Описывать задачу чётко и полно (текст, фото, голос)</li>
              <li>Указывать реальный адрес выполнения работ</li>
              <li>Обеспечить доступ мастеру к месту проведения работ</li>
              <li>Оплатить стоимость работ через систему эскроу</li>
              <li>Подтвердить выполнение или открыть спор в течение 72 часов</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">4. Правила для мастеров</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Пройти верификацию и заполнить профиль мастера</li>
              <li>Выполнять работу качественно и в оговорённые сроки</li>
              <li>Оплатить комиссию платформы перед получением контактов клиента</li>
              <li>Не передавать контакты клиентов третьим лицам</li>
              <li>Пройти обучение в Школе мастеров (рекомендуется)</li>
              <li>Поддерживать рейтинг не ниже 3.5 из 5</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">5. Запрещённые действия</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Размещение ложных заказов или откликов</li>
              <li>Создание нескольких аккаунтов</li>
              <li>Попытки обхода системы оплаты</li>
              <li>Оскорбления, угрозы, дискриминация в чатах</li>
              <li>Загрузка запрещённого контента</li>
              <li>Использование автоматизированных средств (ботов) для накрутки</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">6. Интеллектуальная собственность</h2>
            <p>
              Все элементы Платформы (дизайн, код, тексты, логотипы) являются собственностью MasterUz.
              Пользователи сохраняют права на загруженный ими контент (фото, отзывы), но предоставляют
              Платформе неисключительную лицензию на его использование в рамках сервиса.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">7. Возрастные ограничения</h2>
            <p>
              Платформа предназначена для лиц старше 18 лет. Регистрируясь, вы подтверждаете
              достижение совершеннолетия.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">8. Ограничение ответственности</h2>
            <p>
              Платформа предоставляется «как есть». MasterUz не гарантирует бесперебойную работу
              сервиса, но прилагает все усилия для обеспечения стабильности. Платформа не несёт
              ответственности за действия мастеров и клиентов вне сервиса.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">9. Применимое право</h2>
            <p>
              Настоящие Условия регулируются законодательством Республики Узбекистан.
              Все споры разрешаются путём переговоров, а при недостижении согласия —
              в компетентном суде Республики Узбекистан.
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
