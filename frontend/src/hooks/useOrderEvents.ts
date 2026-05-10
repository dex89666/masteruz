import { useEffect, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export type OrderEvent =
  | 'status_changed'
  | 'master_confirmed'
  | 'client_confirmed'
  | 'order_completed'
  | 'master_assigned'
  | 'master_location';

interface UseOrderEventsOptions {
  orderId: string | undefined;
  enabled?: boolean;
  onEvent?: (event: OrderEvent, data: Record<string, unknown>) => void;
}

/**
 * Получить одноразовый SSE-ticket (JWT никогда не попадает в URL)
 */
async function fetchSseTicket(orderId: string): Promise<string | null> {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/orders/${orderId}/events-ticket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.ticket ?? null;
  } catch {
    return null;
  }
}

/**
 * SSE-хук для получения real-time обновлений заказа.
 * Использует одноразовый ticket вместо JWT в URL.
 * Автоматически подключается, реконнектится при обрыве, закрывается при размонтировании.
 */
export function useOrderEvents({ orderId, enabled = true, onEvent }: UseOrderEventsOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(async () => {
    if (!orderId || !enabled) return;

    // Закрываем предыдущее соединение
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Получаем одноразовый ticket (30 сек TTL)
    const ticket = await fetchSseTicket(orderId);
    if (!ticket) return;

    const url = `${API_URL}/orders/${orderId}/events?ticket=${encodeURIComponent(ticket)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    const eventTypes: OrderEvent[] = [
      'status_changed',
      'master_confirmed',
      'client_confirmed',
      'order_completed',
      'master_assigned',
      'master_location',
    ];

    for (const eventType of eventTypes) {
      es.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          onEventRef.current?.(eventType, data);
        } catch {
          // ignore parse errors
        }
      });
    }

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      // Реконнект через 3 секунды (запросит новый ticket)
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };
  }, [orderId, enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);
}
