// ============================================
// MasterUz — Онлайн-оплата: переход на UzQR (Hamkorbank)
// Click, Payme и Telegram Stars отключены; оплата по динамическому QR — в подключении.
// ============================================

import { QrCode } from 'lucide-react';

export function OnlinePaymentSoon({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-4 ${className}`}
    >
      <QrCode size={22} className="shrink-0 text-primary-600 dark:text-primary-400 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          Онлайн-оплата скоро станет доступна
        </p>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Мы переходим на оплату по QR-коду через единую платёжную систему UzQR (Hamkorbank).
          Пока онлайн-оплата недоступна — если нужна помощь, напишите в поддержку.
        </p>
      </div>
    </div>
  );
}
