// ============================================
// MasterUz — Scroll to Top Button
// ============================================

import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 400);
    }
    function handleChatToggle(e: Event) {
      setChatOpen(Boolean((e as CustomEvent<{ open: boolean }>).detail?.open));
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('masteruz:chat-toggle', handleChatToggle);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('masteruz:chat-toggle', handleChatToggle);
    };
  }, []);

  function scrollUp() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!visible || chatOpen) return null;

  return (
    <button
      onClick={scrollUp}
      className="fixed bottom-20 md:bottom-8 right-4 z-40 w-10 h-10 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary-700 transition-all hover:scale-110"
      aria-label="Scroll to top"
    >
      <ArrowUp size={20} />
    </button>
  );
}
