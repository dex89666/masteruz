// ============================================
// MasterUz — Cart Store (Корзина услуг)
// Zustand + persist для сохранения между сессиями
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task } from '../types';

export interface CartItem {
  task: Task;
  quantity: number;
  categoryName: string;
  categoryNameUz: string | null;
  categoryNameEn: string | null;
  categoryIcon: string | null;
  subcategoryName: string;
  subcategoryNameUz: string | null;
  subcategoryNameEn: string | null;
}

interface CartState {
  items: CartItem[];
  
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (taskId: string) => void;
  updateQuantity: (taskId: string, quantity: number) => void;
  incrementQuantity: (taskId: string) => void;
  decrementQuantity: (taskId: string) => void;
  clearCart: () => void;
  
  // Computed
  getTotalItems: () => number;
  getSubtotal: () => number;
  getCommission: (rate: number) => number;
  getTotal: (commissionRate: number) => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, quantity = 1) => {
        const items = get().items;
        const existing = items.find((i) => i.task.id === item.task.id);
        
        if (existing) {
          set({
            items: items.map((i) =>
              i.task.id === item.task.id
                ? { ...i, quantity: i.quantity + quantity }
                : i
            ),
          });
        } else {
          set({ items: [...items, { ...item, quantity }] });
        }
      },

      removeItem: (taskId) => {
        set({ items: get().items.filter((i) => i.task.id !== taskId) });
      },

      updateQuantity: (taskId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(taskId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.task.id === taskId ? { ...i, quantity } : i
          ),
        });
      },

      incrementQuantity: (taskId) => {
        set({
          items: get().items.map((i) =>
            i.task.id === taskId ? { ...i, quantity: i.quantity + 1 } : i
          ),
        });
      },

      decrementQuantity: (taskId) => {
        const items = get().items;
        const item = items.find((i) => i.task.id === taskId);
        if (!item) return;
        
        if (item.quantity <= 1) {
          get().removeItem(taskId);
        } else {
          set({
            items: items.map((i) =>
              i.task.id === taskId ? { ...i, quantity: i.quantity - 1 } : i
            ),
          });
        }
      },

      clearCart: () => set({ items: [] }),

      getTotalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce(
          (sum, item) => sum + (item.task.minPrice || 0) * item.quantity,
          0
        );
      },

      getCommission: (rate: number) => {
        return Math.round(get().getSubtotal() * (rate / 100));
      },

      getTotal: (commissionRate: number) => {
        const subtotal = get().getSubtotal();
        const commission = Math.round(subtotal * (commissionRate / 100));
        return subtotal + commission;
      },
    }),
    {
      name: 'masteruz-cart',
    }
  )
);
