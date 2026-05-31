// ============================================
// MasterUz — useConfirm (async confirm dialog)
// ============================================
// Нативный window.confirm() в Telegram Desktop WebView НЕ блокирует поток:
// он сразу возвращает undefined, поэтому `if (!confirm()) return` выходит
// до нажатия кнопки. Этот хук даёт надёжный async-confirm на базе React-модала.

import { useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((result: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirmDialog = (
    <ConfirmDialog
      isOpen={options !== null}
      title={options?.title ?? ''}
      message={options?.message ?? ''}
      confirmText={options?.confirmText}
      cancelText={options?.cancelText}
      variant={options?.variant}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, confirmDialog };
}
