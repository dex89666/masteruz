// ============================================
// MasterUz — Consent Gate
// Полноэкранный модал согласия (оферта + политика + персональные данные).
// Показывается ОДИН РАЗ при первом входе. Без согласия приложение не работает.
// Версия документов синхронизирована с backend (DOCUMENTS_VERSION).
// ============================================

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, FileText, Lock, ChevronDown } from 'lucide-react';
import { api } from '../api/client';

const STORAGE_KEY = 'masteruz-consent-v5';
const DOCUMENTS_VERSION = '2026-05-08-legal'; // должна совпадать с backend DOCUMENTS_VERSION

/**
 * Открыть юридический документ в отдельном окне браузера.
 * В Telegram Mini App используем WebApp.openLink(), иначе — window.open.
 * Без этого Link target=_blank просто навигирует под модалом, и пользователь ничего не видит.
 */
function openDocument(path: string) {
  const url = `${window.location.origin}${path}`;
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openLink) {
    tg.openLink(url, { try_instant_view: false });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Telegram user id из Mini App. Важно для изоляции согласий между пользователями:
 * в Telegram WebView и IP, и User-Agent обычно одинаковые — без этого ключа согласие одного
 * юзера считалось бы действительным для всех остальных.
 */
function getTelegramUserId(): string | undefined {
  const id = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return id ? String(id) : undefined;
}

interface ConsentSnapshot {
  version: string;
  acceptedAt: string;
}

function loadLocalConsent(): ConsentSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentSnapshot;
    return parsed.version === DOCUMENTS_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function saveLocalConsent() {
  try {
    const snap: ConsentSnapshot = { version: DOCUMENTS_VERSION, acceptedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* no-op: storage недоступен (приватный режим) */
  }
}

export function ConsentGate({ children }: { children: React.ReactNode }) {
  const [accepted, setAccepted] = useState<boolean>(() => !!loadLocalConsent());
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [offerOk, setOfferOk] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);
  const [dataOk, setDataOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Сверка с сервером — если он сказал «согласие записано», доверяем серверу
  useEffect(() => {
    if (accepted) return;
    const tg = getTelegramUserId();
    api
      .get('/local-registry/consent/status', { params: tg ? { tg } : undefined })
      .then((res) => {
        if (res.data?.data?.accepted) {
          saveLocalConsent();
          setAccepted(true);
        }
      })
      .catch(() => {/* network ok — модал останется */});
  }, [accepted]);

  // Блокируем скролл body, пока модал открыт
  useEffect(() => {
    if (accepted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [accepted]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    // 8px эпсилон — телефоны иногда не доезжают до пикселя в пиксель
    const reachedEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    if (reachedEnd) setScrolledToEnd(true);
  }

  function handleDecline() {
    // В Telegram Mini App — корректное закрытие; иначе — на главную Telegram
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.close) {
      tg.close();
      return;
    }
    window.location.assign('https://t.me');
  }

  async function handleAccept() {
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/local-registry/consent', {
        acceptedOffer: offerOk,
        acceptedPrivacy: privacyOk,
        acceptedDataProcessing: dataOk,
        telegramId: getTelegramUserId(),
      });
      saveLocalConsent();
      setAccepted(true);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Не удалось сохранить согласие. Проверьте подключение.');
    } finally {
      setSubmitting(false);
    }
  }

  if (accepted) return <>{children}</>;

  const allChecked = offerOk && privacyOk && dataOk;
  const canSubmit = scrolledToEnd && allChecked && !submitting;

  return (
    <>
      {children}

      <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white dark:bg-gray-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-1">
              <ShieldCheck className="text-primary-600 dark:text-primary-400" size={28} />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Согласие на использование платформы
              </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ООО «Vladlab» · ИНН 313020180 · информационный посредник
            </p>
          </div>

          {/* Scrollable content */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-6 py-5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-5 scroll-smooth"
          >
            <section>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <FileText size={16} /> 1. Кто мы и что предлагаем
              </h3>
              <p>
                Платформа «MasterUz» принадлежит <b>ООО «Vladlab»</b> (ИНН 313020180,
                ОКЭД 63.12.0 — Деятельность веб-порталов). Мы — <b>информационный посредник</b>:
                связываем клиента и мастера, удерживаем агентскую комиссию и не оказываем
                ремонтных услуг лично. Договор на работы заключается между клиентом и мастером
                напрямую.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <FileText size={16} /> 2. Какие данные мы собираем
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><b>Клиент:</b> имя, телефон, описание заказа, адрес, сумма оплаты.</li>
                <li><b>Мастер:</b> ПИНФЛ, ФИО, телефон, адрес, виды работ, история выполненных заказов.</li>
                <li><b>Технические данные:</b> IP, устройство, действия в приложении, по согласию — геолокация.</li>
                <li><b>Платежи:</b> сумма, дата, идентификатор транзакции (данные карт мы НЕ храним).</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Lock size={16} /> 3. Как мы защищаем данные
              </h3>
              <p>
                TLS-шифрование, Redis-backed rate limiting, ролевая модель доступа, журнал
                операций (audit log), шифрованные резервные копии. Доступ только у уполномоченных
                сотрудников. Данные хранятся на инфраструктуре Оператора в РУз.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <ShieldCheck size={16} /> 4. Ваши права
              </h3>
              <p>
                Вы можете запросить копию данных, исправление, удаление, отозвать согласие или
                подать жалобу. Срок ответа — 30 дней. Контакты: <b>privacy@masteruz.uz</b>,
                Telegram <b>@masteruz_support</b>.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <FileText size={16} /> 5. Стоимость и комиссия
              </h3>
              <p>
                Платформа взимает комиссию за информационно-посреднические услуги в размере,
                установленном в соответствии с законодательством Республики Узбекистан. Актуальный размер комиссии
                и иных тарифов отображается в Платформе до подтверждения оплаты. Способы оплаты: Click, Payme, Telegram Stars
                или наличные напрямую Мастеру (в этом случае Мастер обязан самостоятельно перечислить комиссию Платформе).
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <FileText size={16} /> 6. Полные документы
              </h3>
              <p className="space-y-1">
                Прежде чем согласиться, мы рекомендуем ознакомиться с полными версиями:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={() => openDocument('/public-offer')}
                    className="text-primary-600 dark:text-primary-400 underline text-left"
                  >
                    Публичная оферта
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openDocument('/privacy')}
                    className="text-primary-600 dark:text-primary-400 underline text-left"
                  >
                    Политика конфиденциальности
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openDocument('/terms')}
                    className="text-primary-600 dark:text-primary-400 underline text-left"
                  >
                    Правила пользования
                  </button>
                </li>
              </ul>
            </section>

            <section className="pt-2 pb-1 text-xs text-gray-500 dark:text-gray-400">
              Версия документов: <code>{DOCUMENTS_VERSION}</code>. При обновлении ключевых условий
              согласие будет запрошено повторно.
            </section>
          </div>

          {/* Подсказка «прокрутите до конца» */}
          {!scrolledToEnd && (
            <button
              type="button"
              onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
              className="flex items-center justify-center gap-2 px-6 py-2 text-sm text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border-t border-primary-100 dark:border-primary-900/40 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
            >
              <ChevronDown size={16} />
              Прокрутите до конца, чтобы продолжить
            </button>
          )}

          {/* Чекбоксы */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
            <Checkbox
              checked={offerOk}
              onChange={setOfferOk}
              disabled={!scrolledToEnd}
              label={
                <>
                  Я ознакомился(-ась) и принимаю{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); openDocument('/public-offer'); }}
                    className="text-primary-600 dark:text-primary-400 underline"
                  >
                    Публичную оферту
                  </button>
                </>
              }
            />
            <Checkbox
              checked={privacyOk}
              onChange={setPrivacyOk}
              disabled={!scrolledToEnd}
              label={
                <>
                  Я ознакомился(-ась) с{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); openDocument('/privacy'); }}
                    className="text-primary-600 dark:text-primary-400 underline"
                  >
                    Политикой конфиденциальности
                  </button>
                </>
              }
            />
            <Checkbox
              checked={dataOk}
              onChange={setDataOk}
              disabled={!scrolledToEnd}
              label="Даю согласие на обработку персональных данных в соответствии с Законом РУз № ЗРУ-547"
            />

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}
          </div>

          {/* Action */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3 sm:justify-end bg-white dark:bg-gray-900">
            <button
              type="button"
              onClick={handleDecline}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Не согласен(-на) — выйти
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleAccept}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
            >
              {submitting ? 'Сохраняем…' : 'Согласен(-на) и продолжить'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: React.ReactNode;
}

function Checkbox({ checked, onChange, disabled, label }: CheckboxProps) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 cursor-pointer disabled:cursor-not-allowed"
      />
      <span className="text-gray-700 dark:text-gray-300 select-none">{label}</span>
    </label>
  );
}
