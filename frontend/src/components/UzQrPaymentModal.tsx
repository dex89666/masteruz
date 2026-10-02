// ============================================
// MasterUz — Окно оплаты по QR (UzQR, Hamkorbank)
// Бэкенд создаёт платёж и ссылку динамического QR → рисуем QR, ждём подтверждения банка.
// ============================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, ExternalLink, CheckCircle2, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import { uzqrApi, type UzQrOrder, type UzQrPurpose } from '../api/client';
import { useFormatPrice } from '../hooks';
import { LoadingSpinner } from './LoadingSpinner';
import { useTranslation } from '../i18n';

/** Оплата по QR включается флагом сборки, пока банк не подключён — её не видно. */
export const UZQR_ENABLED = import.meta.env.VITE_UZQR_ENABLED === 'true';

const POLL_MS = 3000;

interface UzQrPaymentModalProps {
  isOpen: boolean;
  purpose: UzQrPurpose;
  title: string;
  onClose: () => void;
  onPaid?: () => void;
}

type Phase = 'loading' | 'ready' | 'paid' | 'expired' | 'failed' | 'error';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Telegram WebView и старые браузеры: запасной путь через выделение текста
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function formatLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function UzQrPaymentModal({ isOpen, purpose, title, onClose, onPaid }: UzQrPaymentModalProps) {
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();
  const [phase, setPhase] = useState<Phase>('loading');
  const [order, setOrder] = useState<UzQrOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const purposeKey = JSON.stringify(purpose);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  const createQr = useCallback(async () => {
    setPhase('loading');
    setError(null);
    setCopied(false);
    try {
      const res = await uzqrApi.create(JSON.parse(purposeKey) as UzQrPurpose);
      setOrder(res.data.data ?? null);
      setPhase('ready');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || t('uzqr.createFailed'));
      setPhase('error');
    }
  }, [purposeKey]);

  // Новый QR при каждом открытии окна
  useEffect(() => {
    if (isOpen) createQr();
    else setOrder(null);
  }, [isOpen, createQr]);

  // Таймер до истечения QR
  useEffect(() => {
    if (phase !== 'ready') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const expiresAtMs = order ? new Date(order.expiresAt).getTime() : 0;
  useEffect(() => {
    if (phase === 'ready' && expiresAtMs && now >= expiresAtMs) setPhase('expired');
  }, [phase, now, expiresAtMs]);

  // Ждём подтверждения банка
  useEffect(() => {
    if (phase !== 'ready' || !order) return;
    let stopped = false;
    const t = setInterval(async () => {
      try {
        const res = await uzqrApi.status(order.paymentId);
        if (stopped) return;
        const status = res.data.data?.status;
        if (status === 'COMPLETED') {
          setPhase('paid');
          onPaidRef.current?.();
        } else if (status === 'FAILED') {
          setPhase('failed');
        }
      } catch {
        /* сеть — попробуем на следующем шаге */
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [phase, order]);

  // Escape закрывает окно
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleCopy() {
    if (!order) return;
    const ok = await copyText(order.qrUrl);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="uzqr-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 id="uzqr-title" className="font-bold text-gray-900 dark:text-white">{t('uzqr.title')}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{title}</p>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-5 text-center">
          {phase === 'loading' && (
            <div className="py-16 flex flex-col items-center gap-3">
              <LoadingSpinner size="lg" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('uzqr.creating')}</p>
            </div>
          )}

          {phase === 'ready' && order && (
            <>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{formatPrice(order.amount)}</p>

              {/* Белая подложка — QR должен читаться и в тёмной теме */}
              <div className="inline-block bg-white p-3 rounded-xl border border-gray-200 dark:border-gray-600">
                <QRCodeSVG value={order.qrUrl} size={220} level="M" marginSize={1} />
              </div>

              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                {t('uzqr.scan')}
              </p>
              <p className="mt-1 text-xs text-gray-400 flex items-center justify-center gap-1">
                <Clock size={12} /> {t('uzqr.validFor')} {formatLeft(expiresAtMs - now)}
              </p>

              {order.mock && (
                <p className="mt-3 text-xs rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 p-2">
                  {t('uzqr.testMode')}
                </p>
              )}

              <button
                onClick={handleCopy}
                className="mt-4 w-full py-3 rounded-xl font-semibold border-2 border-primary-500 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center justify-center gap-2"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? t('common.linkCopied') : t('uzqr.copyLink')}
              </button>
              <a
                href={order.qrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 flex items-center justify-center gap-2 sm:hidden"
              >
                <ExternalLink size={18} /> {t('uzqr.openBank')}
              </a>

              <p className="mt-4 text-xs text-gray-400 flex items-center justify-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary-500 animate-pulse" /> {t('uzqr.waiting')}
              </p>
            </>
          )}

          {phase === 'paid' && (
            <div className="py-10 flex flex-col items-center gap-3">
              <CheckCircle2 size={56} className="text-green-500" />
              <p className="text-lg font-bold text-gray-900 dark:text-white">{t('uzqr.paid')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('uzqr.telegramToo')}</p>
              <button onClick={onClose} className="mt-2 px-6 py-2.5 rounded-xl bg-primary-600 text-white font-semibold">
                {t('uzqr.done')}
              </button>
            </div>
          )}

          {(phase === 'expired' || phase === 'failed' || phase === 'error') && (
            <div className="py-10 flex flex-col items-center gap-3">
              <AlertTriangle size={48} className="text-amber-500" />
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                {phase === 'expired' ? t('uzqr.expired') : phase === 'failed' ? t('uzqr.failed') : t('uzqr.createFailedShort')}
              </p>
              {error && <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>}
              <button onClick={createQr} className="mt-2 px-6 py-2.5 rounded-xl bg-primary-600 text-white font-semibold flex items-center gap-2">
                <RefreshCw size={16} /> {t('uzqr.newQr')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
