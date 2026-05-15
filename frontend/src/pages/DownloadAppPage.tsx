// MasterUz — Страница скачивания мобильного приложения
import { Smartphone, Download, Shield, Star, ChevronRight, CheckCircle2 } from 'lucide-react';

const GITHUB_REPO = 'dex89666/masteruz';
const APK_RELEASE_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/MasterUz-android.apk`;
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

const FEATURES = [
  'Заказ мастера за 2 минуты',
  'Фото-заказ с определением проблемы ИИ',
  'Онлайн-чат с мастером',
  'История всех заказов',
  'Уведомления о статусе',
  'Безопасная оплата через Click / Payme',
];

const INSTALL_STEPS = [
  { step: 1, text: 'Нажмите кнопку «Скачать APK»' },
  { step: 2, text: 'Откройте скачанный файл' },
  { step: 3, text: 'Разрешите установку из неизвестных источников' },
  { step: 4, text: 'Нажмите «Установить»' },
];

export function DownloadAppPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-16 pb-12">
        <div className="w-24 h-24 rounded-3xl bg-blue-600 flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/30">
          <Smartphone className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-4xl font-bold mb-3">MasterUz</h1>
        <p className="text-slate-400 text-lg max-w-sm">
          Мастер на все руки — в вашем кармане
        </p>

        <div className="flex items-center gap-2 mt-4 mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
          ))}
          <span className="text-slate-400 text-sm ml-1">5.0 · Android</span>
        </div>

        {/* CTA кнопка */}
        <a
          href={APK_RELEASE_URL}
          className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 
                     text-white font-semibold text-lg px-8 py-4 rounded-2xl transition-all
                     shadow-xl shadow-blue-500/40 w-full max-w-xs justify-center"
        >
          <Download className="w-6 h-6" />
          Скачать для Android
        </a>

        <a
          href={RELEASES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-slate-500 text-sm hover:text-slate-300 transition-colors flex items-center gap-1"
        >
          Все версии на GitHub <ChevronRight className="w-3 h-3" />
        </a>
      </section>

      {/* Возможности */}
      <section className="px-6 py-10 bg-white/5 rounded-3xl mx-4 mb-6">
        <h2 className="text-xl font-bold mb-5">Что умеет приложение</h2>
        <ul className="space-y-3">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
              <span className="text-slate-300">{feature}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Инструкция установки */}
      <section className="px-6 py-8 mx-4 mb-6">
        <h2 className="text-xl font-bold mb-5">Как установить</h2>
        <div className="space-y-4">
          {INSTALL_STEPS.map(({ step, text }) => (
            <div key={step} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-600/40 
                              flex items-center justify-center shrink-0 text-blue-400 font-bold text-sm">
                {step}
              </div>
              <p className="text-slate-300 pt-1">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Безопасность */}
      <section className="px-6 py-8 mx-4 mb-10 bg-white/5 rounded-3xl flex items-start gap-4">
        <Shield className="w-8 h-8 text-green-400 shrink-0 mt-1" />
        <div>
          <h3 className="font-semibold mb-1">Безопасно</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Приложение собирается автоматически из открытого исходного кода на GitHub Actions.
            Никаких сторонних серверов — только официальный backend MasterUz.
          </p>
        </div>
      </section>

      {/* iOS */}
      <section className="px-6 pb-12 text-center">
        <p className="text-slate-500 text-sm">
          iOS (iPhone) — скоро.{' '}
          <a
            href="https://masteruz-ecru.vercel.app"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Пока используйте веб-версию →
          </a>
        </p>
      </section>
    </div>
  );
}
