// ============================================
// MasterUz — Support Chat Page
// Чат поддержки (пользователь ↔ админ)
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store';
import { supportChatApi } from '../api/client';
import { MessageCircle, Send, ChevronLeft, Headphones, CheckCheck, Clock } from 'lucide-react';

interface SupportChat {
  id: string;
  userId: string;
  adminId: string;
  subject: string;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
  admin?: { profile?: { firstName?: string; lastName?: string } };
  messages?: { text: string; createdAt: string; senderId: string }[];
  _count?: { messages: number };
}

interface SupportMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  isRead: boolean;
  createdAt: string;
  sender?: { profile?: { firstName?: string; lastName?: string } };
}

export function SupportChatPage() {
  const { user } = useAuthStore();
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadChats = useCallback(async () => {
    try {
      const res = await supportChatApi.getMyChats();
      if (res.data?.data) setChats(res.data.data);
    } catch (e) {
      console.error('Failed to load chats', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const res = await supportChatApi.getMessages(chatId);
      if (res.data?.data) setMessages(res.data.data);
    } catch (e) {
      console.error('Failed to load messages', e);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Polling for new messages when chat is open
  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);
      pollRef.current = setInterval(() => loadMessages(selectedChat.id), 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedChat, loadMessages]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedChat || sending) return;
    setSending(true);
    try {
      await supportChatApi.sendMessage(selectedChat.id, newMessage.trim());
      setNewMessage('');
      await loadMessages(selectedChat.id);
      inputRef.current?.focus();
    } catch (e) {
      console.error('Failed to send', e);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const getDisplayName = (msg: SupportMessage) => {
    if (msg.senderId === user?.id) return 'Вы';
    return msg.sender?.profile?.firstName || 'Поддержка';
  };

  // ─── Empty state ─────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ─── Chat messages view ──────────────────
  if (selectedChat) {
    return (
      <div className="flex flex-col h-[calc(100vh-120px)] max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b bg-white sticky top-0 z-10">
          <button
            onClick={() => { setSelectedChat(null); setMessages([]); loadChats(); }}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 line-clamp-1">{selectedChat.subject}</h2>
            <p className="text-xs text-gray-500">
              {selectedChat.isClosed ? 'Чат закрыт' : 'Активный чат'}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 py-12">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Сообщений пока нет</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isMe
                    ? 'bg-orange-500 text-white rounded-br-md'
                    : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
                }`}>
                  {!isMe && (
                    <p className="text-xs font-medium text-orange-600 mb-1">{getDisplayName(msg)}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : ''}`}>
                    <span className={`text-[10px] ${isMe ? 'text-orange-100' : 'text-gray-400'}`}>
                      {formatTime(msg.createdAt)}
                    </span>
                    {isMe && (
                      msg.isRead
                        ? <CheckCheck className="w-3 h-3 text-orange-200" />
                        : <Clock className="w-3 h-3 text-orange-200" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {!selectedChat.isClosed ? (
          <div className="p-3 border-t bg-white">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Введите сообщение..."
                className="flex-1 px-4 py-3 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                disabled={sending}
                autoFocus
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="p-3 bg-orange-500 text-white rounded-full hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t bg-gray-100 text-center text-sm text-gray-500">
            Этот чат закрыт. Если нужна помощь, дождитесь нового сообщения от поддержки.
          </div>
        )}
      </div>
    );
  }

  // ─── Chats list ──────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-orange-100 rounded-2xl">
          <Headphones className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Чат поддержки</h1>
          <p className="text-sm text-gray-500">Общение с командой MasterUz</p>
        </div>
      </div>

      {chats.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Нет активных чатов</h3>
          <p className="text-gray-400 text-sm max-w-xs mx-auto">
            Когда администратор или менеджер создаст обращение, оно появится здесь. Вы не можете начать чат первым — поддержка свяжется с вами при необходимости.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => {
            const lastMsg = chat.messages?.[0];
            const unread = (chat._count as any)?.messages || 0;

            return (
              <button
                key={chat.id}
                onClick={() => setSelectedChat(chat)}
                className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-orange-200 hover:shadow-md transition text-left"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  chat.isClosed ? 'bg-gray-100' : 'bg-orange-100'
                }`}>
                  <Headphones className={`w-6 h-6 ${chat.isClosed ? 'text-gray-400' : 'text-orange-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-900 truncate">{chat.subject}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                      {formatDate(chat.updatedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {lastMsg
                      ? lastMsg.text.slice(0, 80) + (lastMsg.text.length > 80 ? '…' : '')
                      : chat.isClosed ? 'Чат закрыт' : 'Нет сообщений'}
                  </p>
                </div>
                {unread > 0 && (
                  <span className="bg-orange-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
