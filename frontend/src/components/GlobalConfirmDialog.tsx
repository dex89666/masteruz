// ============================================
// MasterUz — Глобальный диалог подтверждения
// Рендерится один раз в App, управляется из confirmStore.
// ============================================

import { useConfirmStore } from '../store/confirmStore';
import { ConfirmDialog } from './ConfirmDialog';

export function GlobalConfirmDialog() {
  const options = useConfirmStore((s) => s.options);
  const settle = useConfirmStore((s) => s.settle);

  return (
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
}
