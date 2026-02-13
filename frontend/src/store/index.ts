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

  setCategories: (categories: Category[]) => void;
  setCatalogLoaded: (loaded: boolean) => void;
  setSelectedCategory: (id: string | null) => void;
  setUserLocation: (location: { latitude: number; longitude: number } | null) => void;
  setIsTelegramMiniApp: (value: boolean) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  categories: [],
  catalogLoaded: false,
  selectedCategory: null,
  userLocation: null,
  isTelegramMiniApp: false,

  setCategories: (categories) => set({ categories, catalogLoaded: true }),
  setCatalogLoaded: (catalogLoaded) => set({ catalogLoaded }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setUserLocation: (userLocation) => set({ userLocation }),
  setIsTelegramMiniApp: (isTelegramMiniApp) => set({ isTelegramMiniApp }),
}));
