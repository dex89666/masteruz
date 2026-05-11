// ============================================
// MasterUz — Zustand Store (Глобальное состояние)
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Category } from '../types';

// ─── Auth Store ────────────────────────────
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      setUser: (user) => set({ user }),

      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('masteruz-auth');
        // При выходе из аккаунта сбрасываем и согласие — при следующем входе
        // пользователь должен заново ознакомиться с офертой и политикой.
        localStorage.removeItem('masteruz-consent-v5');
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'masteruz-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ─── App Store (общее состояние) ───────────
interface AppState {
  categories: Category[];
  catalogLoaded: boolean;
  selectedCategory: string | null;
  userLocation: { latitude: number; longitude: number } | null;
  isTelegramMiniApp: boolean;
  largeText: boolean;

  setCategories: (categories: Category[]) => void;
  setCatalogLoaded: (loaded: boolean) => void;
  setSelectedCategory: (id: string | null) => void;
  setUserLocation: (location: { latitude: number; longitude: number } | null) => void;
  setIsTelegramMiniApp: (value: boolean) => void;
  setLargeText: (value: boolean) => void;
  toggleLargeText: () => void;
}

export const useAppStore = create<AppState>()((set) => ({
  categories: [],
  catalogLoaded: false,
  selectedCategory: null,
  userLocation: null,
  isTelegramMiniApp: false,
  largeText: typeof localStorage !== 'undefined' && localStorage.getItem('masteruz_large_text') === 'true',

  setCategories: (categories) => set({ categories, catalogLoaded: true }),
  setCatalogLoaded: (catalogLoaded) => set({ catalogLoaded }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setUserLocation: (userLocation) => set({ userLocation }),
  setIsTelegramMiniApp: (isTelegramMiniApp) => set({ isTelegramMiniApp }),
  setLargeText: (largeText) => {
    try { localStorage.setItem('masteruz_large_text', String(largeText)); } catch {}
    if (largeText) {
      document.documentElement.classList.add('large-text');
    } else {
      document.documentElement.classList.remove('large-text');
    }
    set({ largeText });
  },
  toggleLargeText: () => {
    const current = useAppStore.getState().largeText;
    const next = !current;
    try { localStorage.setItem('masteruz_large_text', String(next)); } catch {}
    if (next) {
      document.documentElement.classList.add('large-text');
    } else {
      document.documentElement.classList.remove('large-text');
    }
    set({ largeText: next });
  },
}));
