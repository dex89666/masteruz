// ============================================
// MasterUz — Глобальный confirm (императивный)
// ============================================
// Замена нативного window.confirm(), который в Telegram Desktop WebView
// не блокирует поток и сразу возвращает undefined. Здесь — надёжный
// async-confirm на базе React-модала, вызываемый из любого места:
//   if (await confirm({ title, message })) { ... }

import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmState {
  options: ConfirmOptions | null;
  resolve: ((result: boolean) => void) | null;
  open: (options: ConfirmOptions) => Promise<boolean>;
  settle: (result: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  options: null,
  resolve: null,
  open: (options) =>
    new Promise<boolean>((resolve) => set({ options, resolve })),
  settle: (result) => {
    get().resolve?.(result);
    set({ options: null, resolve: null });
  },
}));

/** Показать диалог подтверждения. Возвращает true, если пользователь подтвердил. */
export const confirm = (options: ConfirmOptions): Promise<boolean> =>
  useConfirmStore.getState().open(options);

// ─── Prompt (ввод текста) ────────────────────────────────────
export interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

interface PromptState {
  options: PromptOptions | null;
  resolve: ((result: string | null) => void) | null;
  open: (options: PromptOptions) => Promise<string | null>;
  settle: (result: string | null) => void;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  options: null,
  resolve: null,
  open: (options) =>
    new Promise<string | null>((resolve) => set({ options, resolve })),
  settle: (result) => {
    get().resolve?.(result);
    set({ options: null, resolve: null });
  },
}));

/** Запросить ввод текста. Возвращает строку или null, если отменено. */
export const prompt = (options: PromptOptions): Promise<string | null> =>
  usePromptStore.getState().open(options);

