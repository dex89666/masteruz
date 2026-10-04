// ============================================
// MasterUz — Login Page (i18n)
// ============================================

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { useAuthStore } from '../store';
import { authApi } from '../api/client';
import { useTelegram } from '../hooks';
import { useTranslation } from '../i18n';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Wrench, Zap, Shield, Wallet, Send } from 'lucide-react';
import toast from 'react-hot-toast';

// Виджет Telegram работает только на домене, привязанном к боту в BotFather (/setdomain).
// На остальных адресах он пишет «Bot domain invalid» — там входим только через бота.
const LOGIN_WIDGET_HOST = 'www.mestro.uz';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Куда вернуть после входа: если пришли из воронки (напр. /calculator → /instant-order) — туда.
  const redirectTo = ((location.state as any)?.from as string) || '/';
  const { setAuth, isAuthenticated } = useAuthStore();
  const { isMiniApp, initData } = useTelegram();
  const { t, language } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [waitingForBot, setWaitingForBot] = useState(false);
  const [showWidget, setShowWidget] = useState(false);

  // Если уже авторизован — редирект
  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo);
    }
  }, [isAuthenticated, navigate, redirectTo]);

  // Авторизация через Telegram Mini App (автоматическая)
  useEffect(() => {
    if (isMiniApp && initData) {
      handleMiniAppLogin();
    }
  }, [isMiniApp, initData]);

  async function handleMiniAppLogin() {
    setLoading(true);
    try {
      const response = await authApi.loginMiniApp(initData);
      if (response.data.success) {
        const { user, accessToken, refreshToken } = response.data.data;
        setAuth(user, accessToken, refreshToken);
        toast.success(t('auth.welcome'));
        navigate(redirectTo);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || t('auth.authError'));
    } finally {
      setLoading(false);
    }
  }

  // Telegram Login Widget — дополнительно к входу через бота, только на домене из BotFather.
  const isNative = Capacitor.isNativePlatform();

  // ─── Официальный вход Telegram (OpenID Connect) ─────────
  // Подтверждение в окне Telegram; уведомление о входе присылает официальный
  // аккаунт Telegram. Бэкенд возвращает сюда ?tg_session=… (или ?tg_error=…).
  const [oidcEnabled, setOidcEnabled] = useState(false);
  useEffect(() => {
    if (isNative) return; // в приложении — вход через бота
    authApi.telegramOidcConfig()
      .then((res) => setOidcEnabled(!!res.data.data?.enabled))
      .catch(() => {});
  }, [isNative]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const session = params.get('tg_session');
    const error = params.get('tg_error');
    if (!session && !error) return;
    // Убираем одноразовые параметры из адреса, чтобы не повторять при обновлении
    window.history.replaceState(null, '', location.pathname);
    if (error) {
      toast.error(error === 'cancelled' ? t('auth.oidcCancelled') : error === 'blocked' ? t('auth.oidcBlocked') : t('auth.authError'));
      return;
    }
    const target = params.get('redirect');
    const next = target && target.startsWith('/') && !target.startsWith('//') ? target : redirectTo;
    setLoading(true);
    authApi.botAuthPoll(session!)
      .then((res) => {
        const data = res.data?.data;
        if (res.data?.success && data?.ready && data.accessToken && data.refreshToken) {
          setAuth(data.user, data.accessToken, data.refreshToken);
          toast.success(t('auth.welcome'));
          navigate(next);
        } else {
          toast.error(t('auth.sessionExpired'));
        }
      })
      .catch(() => toast.error(t('auth.sessionExpired')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // JS-библиотека Telegram: окно входа поверх сайта, id_token приходит сразу в
  // браузер — без обмена кода с Client Secret. Nonce и скрипт готовим заранее:
  // окно нужно открыть синхронно по клику, иначе браузер заблокирует popup.
  const oidcSessionRef = useRef<{ clientId: number; nonce: string } | null>(null);
  const refreshOidcNonce = () =>
    authApi.telegramOidcNonce()
      .then((res) => { oidcSessionRef.current = res.data.data ?? null; })
      .catch(() => { oidcSessionRef.current = null; });

  useEffect(() => {
    if (!oidcEnabled) return;
    refreshOidcNonce();
    if (!document.getElementById('telegram-login-lib')) {
      const script = document.createElement('script');
      script.id = 'telegram-login-lib';
      script.src = 'https://oauth.telegram.org/js/telegram-login.js?6';
      script.async = true;
      document.head.appendChild(script);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oidcEnabled]);

  function handleOidcLogin() {
    const tgLogin = (window as any).Telegram?.Login;
    const session = oidcSessionRef.current;
    if (!tgLogin?.auth || !session) {
      // Библиотека не загрузилась — классический переход на страницу Telegram
      window.location.href = authApi.telegramOidcStartUrl(redirectTo);
      return;
    }
    oidcSessionRef.current = null; // nonce одноразовый
    tgLogin.auth(
      { client_id: session.clientId, scope: ['profile', 'phone'], lang: language, nonce: session.nonce },
      async (data: { id_token?: string; error?: string }) => {
        if (!data?.id_token) {
          if (data?.error) toast.error(t('auth.oidcCancelled'));
          refreshOidcNonce();
          return;
        }
        setLoading(true);
        try {
          const res = await authApi.telegramOidcToken(data.id_token);
          const { user, accessToken, refreshToken } = res.data.data;
          setAuth(user, accessToken, refreshToken);
          toast.success(t('auth.welcome'));
          navigate(redirectTo);
        } catch (err: any) {
          toast.error(err?.response?.data?.error?.message || t('auth.authError'));
          refreshOidcNonce();
        } finally {
          setLoading(false);
        }
      },
    );
  }
  // Старый виджет Telegram не нужен, когда включён вход OpenID Connect: в BotFather
  // он заменяет виджет, и тот начинает выдавать ошибку.
  const widgetSupported = !isNative && !oidcEnabled && window.location.hostname === LOGIN_WIDGET_HOST;

  useEffect(() => {
    if (!widgetSupported) return;
    (window as any).onTelegramAuth = async (user: any) => {
      setLoading(true);
      try {
        const response = await authApi.loginTelegram(user);
        if (response.data.success) {
          const { user: userData, accessToken, refreshToken } = response.data.data;
          setAuth(userData, accessToken, refreshToken);
          toast.success(t('auth.welcome'));
          navigate(redirectTo);
        }
      } catch (error: any) {
        toast.error(error.response?.data?.error?.message || t('auth.authError'));
      } finally {
        setLoading(false);
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', import.meta.env.VITE_TELEGRAM_BOT_NAME || 'MasterUzBot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    const widgetContainer = document.getElementById('telegram-login-widget');
    if (widgetContainer) {
      widgetContainer.replaceChildren(script);
    }

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [setAuth, navigate, widgetSupported, t, redirectTo]);

  // ─── One-tap логин через бота (native) ──────────────
  // Идея: создаём токен на бэке → открываем чат с ботом по deep-link →
  // юзер тапает Start → webhook бота кладёт JWT в Redis → мы поллим и забираем.
  // Никаких номеров телефона и SMS-кодов.
  const pollAbortRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => () => pollAbortRef.current?.stop(), []);

  // Когда пользователь возвращается из Telegram в наше приложение —
  // ускоряем следующий poll, не ждём интервал.
  const lastTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isNative) return;
    const handle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && lastTokenRef.current) {
        pollOnce(lastTokenRef.current).catch(() => {});
      }
    });
    return () => {
      handle.then(h => h.remove());
    };
  }, [isNative]);

  async function pollOnce(token: string): Promise<boolean> {
    try {
      const res = await authApi.botAuthPoll(token);
      if (res.data?.success && res.data.data?.ready) {
        const { accessToken, refreshToken, user } = res.data.data;
        if (accessToken && refreshToken) {
          setAuth(user, accessToken, refreshToken);
          toast.success(t('auth.welcome'));
          navigate(redirectTo);
          return true;
        }
      }
    } catch (err: any) {
      // 410 — сессия истекла
      if (err?.response?.status === 410) {
        pollAbortRef.current?.stop();
        toast.error(t('auth.sessionExpired'));
        setWaitingForBot(false);
      }
    }
    return false;
  }

  // Ссылка на бота — показываем и в ожидании: если браузер заблокировал новую вкладку
  const [botLink, setBotLink] = useState<string | null>(null);

  async function handleBotLogin() {
    // Защита от двойного клика
    if (waitingForBot) return;
    setWaitingForBot(true);
    // В браузере вкладку открываем сразу по клику: после await браузер счёл бы её всплывающим окном
    const webTab = isNative ? null : window.open('', '_blank');
    try {
      const startRes = await authApi.botAuthStart();
      const data = startRes.data?.data;
      if (!startRes.data?.success || !data) {
        throw new Error(t('auth.startFailed'));
      }
      lastTokenRef.current = data.token;
      setBotLink(data.webLink);

      if (isNative) {
        // Открываем Telegram. tg:// откроет нативное приложение мгновенно,
        // если оно установлено. Если нет — браузер автоматически уйдёт на webLink.
        window.open(data.deepLink, '_system', 'noopener,noreferrer');
        // Подстраховка для устройств без Telegram-app: чуть позже открываем web.
        setTimeout(() => {
          if (waitingForBot) {
            window.open(data.webLink, '_system', 'noopener,noreferrer');
          }
        }, 800);
      } else if (webTab) {
        // t.me сам предложит открыть Telegram (приложение или web.telegram.org)
        webTab.location.href = data.webLink;
      }

      // Поллим до 2 минут с интервалом 1.5 сек.
      const startedAt = Date.now();
      const deadline = startedAt + 2 * 60 * 1000;
      let stopped = false;
      pollAbortRef.current = {
        stop: () => {
          stopped = true;
          setWaitingForBot(false);
        },
      };

      while (!stopped && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500));
        if (stopped) break;
        const done = await pollOnce(data.token);
        if (done) {
          pollAbortRef.current = null;
          return;
        }
      }
      if (!stopped) {
        setWaitingForBot(false);
        toast.error(t('auth.waitTimeout'));
      }
    } catch (err: any) {
      webTab?.close();
      setWaitingForBot(false);
      toast.error(err?.response?.data?.error?.message || err?.message || t('auth.authError'));
    }
  }

  function cancelBotAuth() {
    pollAbortRef.current?.stop();
    pollAbortRef.current = null;
    lastTokenRef.current = null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-gray-500 dark:text-gray-400 mt-4">{t('auth.authInProgress')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="card max-w-md w-full text-center">
        {/* Logo section */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 animate-scale-in">
            <Wrench size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('auth.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t('auth.subtitle')}
          </p>
        </div>

        {/* Features list */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-blue-500" />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{t('auth.featureFast')}</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-1.5 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-green-500" />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{t('auth.featureSafe')}</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Wallet size={20} className="text-purple-500" />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{t('auth.featurePrice')}</p>
          </div>
        </div>

        {/* Вход через бота — работает на любом адресе сайта и в приложении */}
        <div className="flex justify-center mb-4">
          {waitingForBot ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="flex items-center gap-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 px-5 py-4 w-full justify-center">
                <LoadingSpinner size="sm" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {t('auth.botWaitHint')}
                </span>
              </div>
              {botLink && (
                <a
                  href={botLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#229ED9] hover:underline"
                >
                  {t('auth.openTelegram')}
                </a>
              )}
              {/* Запасной путь: на Linux/Windows ссылка tg:// может не открыть Telegram
                  (несколько установленных копий, нет обработчика). Тогда команду
                  можно отправить боту вручную — webhook примет её так же, как Start. */}
              {botLink && lastTokenRef.current && (
                <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-600 dark:text-gray-400 space-y-2">
                  <p>{t('auth.manualHint')}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-lg bg-gray-100 dark:bg-gray-800 px-2 py-1.5 font-mono text-[11px] text-gray-800 dark:text-gray-200">
                      /start auth_{lastTokenRef.current}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard
                          ?.writeText(`/start auth_${lastTokenRef.current}`)
                          .then(() => toast.success(t('common.linkCopied')))
                          .catch(() => {});
                      }}
                      className="shrink-0 rounded-lg bg-[#229ED9] px-2.5 py-1.5 font-medium text-white"
                    >
                      {t('auth.copy')}
                    </button>
                  </div>
                  <a
                    href={`https://web.telegram.org/k/#@${new URL(botLink).pathname.slice(1)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block font-medium text-[#229ED9] hover:underline"
                  >
                    {t('auth.openTelegramWeb')}
                  </a>
                </div>
              )}
              <button
                type="button"
                onClick={cancelBotAuth}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {t('common.cancel')}
              </button>
            </div>
          ) : oidcEnabled ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleOidcLogin}
                className="inline-flex items-center gap-3 rounded-2xl bg-[#229ED9] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#229ED9]/30 transition active:scale-[0.98] hover:bg-[#1c8bc0]"
              >
                <Send size={20} />
                {t('auth.loginTelegram')}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs text-center">{t('auth.oidcHint')}</p>
              <button
                type="button"
                onClick={handleBotLogin}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:underline"
              >
                {t('auth.viaBot')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleBotLogin}
              className="inline-flex items-center gap-3 rounded-2xl bg-[#229ED9] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#229ED9]/30 transition active:scale-[0.98] hover:bg-[#1c8bc0]"
            >
              <Send size={20} />
              {t('auth.loginTelegram')}
            </button>
          )}
        </div>

        {/* Запасной способ — виджет Telegram (подтверждение по номеру телефона).
            Скрыт под ссылкой: две кнопки «Войти через Telegram» подряд сбивают с толку.
            Контейнер всегда в DOM — в него скрипт виджета вставляет свою кнопку. */}
        {widgetSupported && !waitingForBot && !showWidget && (
          <button
            type="button"
            onClick={() => setShowWidget(true)}
            className="mb-6 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:underline"
          >
            {t('auth.widgetFallback')}
          </button>
        )}
        {widgetSupported && (
          <div
            id="telegram-login-widget"
            className={showWidget && !waitingForBot ? 'flex justify-center mb-6' : 'hidden'}
          />
        )}

        <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {t('auth.legalConsent')}{' '}
            <a href="/public-offer" className="text-primary-600 dark:text-primary-400 hover:underline">
              {t('auth.publicOffer')}
            </a>{' '}
            {t('auth.and')}{' '}
            <a href="/privacy" className="text-primary-600 dark:text-primary-400 hover:underline">
              {t('auth.privacyPolicy')}
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
