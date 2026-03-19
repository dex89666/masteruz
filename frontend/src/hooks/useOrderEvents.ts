import { useEffect, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export type OrderEvent =
  | 'status_changed'
  | 'master_confirmed'
  | 'client_confirmed'
  | 'order_completed'
  | 'master_assigned';

interface UseOrderEventsOptions {
  orderId: string | undefined;
  enabled?: boolean;
  onEvent?: (event: OrderEvent, data: Record<string, unknown>) => void;
}

/**
 * SSE-хук для получения real-time обновлений заказа.
 * Автоматически подключается, реконнектится при обрыве, закрывается при размонтировании.
 */
export function useOrderEvents({ orderId, enabled = true, onEvent }: UseOrderEventsOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!orderId || !enabled) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Закрываем предыдущее соединение
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${API_URL}/orders/${orderId}/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    const eventTypes: OrderEvent[] = [
      'status_changed',
      'master_confirmed',
      'client_confirmed',
      'order_completed',
      'master_assigned',
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
      // Реконнект через 3 секунды
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
