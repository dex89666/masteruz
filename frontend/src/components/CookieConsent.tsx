// ============================================
// MasterUz — Cookie Consent Banner
// ============================================

import { useState, useEffect } from 'react';
import { Cookie } from 'lucide-react';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('cookies-accepted');
    if (!accepted) {
      // Show after a small delay
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem('cookies-accepted', '1');
    setVisible(false);
  }

  function handleDecline() {
    localStorage.setItem('cookies-accepted', '0');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-0 left-0 right-0 z-50 bg-gray-900 text-white px-4 py-3 shadow-2xl">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-3">
        <Cookie size={20} className="text-yellow-400 flex-shrink-0 hidden sm:block" />
        <p className="text-sm text-gray-300 flex-1 text-center sm:text-left">
          Мы используем файлы cookie для улучшения работы сайта. Продолжая использование, вы соглашаетесь с{' '}
          <a href="#" className="text-primary-400 hover:underline">политикой конфиденциальности</a>.
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleAccept}
            className="px-4 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Принять
          </button>
          <button
            onClick={handleDecline}
            className="px-4 py-1.5 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600 transition-colors"
          >
            Отклонить
          </button>
        </div>
      </div>
    </div>
  );
}
