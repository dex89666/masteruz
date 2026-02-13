// ============================================
// MasterUz — Confirm Dialog Component
// ============================================

import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  variant = 'warning',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const colors = {
    danger: { bg: 'bg-red-100', icon: 'text-red-500', btn: 'bg-red-600 hover:bg-red-700' },
    warning: { bg: 'bg-yellow-100', icon: 'text-yellow-500', btn: 'bg-yellow-600 hover:bg-yellow-700' },
    info: { bg: 'bg-primary-100', icon: 'text-primary-500', btn: 'bg-primary-600 hover:bg-primary-700' },
  };

  const c = colors[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={`w-14 h-14 ${c.bg} rounded-full flex items-center justify-center mb-4`}>
            <AlertTriangle size={28} className={c.icon} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-6">{message}</p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-medium transition-colors ${c.btn}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
