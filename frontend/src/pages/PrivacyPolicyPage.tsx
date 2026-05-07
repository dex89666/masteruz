// ============================================
// MasterUz — Политика конфиденциальности
// Соответствует Закону РУз №ЗРУ-547 «О персональных данных» (с изм.),
// Закону «Об информатизации» №560-II, Постановлению КабМин №570
// ============================================

import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { LegalRequisites } from '../components/LegalRequisites';

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

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Дата вступления в силу: 8 мая 2026 г. · Версия: 2026-05-08-legal
        </p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300 text-sm md:text-base leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">1. Общие положения</h2>
            <p>
              Настоящая Политика конфиденциальности (далее — «Политика») разработана в соответствии с
              Законом Республики Узбекистан «О персональных данных» №ЗРУ-547 от 02.07.2019 г. (с последующими
              изменениями), Законом «Об информатизации» №560-II, Положением «О реестре баз персональных
              данных» (Постановление КабМин №570) и регулирует обработку персональных данных в рамках
              сервиса MasterUz (далее — «Платформа»).
            </p>
            <p>
              <strong>Оператор:</strong> ООО «Vladlab», ИНН 313020180, Республика Узбекистан.
              Внесён в Реестр операторов персональных данных Госинспекции «Узкомназорат» (заявка подана).
            </p>
            <p>
              <strong>Принятие Политики</strong> является добровольным конклюдентным действием,
              совершаемым Пользователем при подтверждении согласия в Mini App и/или регистрации.
              Без согласия использование Платформы невозможно.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">2. Термины (ст. 4 ЗРУ-547)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Персональные данные (ПДн)</strong> — любая информация, позволяющая прямо или косвенно идентифицировать физлицо.</li>
              <li><strong>Субъект ПДн</strong> — физическое лицо, к которому относятся ПДн (Пользователь).</li>
              <li><strong>Оператор</strong> — лицо, организующее и/или осуществляющее обработку ПДн.</li>
              <li><strong>Обработка</strong> — любое действие с ПДн (сбор, запись, систематизация, хранение, изменение, передача, обезличивание, удаление).</li>
              <li><strong>Трансграничная передача</strong> — передача ПДн на территорию иностранного государства.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">3. Категории обрабатываемых данных</h2>
            <p>Оператор обрабатывает следующие категории ПДн (НЕ обрабатывает биометрические и специальные категории, кроме случаев, прямо указанных ниже):</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Идентификационные:</strong> Telegram ID, username, имя/фамилия, фото профиля, ПИНФЛ (только для мастеров — для верификации в соответствии со ст. 53 Налогового кодекса РУз).</li>
              <li><strong>Контактные:</strong> номер телефона, e-mail (опционально), адрес.</li>
              <li><strong>Геолокационные:</strong> координаты (с прямого согласия), выбранный город/район.</li>
              <li><strong>Транзакционные:</strong> сумма, дата, идентификатор платёжной транзакции, история заказов.<br/>
                  <em>Реквизиты карт мы не получаем и не храним</em> — обработку производит сертифицированный платёжный провайдер (Click/Payme) согласно стандартам PCI DSS.</li>
              <li><strong>Контентные:</strong> фотографии и голосовые сообщения, прикреплённые к заказам и отзывам; текст сообщений в чатах.</li>
              <li><strong>Технические:</strong> IP-адрес, тип устройства, браузер, время и логи действий, файлы cookie/localStorage сервиса.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">4. Цели и правовые основания обработки</h2>
            <table className="w-full text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="border border-gray-300 dark:border-gray-700 p-2 text-left">Цель</th>
                  <th className="border border-gray-300 dark:border-gray-700 p-2 text-left">Основание (ЗРУ-547)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border border-gray-300 dark:border-gray-700 p-2">Регистрация и аутентификация</td><td className="border border-gray-300 dark:border-gray-700 p-2">ст. 19 — согласие субъекта</td></tr>
                <tr><td className="border border-gray-300 dark:border-gray-700 p-2">Исполнение договора-оферты</td><td className="border border-gray-300 dark:border-gray-700 p-2">ст. 21 — исполнение договора</td></tr>
                <tr><td className="border border-gray-300 dark:border-gray-700 p-2">Подбор мастеров по геолокации</td><td className="border border-gray-300 dark:border-gray-700 p-2">ст. 19 — согласие субъекта</td></tr>
                <tr><td className="border border-gray-300 dark:border-gray-700 p-2">Уведомления через Telegram</td><td className="border border-gray-300 dark:border-gray-700 p-2">ст. 21 — исполнение договора</td></tr>
                <tr><td className="border border-gray-300 dark:border-gray-700 p-2">Платежи и финучёт</td><td className="border border-gray-300 dark:border-gray-700 p-2">ст. 21 — договор; п. 2 ст. 22 — закон</td></tr>
                <tr><td className="border border-gray-300 dark:border-gray-700 p-2">Защита прав Оператора (анти-фрод)</td><td className="border border-gray-300 dark:border-gray-700 p-2">ст. 22 — законный интерес</td></tr>
                <tr><td className="border border-gray-300 dark:border-gray-700 p-2">Налоговая отчётность</td><td className="border border-gray-300 dark:border-gray-700 p-2">ст. 22 — обязанность по закону</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">5. ИИ-обработка фотографий и голосовых сообщений</h2>
            <p>
              Платформа использует системы искусственного интеллекта (далее — «ИИ-системы») для следующих
              целей при создании заказа:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Анализ фотографий заказа</strong> — определение типа неисправности, объёма работ, расчёт сметы.</li>
              <li><strong>Распознавание голосовых сообщений</strong> (speech-to-text) — конвертация в текст для категоризации заказа.</li>
              <li><strong>Авто-модерация чата</strong> — выявление попыток обхода комиссии, передачи контактов, оскорблений.</li>
              <li><strong>Подбор подходящих мастеров</strong> — алгоритмическое ранжирование на основе геолокации, рейтинга, специализации.</li>
            </ul>
            <p className="mt-3"><strong>Гарантии при ИИ-обработке:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>ИИ-обработка происходит <strong>автоматически без участия третьих лиц</strong>;
                  результаты используются исключительно внутри Платформы.</li>
              <li>Фотографии <strong>не используются для обучения</strong> публичных моделей ИИ или продажи третьим лицам.</li>
              <li>Перед отправкой в облачные ИИ-сервисы (если применяется) данные <strong>обезличиваются</strong> —
                  удаляются метаданные EXIF, GPS-координаты, идентификаторы пользователя.</li>
              <li>Пользователь вправе <strong>отказаться от ИИ-анализа</strong> и сделать заказ вручную через поддержку.</li>
              <li>Алгоритмические решения, существенно затрагивающие права субъекта (например, отказ в регистрации),
                  принимаются <strong>с участием человека</strong> по запросу пользователя в течение 30 дней (ст. 24 ЗРУ-547).</li>
              <li>Пользователь вправе оспорить любое автоматическое решение через поддержку
                  (<a href="mailto:privacy@masteruz.uz" className="text-primary-600 dark:text-primary-400 hover:underline">privacy@masteruz.uz</a>).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">6. Меры защиты персональных данных</h2>
            <p>В соответствии со ст. 27 ЗРУ-547 и техническими требованиями Госинспекции «Узкомназорат» применяются:</p>
            <p className="font-semibold mt-3">Технические меры:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>TLS 1.2+ шифрование всех соединений (HTTPS, HSTS, обязательная переадресация).</li>
              <li>Хеширование паролей и токенов (bcrypt, scrypt, HMAC-SHA256).</li>
              <li>JWT-аутентификация с короткоживущими access-токенами (15 мин) и rotating refresh-токенами.</li>
              <li>HMAC-валидация всех запросов от Telegram (проверка <code>initData</code>).</li>
              <li>Rate limiting (Redis-backed) — защита от brute-force и DoS.</li>
              <li>Параметризованные SQL-запросы (Prisma ORM) — защита от SQL injection.</li>
              <li>CSP, X-Frame-Options, X-Content-Type-Options — защита от XSS, clickjacking.</li>
              <li>Регулярное резервное копирование с шифрованием AES-256.</li>
              <li>Журнал аудита (audit log) всех операций с ПДн.</li>
              <li>Изоляция production/dev сред; secrets хранятся в защищённом vault.</li>
            </ul>
            <p className="font-semibold mt-3">Организационные меры:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Доступ к ПДн строго по принципу наименьших привилегий (RBAC).</li>
              <li>Назначен ответственный за обработку ПДн (контакт ниже).</li>
              <li>Обязательство о неразглашении со всех сотрудников и подрядчиков.</li>
              <li>Регулярный аудит безопасности и пен-тесты.</li>
              <li>План реагирования на инциденты безопасности.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">7. Хранение и локализация данных</h2>
            <p>
              <strong>Локализация (ст. 27<sup>1</sup> ЗРУ-547):</strong> сбор и обработка ПДн граждан Республики
              Узбекистан осуществляются с использованием баз данных, расположенных на территории РУз.
              Резервные копии могут размещаться у сертифицированных провайдеров с обязательным шифрованием.
            </p>
            <p>
              <strong>Сроки хранения:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Активный аккаунт — на протяжении использования Платформы.</li>
              <li>После удаления аккаунта — 30 дней «cooling period», затем безвозвратное удаление.</li>
              <li>Бухгалтерская и налоговая первичная документация — <strong>5 лет</strong> (ст. 196 НК РУз).</li>
              <li>Журналы аудита и логи безопасности — <strong>1 год</strong>.</li>
              <li>Данные, связанные с открытыми спорами/разбирательствами, — до их завершения.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">8. Передача данных третьим лицам</h2>
            <p>Оператор не продаёт и не передаёт ПДн третьим лицам, за исключением:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Мастеру</strong> — контактные данные Клиента и адрес заказа (только после акцепта заказа Мастером).</li>
              <li><strong>Платёжным операторам</strong> (Click, Payme, Telegram Stars) — реквизиты транзакции для проведения расчёта.</li>
              <li><strong>Сертифицированным облачным провайдерам</strong> (хостинг, резервные копии) — на основании договоров, обязывающих к конфиденциальности и применению аналогичных мер защиты.</li>
              <li><strong>Госорганам РУз</strong> — по мотивированному запросу в порядке, установленном УПК РУз и Законом «Об информатизации».</li>
            </ul>
            <p className="mt-3">
              <strong>Трансграничная передача (гл. 5 ЗРУ-547):</strong> ПДн могут передаваться в страны,
              обеспечивающие адекватный уровень защиты, либо на основании прямого согласия субъекта,
              либо в целях исполнения договора (например, инфраструктура Telegram, регистр которого определяется
              условиями использования Telegram WebApp).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">9. Права субъекта (ст. 24 ЗРУ-547)</h2>
            <p>Пользователь имеет право:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Получать сведения о наличии и обработке его ПДн;</li>
              <li>Знакомиться со своими ПДн и получать их копию;</li>
              <li>Требовать уточнения, блокирования или уничтожения ПДн в случае их неполноты, неточности или незаконности обработки;</li>
              <li>Отозвать согласие на обработку (полностью или в части); при этом Платформа прекращает обработку и удаляет данные, не подлежащие обязательному хранению по закону;</li>
              <li>Возражать против автоматизированных решений и требовать рассмотрения с участием человека;</li>
              <li>Обжаловать действия Оператора в Госинспекцию «Узкомназорат» или в суд.</li>
            </ul>
            <p className="mt-3">
              <strong>Срок ответа на запрос — 30 календарных дней.</strong> Запросы направлять на{' '}
              <a href="mailto:privacy@masteruz.uz" className="text-primary-600 dark:text-primary-400 hover:underline">
                privacy@masteruz.uz
              </a>{' '}
              с указанием Telegram username и описания требования.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">10. Дети и несовершеннолетние</h2>
            <p>
              Платформа предназначена для лиц <strong>не моложе 18 лет</strong>. Оператор не осуществляет целенаправленный
              сбор ПДн несовершеннолетних. При обнаружении факта регистрации лица младше 18 лет аккаунт
              немедленно блокируется, а ПДн удаляются. Если законный представитель полагает, что
              его несовершеннолетний ребёнок предоставил данные без согласия, — обратитесь по адресу{' '}
              <a href="mailto:privacy@masteruz.uz" className="text-primary-600 dark:text-primary-400 hover:underline">
                privacy@masteruz.uz
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">11. Файлы cookie и аналогичные технологии</h2>
            <p>
              Платформа использует localStorage и sessionStorage для хранения JWT-токенов, языковых
              предпочтений и темы оформления. Сторонние рекламные трекеры не применяются.
              Аналитические инструменты (Yandex.Metrica) включаются только с согласия пользователя
              и в обезличенном режиме.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">12. Уведомления об инцидентах</h2>
            <p>
              При выявлении инцидента, повлёкшего несанкционированный доступ к ПДн или их утрату,
              Оператор:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>в течение <strong>72 часов</strong> уведомляет Госинспекцию «Узкомназорат»;</li>
              <li>в течение <strong>5 рабочих дней</strong> уведомляет затронутых субъектов через Telegram и e-mail;</li>
              <li>принимает меры по локализации и устранению последствий инцидента;</li>
              <li>проводит расследование и публикует отчёт о принятых мерах.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">13. Изменения Политики</h2>
            <p>
              Оператор вправе изменять Политику. О существенных изменениях Пользователи уведомляются
              через Mini App и e-mail не позднее чем за <strong>14 дней</strong> до вступления изменений в силу.
              При несогласии Пользователь вправе прекратить использование и потребовать удаления ПДн.
              Продолжение использования после вступления изменений в силу означает согласие.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold dark:text-white mb-2">14. Контакты</h2>
            <ul className="list-none space-y-1">
              <li><strong>Ответственный за обработку ПДн:</strong> Vladlab Privacy Officer</li>
              <li>E-mail: <a href="mailto:privacy@masteruz.uz" className="text-primary-600 dark:text-primary-400 hover:underline">privacy@masteruz.uz</a></li>
              <li>Поддержка: <a href="https://t.me/masteruz_support" className="text-primary-600 dark:text-primary-400 hover:underline">@masteruz_support</a></li>
              <li>Телефон: <a href="tel:+998957005040" className="text-primary-600 dark:text-primary-400 hover:underline">+998 95 700-50-40</a></li>
              <li><strong>Госинспекция «Узкомназорат»:</strong> <a href="https://uzcert.uz" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline">uzcert.uz</a></li>
            </ul>
          </section>

          <LegalRequisites />
        </div>
      </div>
    </div>
  );
}
