// ============================================
// MasterUz — Privacy Policy (Политика конфиденциальности)
// ============================================

import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export function PrivacyPolicyPage() {
  return (
    <div className="page-container pb-20 max-w-4xl">
      <Link to="/" className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4">
        <ArrowLeft size={18} className="mr-1" /> Главная
      </Link>

      <div className="card dark:bg-gray-800 dark:ring-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <Shield size={28} className="text-primary-600 dark:text-primary-400" />
          <h1 className="text-2xl md:text-3xl font-bold dark:text-white">Политика конфиденциальности</h1>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Дата последнего обновления: 24 февраля 2026 г.</p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300 text-sm md:text-base leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">1. Общие положения</h2>
            <p>
              Настоящая Политика конфиденциальности (далее — «Политика») определяет порядок обработки и защиты
              персональных данных пользователей платформы MasterUz (далее — «Платформа»), доступной по адресу
              masteruz-ecru.vercel.app, а также через Telegram Mini App.
            </p>
            <p>
              Оператором персональных данных является MasterUz (далее — «Оператор»). Используя Платформу, вы
              соглашаетесь с условиями настоящей Политики.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">2. Какие данные мы собираем</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Telegram ID, имя, фамилия, username, фото профиля</li>
              <li>Номер телефона (при указании в профиле)</li>
              <li>Город, район, адрес проживания</li>
              <li>Геолокация (при разрешении пользователя)</li>
              <li>Фотографии и голосовые сообщения (при создании заказов)</li>
              <li>История заказов, отзывы, переписка в чатах</li>
              <li>Данные об использовании (IP-адрес, тип устройства, браузер)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">3. Цели обработки данных</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Регистрация и аутентификация пользователей через Telegram</li>
              <li>Создание и обработка заказов на бытовые услуги</li>
              <li>Подбор мастеров по геолокации и специализации</li>
              <li>Уведомления о статусе заказов через Telegram Bot</li>
              <li>Проведение платежей и учёт баланса</li>
              <li>Улучшение качества сервиса и аналитика</li>
              <li>Рассмотрение споров и обращений в поддержку</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">4. Хранение и защита данных</h2>
            <p>
              Персональные данные хранятся на защищённых серверах (Neon PostgreSQL, Vercel).
              Мы применяем технические и организационные меры для предотвращения несанкционированного доступа:
              шифрование данных при передаче (HTTPS/TLS), rate limiting, HMAC-валидация Telegram-запросов,
              JWT-аутентификация с ротацией токенов.
            </p>
            <p>
              Данные хранятся в течение срока использования аккаунта и 3 года после последней активности,
              если иное не предусмотрено законодательством.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">5. Передача данных третьим лицам</h2>
            <p>
              Мы не продаём и не передаём персональные данные третьим лицам, за исключением:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Мастерам — контактные данные клиента (после оплаты комиссии)</li>
              <li>Платёжным системам — для проведения транзакций</li>
              <li>Государственным органам — по запросу в соответствии с законодательством Республики Узбекистан</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">6. Права пользователей</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Доступ к своим персональным данным через профиль</li>
              <li>Изменение и обновление данных в настройках</li>
              <li>Удаление аккаунта — обратитесь в поддержку</li>
              <li>Отзыв согласия на обработку — прекращение использования Платформы</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">7. Файлы cookie и аналитика</h2>
            <p>
              Платформа может использовать localStorage для хранения пользовательских настроек
              (тема оформления, язык, режим «Крупный текст»). Мы не используем сторонние рекламные трекеры.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">8. Контакты</h2>
            <p>По вопросам обработки персональных данных:</p>
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
