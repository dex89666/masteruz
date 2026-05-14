// ============================================
// MasterUz — OrderChat (встроенный чат заказа)
// ============================================

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, X, MessageCircle } from 'lucide-react';
import { chatApi } from '../api/client';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';
import type { ChatMessage } from '../types';

interface OrderChatProps {
  orderId: string;
  isParticipant: boolean;
}

export function OrderChat({ orderId, isParticipant }: OrderChatProps) {
  const { user } = useAuthStore();
  const { t, locale } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // Авто-открытие чата при переходе из уведомления (?openChat=1)
  useEffect(() => {
    if (!isParticipant) return;
    if (searchParams.get('openChat') === '1') {
      setOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('openChat');
      setSearchParams(next, { replace: true });
    }
  }, [isParticipant, searchParams, setSearchParams]);

  // Сигнализируем глобально об открытии/закрытии чата —
  // чтобы скрыть кнопку scroll-to-top, перекрывающую поле ввода
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('masteruz:chat-toggle', { detail: { open } }));
    return () => {
      window.dispatchEvent(new CustomEvent('masteruz:chat-toggle', { detail: { open: false } }));
    };
  }, [open]);

  useEffect(() => {
    if (open && isParticipant) {
      loadMessages();
      // Поллинг каждые 5 секунд
      pollRef.current = setInterval(loadMessages, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, orderId]);

  // Подписка на глобальное событие открытия чата
  // (например, из блока «Свяжитесь через чат» в карточке заказа)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ orderId?: string }>).detail;
      if (!detail?.orderId || detail.orderId === orderId) {
        setOpen(true);
      }
    };
    window.addEventListener('masteruz:open-chat', handler);
    return () => window.removeEventListener('masteruz:open-chat', handler);
  }, [orderId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function loadMessages() {
    try {
      const res = await chatApi.getMessages(orderId);
      setMessages(res.data.data || []);
    } catch {}
  }

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await chatApi.sendMessage(orderId, { text: text.trim() });
      setText('');
      const warning = (res.data as any)?.warning;
      if (warning) {
        const { default: toast } = await import('react-hot-toast');
        toast.error(warning, { duration: 8000, style: { maxWidth: 420 } });
      }
      await loadMessages();
    } catch {}
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!isParticipant) return null;

  return (
    <>
      {/* Кнопка-тригер */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-4 z-40 w-14 h-14 bg-primary-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-primary-700 transition-all hover:scale-105"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Окно чата */}
      {open && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-40 w-[340px] sm:w-[380px] h-[480px] bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary-600 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} />
              <span className="font-semibold text-sm">{t('chat.title')}</span>
            </div>
            <button onClick={() => setOpen(false)} className="hover:bg-white/20 rounded-full p-1 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                {t('chat.noMessages')}
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.senderId === user?.id;
                const senderName = msg.sender?.firstName || t('chat.user');

                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    {/* Модерационный флаг */}
                    {msg.isFlagged && !msg.isBlocked && (
                      <div className="text-xs text-orange-500 mb-0.5 px-2">{msg.flagReason || 'Сообщение на проверке'}</div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                        msg.isBlocked
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-400 line-through rounded-lg'
                          : msg.isSystem
                          ? 'bg-gray-200 text-gray-600 text-center text-xs mx-auto rounded-full px-4'
                          : isMine
                          ? 'bg-primary-600 text-white rounded-br-md'
                          : 'bg-white text-gray-800 rounded-bl-md ring-1 ring-gray-100'
                      }`}
                    >
                      {!isMine && !msg.isSystem && (
                        <p className="text-[10px] font-medium text-primary-600 mb-0.5">{senderName}</p>
                      )}
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="" className="rounded-lg max-h-40 mb-1" />
                      )}
                      {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                      <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-200' : 'text-gray-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.placeholder')}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200 max-h-20"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                className="p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
