// ============================================
// MasterUz — Consent Gate
// Полноэкранный модал согласия (оферта + политика + персональные данные).
// Показывается ОДИН РАЗ перед входом через Telegram (и в Mini App). Витрину гость смотрит без него.
// Версия документов синхронизирована с backend (DOCUMENTS_VERSION).
// ============================================

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ShieldCheck, FileText, Lock, ChevronDown } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store';
import { useTranslation, LANGUAGES, type Language } from '../i18n';

const STORAGE_KEY = 'masteruz-consent-v5';
const DOCUMENTS_VERSION = '2026-10-04-legal'; // должна совпадать с backend DOCUMENTS_VERSION

/**
 * Открыть юридический документ в отдельном окне браузера.
 * В Telegram Mini App используем WebApp.openLink(), иначе — window.open.
 * Без этого Link target=_blank просто навигирует под модалом, и пользователь ничего не видит.
 * Добавляем v=DOCUMENTS_VERSION — cache-busting для внешнего браузера, чтобы он не показывал старый бандл.
 */
function openDocument(path: string) {
  const url = `${window.location.origin}${path}?v=${encodeURIComponent(DOCUMENTS_VERSION)}`;
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

// Маршруты, доступные БЕЗ согласия — иначе пользователь физически не может прочесть,
// с чем его просят согласиться. Сравниваем по pathname без trailing slash.
const PUBLIC_LEGAL_ROUTES = ['/privacy', '/terms', '/public-offer'];

/**
 * Согласие нужно тогда, когда начинается обработка персональных данных: перед входом
 * через Telegram (/login), у вошедшего пользователя и в Mini App (Telegram сразу передаёт
 * данные пользователя). Гость, который просто смотрит витрину сайта, ПДн не передаёт —
 * для cookie у него свой баннер, модал ему не показываем.
 */
function processesPersonalData(pathname: string, isAuthenticated: boolean): boolean {
  if (isAuthenticated) return true;
  if ((window as any).Telegram?.WebApp?.initData) return true;
  return pathname.replace(/\/$/, '') === '/login';
}

export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { t, language, setLanguage } = useTranslation();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const gateNotNeeded =
    PUBLIC_LEGAL_ROUTES.includes(location.pathname.replace(/\/$/, '')) ||
    !processesPersonalData(location.pathname, isAuthenticated);
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
    if (accepted || gateNotNeeded) return;
    // Сервер опознаёт только по Telegram ID (Mini App); на сайте — отметка в браузере
    const tg = getTelegramUserId();
    if (!tg) return;
    api
      .get('/local-registry/consent/status', { params: { tg } })
      .then((res) => {
        if (res.data?.data?.accepted) {
          saveLocalConsent();
          setAccepted(true);
        }
      })
      .catch(() => {/* network ok — модал останется */});
  }, [accepted, gateNotNeeded]);

  // Блокируем скролл body, пока модал открыт.
  // НЕ блокируем на юридических страницах — там модала нет, иначе пользователь не сможет читать документ.
  useEffect(() => {
    if (accepted || gateNotNeeded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [accepted, gateNotNeeded]);

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
    // Сохраняем локально СРАЗУ — пользователь не должен зависнуть из-за сети/CORS/прокси.
    // Серверная запись — best-effort: пробуем, но не блокируем UX.
    saveLocalConsent();
    try {
      await api.post('/local-registry/consent', {
        acceptedOffer: offerOk,
        acceptedPrivacy: privacyOk,
        acceptedDataProcessing: dataOk,
        telegramId: getTelegramUserId(),
      });
    } catch (e) {
      // Логируем, но не показываем пользователю — согласие уже сохранено локально.
      // Backend подтвердит при следующем заходе через /consent/status.
      // eslint-disable-next-line no-console
      console.warn('[ConsentGate] не удалось записать согласие на сервер, оставлено только локально', e);
    } finally {
      setSubmitting(false);
      setAccepted(true);
    }
  }

  if (accepted) return <>{children}</>;
  // Пропускаем на юридических страницах (документы читают до согласия) и на витрине для гостя.
  if (gateNotNeeded) return <>{children}</>;

  const allChecked = offerOk && privacyOk && dataOk;
  const canSubmit = scrolledToEnd && allChecked && !submitting;

  return (
    <>
      {/* App не рендерим под модалом: иначе он перехватывает события колеса/тача поверх overlay. */}
      <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
        <div className="bg-white dark:bg-gray-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-1">
              <ShieldCheck className="text-primary-600 dark:text-primary-400" size={28} />
              <h2 className="flex-1 text-xl font-bold text-gray-900 dark:text-white">
                {t('consent.title')}
              </h2>
              {/* Язык можно выбрать до согласия — остальной интерфейс под модалом недоступен */}
              <div className="flex gap-1 shrink-0">
                {(Object.keys(LANGUAGES) as Language[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`px-2 py-1 rounded-md text-xs font-semibold uppercase ${
                      language === lang
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    aria-label={LANGUAGES[lang].label}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('consent.subtitle')}
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
                <FileText size={16} /> 1. {t('consent.s1Title')}
              </h3>
              <p>
                {t('consent.s1Text')}
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <FileText size={16} /> 2. {t('consent.s2Title')}
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><b>{t('consent.s2ClientLabel')}:</b> {t('consent.s2Client')}</li>
                <li><b>{t('consent.s2MasterLabel')}:</b> {t('consent.s2Master')}</li>
                <li><b>{t('consent.s2TechLabel')}:</b> {t('consent.s2Tech')}</li>
                <li><b>{t('consent.s2PayLabel')}:</b> {t('consent.s2Pay')}</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Lock size={16} /> 3. {t('consent.s3Title')}
              </h3>
              <p>
                {t('consent.s3Text')}
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <ShieldCheck size={16} /> 4. {t('consent.s4Title')}
              </h3>
              <p>
                {t('consent.s4Text')} <b>vladlabcorp@gmail.com</b>,
                Telegram <b>@masteruz_support</b>.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <FileText size={16} /> 5. {t('consent.s5Title')}
              </h3>
              <p>
                {t('consent.s5Text')}
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <FileText size={16} /> 6. {t('consent.s6Title')}
              </h3>
              <p className="space-y-1">
                {t('consent.s6Text')}
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={() => openDocument('/public-offer')}
                    className="text-primary-600 dark:text-primary-400 underline text-left"
                  >
                    {t('home.publicOffer')}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openDocument('/privacy')}
                    className="text-primary-600 dark:text-primary-400 underline text-left"
                  >
                    {t('home.privacyPolicy')}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openDocument('/terms')}
                    className="text-primary-600 dark:text-primary-400 underline text-left"
                  >
                    {t('consent.rules')}
                  </button>
                </li>
              </ul>
            </section>

            <section className="pt-2 pb-1 text-xs text-gray-500 dark:text-gray-400">
              {t('consent.version')}: <code>{DOCUMENTS_VERSION}</code>. {t('consent.versionNote')}
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
              {t('consent.scrollToEnd')}
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
                  {t('consent.acceptOffer')}{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); openDocument('/public-offer'); }}
                    className="text-primary-600 dark:text-primary-400 underline"
                  >
                    {t('consent.offerAcc')}
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
                  {t('consent.readPrivacy')}{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); openDocument('/privacy'); }}
                    className="text-primary-600 dark:text-primary-400 underline"
                  >
                    {t('consent.privacyIns')}
                  </button>
                </>
              }
            />
            <Checkbox
              checked={dataOk}
              onChange={setDataOk}
              disabled={!scrolledToEnd}
              label={t('consent.dataConsent')}
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
              {t('consent.decline')}
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleAccept}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
            >
              {submitting ? t('consent.saving') : t('consent.accept')}
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
