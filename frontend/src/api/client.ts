// ============================================
// MasterUz — API Client (Axios)
// Агент 2 (Фронтенд-разработчик)
// ============================================

import axios from 'axios';
import type { ApiResponse, PaginatedResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  withCredentials: true, // отправлять httpOnly cookies (mu_at, mu_rt)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерсептор для добавления JWT токена
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Интерсептор для обработки ошибок и обновления токена
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Retry при сетевых ошибках и 429 (exponential backoff, max 2 повтора)
    const retryCount = originalRequest._retryCount || 0;
    const isRetryable =
      !error.response || error.response.status === 429 || error.response.status >= 500;
    const isIdempotent = ['get', 'head', 'options'].includes(
      (originalRequest.method || '').toLowerCase()
    );

    if (isRetryable && isIdempotent && retryCount < 2) {
      originalRequest._retryCount = retryCount + 1;
      const delay = Math.min(1000 * 2 ** retryCount, 4000);
      await new Promise((r) => setTimeout(r, delay));
      return api(originalRequest);
    }

    // Если 401 и это не повтор — пробуем обновить токен
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        // Очищаем токены и persist-хранилище
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('masteruz-auth');
        // Не делаем redirect — пусть ProtectedRoute обработает
        return Promise.reject(error);
      }
    }

    // Сетевая ошибка без ответа от сервера (timeout, ECONNREFUSED, offline)
    if (!error.response) {
      error.message = 'Ошибка соединения. Проверьте интернет и попробуйте снова';
    }

    return Promise.reject(error);
  }
);

// ─── Auth API ──────────────────────────────
export const authApi = {
  loginTelegram: (data: any) =>
    api.post<ApiResponse<any>>('/auth/telegram', data),

  loginMiniApp: (initData: string) =>
    api.post<ApiResponse<any>>('/auth/mini-app', { initData }),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse<any>>('/auth/refresh', { refreshToken }),

  me: () =>
    api.get<ApiResponse<any>>('/auth/me'),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),

  switchRole: (role: string) =>
    api.post<ApiResponse<any>>('/auth/switch-role', { role }),
};

// ─── Users API ─────────────────────────────
export const usersApi = {
  getProfile: () =>
    api.get<ApiResponse<any>>('/users/profile'),

  updateProfile: (data: any) =>
    api.put<ApiResponse<any>>('/users/profile', data),

  createMasterProfile: (data: any) =>
    api.post<ApiResponse<any>>('/users/master-profile', data),

  updateMasterProfile: (data: any) =>
    api.put<ApiResponse<any>>('/users/master-profile', data),

  uploadCertificate: (formData: FormData) =>
    api.post<ApiResponse<any>>('/users/certificates', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getMaster: (id: string) =>
    api.get<ApiResponse<any>>(`/users/master/${id}`),

  searchMasters: (params?: any) =>
    api.get<PaginatedResponse<any>>('/users/masters/search', { params }),

  getMasterCategories: () =>
    api.get<ApiResponse<any[]>>('/users/master-categories'),

  updateMasterCategories: (categoryIds: string[]) =>
    api.put<ApiResponse<any>>('/users/master-categories', { categoryIds }),
};

// ─── Online Status API ──────────────────────
export const onlineStatusApi = {
  heartbeat: (latitude?: number, longitude?: number) =>
    api.post<ApiResponse<any>>('/users/heartbeat', { latitude, longitude }),

  goOffline: () =>
    api.post<ApiResponse<any>>('/users/go-offline'),

  getOnlineMasters: () =>
    api.get<ApiResponse<any[]>>('/users/online-masters'),
};

// ─── Orders API ────────────────────────────
export const ordersApi = {
  list: (params?: any) =>
    api.get<PaginatedResponse<any>>('/orders', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<any>>(`/orders/${id}`),

  create: (data: any) =>
    api.post<ApiResponse<any>>('/orders', data),

  respond: (id: string, data: any) =>
    api.post<ApiResponse<any>>(`/orders/${id}/respond`, data),

  assign: (id: string, masterId: string) =>
    api.put<ApiResponse<any>>(`/orders/${id}/assign`, { masterId }),

  // Мастер обновляет статус: ACCEPTED → IN_TRANSIT → IN_PROGRESS
  updateStatus: (id: string, status: string, coords?: { latitude: number; longitude: number }) =>
    api.put<ApiResponse<any>>(`/orders/${id}/status`, { status, ...(coords ?? {}) }),

  // Live-позиция мастера в режиме доставки
  masterLocation: (id: string, data: { latitude: number; longitude: number; heading?: number; speed?: number }) =>
    api.post<ApiResponse<any>>(`/orders/${id}/master-location`, data),

  // Двойное подтверждение завершения
  masterConfirm: (id: string) =>
    api.put<ApiResponse<any>>(`/orders/${id}/master-confirm`),

  clientConfirm: (id: string) =>
    api.put<ApiResponse<any>>(`/orders/${id}/client-confirm`),

  complete: (id: string) =>
    api.put<ApiResponse<any>>(`/orders/${id}/complete`),

  cancel: (id: string, reason?: string) =>
    api.put<ApiResponse<any>>(`/orders/${id}/cancel`, { reason }),

  // Спор
  dispute: (id: string, reason: string) =>
    api.put<ApiResponse<any>>(`/orders/${id}/dispute`, { reason }),

  resolveDispute: (id: string, resolution: string, note?: string) =>
    api.put<ApiResponse<any>>(`/orders/${id}/resolve-dispute`, { resolution, note }),

  myClientOrders: (status?: string) =>
    api.get<ApiResponse<any[]>>('/orders/my/client', { params: { status } }),

  myMasterOrders: (status?: string) =>
    api.get<ApiResponse<any[]>>('/orders/my/master', { params: { status } }),
};

// ─── Balance API ───────────────────────────
export const balanceApi = {
  getBalance: () =>
    api.get<ApiResponse<{ balance: number }>>('/balance'),

  topUp: (amount: number, provider?: string) =>
    api.post<ApiResponse<any>>('/payments/balance-topup', { amount, provider }),

  getTransactions: (page?: number, limit?: number) =>
    api.get<PaginatedResponse<any>>('/balance/transactions', { params: { page, limit } }),
};

// ─── Catalog API (Категории/Подкатегории/Задачи) ──
export const catalogApi = {
  getCategories: () =>
    api.get<ApiResponse<any[]>>('/catalog/categories'),

  getCategoryWithSubs: (slug: string) =>
    api.get<ApiResponse<any>>(`/catalog/categories/${slug}`),

  getSubcategory: (slug: string) =>
    api.get<ApiResponse<any>>(`/catalog/subcategories/${slug}`),

  getTasks: (subcategoryId: string) =>
    api.get<ApiResponse<any[]>>('/catalog/tasks', { params: { subcategoryId } }),

  getFullCatalog: () =>
    api.get<ApiResponse<any[]>>('/catalog/full'),

  getPriceList: () =>
    api.get<ApiResponse<any[]>>('/catalog/price-list'),
};

// ─── Payments API ──────────────────────────
export const paymentsApi = {
  create: (orderId: string, provider: string) =>
    api.post<ApiResponse<any>>('/payments/create', { orderId, provider }),

  createRegistrationFee: (provider: string) =>
    api.post<ApiResponse<any>>('/payments/registration-fee', { provider }),

  history: (page?: number, limit?: number) =>
    api.get<PaginatedResponse<any>>('/payments/history', { params: { page, limit } }),
};

// ─── Referrals API ─────────────────────────
export const referralsApi = {
  getLink: () =>
    api.get<ApiResponse<any>>('/referrals/link'),

  getStats: () =>
    api.get<ApiResponse<any>>('/referrals/stats'),

  apply: (referralCode: string) =>
    api.post<ApiResponse<any>>('/referrals/apply', { referralCode }),
};

// ─── Reviews API ───────────────────────────
export const reviewsApi = {
  create: (data: { orderId: string; rating: number; comment?: string }) =>
    api.post<ApiResponse<any>>('/reviews', data),

  getMasterReviews: (masterId: string, page?: number) =>
    api.get<any>(`/reviews/master/${masterId}`, { params: { page } }),
};

// ─── Geo API ───────────────────────────────
export const geoApi = {
  ordersNearby: (latitude: number, longitude: number, radius?: number, categoryId?: string) =>
    api.get<ApiResponse<any[]>>('/geo/orders-nearby', {
      params: { latitude, longitude, radius, categoryId },
    }),

  mastersNearby: (latitude: number, longitude: number, radius?: number, specialization?: string) =>
    api.get<ApiResponse<any[]>>('/geo/masters-nearby', {
      params: { latitude, longitude, radius, specialization },
    }),
};

// ─── School API ────────────────────────────
export const schoolApi = {
  getCourses: (categoryId?: string) =>
    api.get<ApiResponse<any[]>>('/school/courses', { params: { categoryId } }),

  getCourse: (id: string) =>
    api.get<ApiResponse<any>>(`/school/courses/${id}`),

  completeCourse: (id: string) =>
    api.post<ApiResponse<any>>(`/school/courses/${id}/complete`),

  getProgress: () =>
    api.get<ApiResponse<any>>('/school/progress'),

  updateVideoProgress: (id: string, watchedSeconds: number) =>
    api.post<ApiResponse<any>>(`/school/courses/${id}/video-progress`, { watchedSeconds }),

  submitQuiz: (id: string, answers: number[]) =>
    api.post<ApiResponse<any>>(`/school/courses/${id}/quiz`, { answers }),

  // Admin
  adminGetCourses: () =>
    api.get<ApiResponse<any[]>>('/school/admin/courses'),

  adminCreateCourse: (data: any) =>
    api.post<ApiResponse<any>>('/school/admin/courses', data),

  adminUpdateCourse: (id: string, data: any) =>
    api.put<ApiResponse<any>>(`/school/admin/courses/${id}`, data),

  adminDeleteCourse: (id: string) =>
    api.delete<ApiResponse<any>>(`/school/admin/courses/${id}`),

  adminGetQuestions: (courseId: string) =>
    api.get<ApiResponse<any[]>>(`/school/admin/courses/${courseId}/questions`),

  adminCreateQuestion: (courseId: string, data: any) =>
    api.post<ApiResponse<any>>(`/school/admin/courses/${courseId}/questions`, data),

  adminUpdateQuestion: (questionId: string, data: any) =>
    api.put<ApiResponse<any>>(`/school/admin/questions/${questionId}`, data),

  adminDeleteQuestion: (questionId: string) =>
    api.delete<ApiResponse<any>>(`/school/admin/questions/${questionId}`),
};

// ─── Chat API (чат заказа с модерацией) ────
export const chatApi = {
  getMessages: (orderId: string) =>
    api.get<ApiResponse<any[]>>(`/chat/${orderId}`),

  sendMessage: (orderId: string, data: { text?: string; imageUrl?: string }) =>
    api.post<ApiResponse<any>>(`/chat/${orderId}`, data),

  getUnreadCount: (orderId: string) =>
    api.get<ApiResponse<{ unread: number }>>(`/chat/${orderId}/unread`),

  // Admin: флагированные сообщения
  getFlaggedMessages: (page?: number) =>
    api.get<any>('/chat/admin/flagged', { params: { page } }),

  blockMessage: (messageId: string) =>
    api.put<ApiResponse<any>>(`/chat/admin/${messageId}/block`),

  unflagMessage: (messageId: string) =>
    api.put<ApiResponse<any>>(`/chat/admin/${messageId}/unflag`),

  // Admin: архив всех чатов
  getArchive: (params?: { page?: number; search?: string; status?: string }) =>
    api.get<any>('/chat/admin/archive', { params }),
};

// ─── Estimation API (Выезд на оценку + смета) ──
export const estimationApi = {
  // Клиент: создать заказ на оценку
  createEstimationOrder: (data: {
    categoryId: string;
    title: string;
    description: string;
    address: string;
    city?: string;
    district?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
    images: string[];
    scheduledDate?: string;
    scheduledTime?: string;
  }) => api.post<ApiResponse<any>>('/estimation', data),

  // Получить смету по заказу
  getEstimate: (orderId: string) =>
    api.get<ApiResponse<any[]>>(`/estimation/${orderId}/estimate`),

  // Клиент: одобрить смету
  approveEstimate: (estimateId: string) =>
    api.put<ApiResponse<any>>(`/estimation/${estimateId}/approve`),

  // Клиент: отклонить смету
  rejectEstimate: (estimateId: string, reason?: string) =>
    api.put<ApiResponse<any>>(`/estimation/${estimateId}/reject`, { reason }),

  // Мастер: принять заказ на оценку
  acceptEstimation: (orderId: string) =>
    api.put<ApiResponse<any>>(`/estimation/${orderId}/accept`),

  // Мастер: создать смету
  createEstimate: (orderId: string, data: {
    workItems: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
    materialItems: Array<{ name: string; quantity: number; unit: string; unitPrice: number; total: number }>;
    estimatedDays?: number;
    notes?: string;
    photos: string[];
    videos?: string[];
  }) => api.post<ApiResponse<any>>(`/estimation/${orderId}/estimate`, data),

  // Мастер: отправить смету клиенту
  sendEstimate: (estimateId: string) =>
    api.put<ApiResponse<any>>(`/estimation/estimate/${estimateId}/send`),

  // Admin: все заказы на оценку
  getEstimationOrders: (params?: { status?: string; page?: number }) =>
    api.get<any>('/estimation/admin/orders', { params }),

  // Admin: сметы на модерации
  getPendingModeration: () =>
    api.get<ApiResponse<any[]>>('/estimation/admin/moderation'),

  // Admin: модерировать смету
  moderateEstimate: (estimateId: string, approved: boolean, note?: string) =>
    api.put<ApiResponse<any>>(`/estimation/admin/moderate/${estimateId}`, { approved, note }),
};

// ─── Instant Order API (ФотоЗаказ за 30 сек) ──
export const instantOrderApi = {
  // AI-анализ фотографий → 3 варианта
  analyze: (data: {
    images: string[];
    description?: string;
    voiceText?: string;
    categoryId?: string;
    categoryIds?: string[];
    latitude?: number;
    longitude?: number;
  }) => api.post<ApiResponse<any>>('/instant-order/analyze', data),

  // Создать заказ из выбранного AI-варианта
  create: (data: {
    templateId: string;
    title: string;
    description: string;
    additionalWishes?: string;
    voiceDescription?: string;
    address: string;
    city?: string;
    district?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
    images: string[];
    deadline?: string;
    isUrgent?: boolean;
    offerAccepted: boolean;
  }) => api.post<ApiResponse<any>>('/instant-order/create', data),

  // Получить AI-шаблон
  getTemplate: (templateId: string) =>
    api.get<ApiResponse<any>>(`/instant-order/template/${templateId}`),

  // Admin: AI-заказы на модерации
  getPendingModeration: (params?: { page?: number; limit?: number }) =>
    api.get<any>('/instant-order/admin/moderation', { params }),

  // Admin: одобрить/отклонить AI-заказ
  moderate: (orderId: string, approved: boolean, note?: string) =>
    api.put<ApiResponse<any>>(`/instant-order/admin/moderate/${orderId}`, { approved, note }),
};

// ─── Forum API (форум мастеров) ──────
export const forumApi = {
  getTopics: (page?: number) =>
    api.get<PaginatedResponse<any>>('/forum/topics', { params: { page } }),

  getTopic: (id: string, page?: number) =>
    api.get<ApiResponse<any>>(`/forum/topics/${id}`, { params: { page } }),

  createTopic: (title: string, content: string, images?: File[]) => {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    if (images) {
      images.forEach(f => formData.append('images', f));
    }
    return api.post<ApiResponse<any>>('/forum/topics', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  createPost: (topicId: string, content: string, images?: File[]) => {
    const formData = new FormData();
    formData.append('content', content);
    if (images) {
      images.forEach(f => formData.append('images', f));
    }
    return api.post<ApiResponse<any>>(`/forum/topics/${topicId}/posts`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteTopic: (id: string) =>
    api.delete<ApiResponse<any>>(`/forum/topics/${id}`),

  moderateTopic: (id: string, data: { isPinned?: boolean; isLocked?: boolean }) =>
    api.put<ApiResponse<any>>(`/forum/topics/${id}/moderate`, data),
};

// ─── Support Chat API (чат поддержки) ──────
export const supportChatApi = {
  // Мои чаты поддержки
  getMyChats: () =>
    api.get<ApiResponse<any[]>>('/support-chat'),

  // Непрочитанные
  getUnreadCount: () =>
    api.get<ApiResponse<{ count: number }>>('/support-chat/unread'),

  // Сообщения чата
  getMessages: (chatId: string) =>
    api.get<ApiResponse<any[]>>(`/support-chat/${chatId}/messages`),

  // Отправить сообщение
  sendMessage: (chatId: string, text: string) =>
    api.post<ApiResponse<any>>(`/support-chat/${chatId}/messages`, { text }),

  // Админ: создать чат
  createChat: (userId: string, subject?: string) =>
    api.post<ApiResponse<any>>('/support-chat/admin', { userId, subject }),

  // Админ: все чаты
  getAdminChats: (params?: { page?: number; limit?: number }) =>
    api.get<any>('/support-chat/admin/all', { params }),

  // Админ: закрыть чат
  closeChat: (chatId: string) =>
    api.put<ApiResponse<any>>(`/support-chat/admin/${chatId}/close`),
};

// ─── Notifications API ─────────────────────
export const notificationsApi = {
  getAll: (page?: number) =>
    api.get<ApiResponse<any>>('/notifications', { params: { page } }),

  getUnreadCount: () =>
    api.get<ApiResponse<{ count: number }>>('/notifications/unread-count'),

  markRead: (id: string) =>
    api.put<ApiResponse<any>>(`/notifications/${id}/read`),

  markAllRead: () =>
    api.put<ApiResponse<any>>('/notifications/read-all'),

  remove: (id: string) =>
    api.delete<ApiResponse<any>>(`/notifications/${id}`),
};

// ─── Photos API (фото до/после) ────────────
export const photosApi = {
  getOrderPhotos: (orderId: string) =>
    api.get<ApiResponse<any[]>>(`/photos/${orderId}`),

  getByOrder: (orderId: string) =>
    api.get<ApiResponse<any[]>>(`/photos/${orderId}`),

  addPhoto: (orderId: string, data: { url: string; type: 'before' | 'after'; caption?: string }) =>
    api.post<ApiResponse<any>>(`/photos/${orderId}`, data),

  removePhoto: (photoId: string) =>
    api.delete<ApiResponse<any>>(`/photos/${photoId}`),

  // Загрузка фото (FormData с полем 'photo')
  upload: (formData: FormData) =>
    api.post<ApiResponse<{ url: string }>>('/photos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ─── Favorites API (избранные мастера) ──────
export const favoritesApi = {
  getAll: () =>
    api.get<ApiResponse<any[]>>('/favorites'),

  add: (masterId: string) =>
    api.post<ApiResponse<any>>(`/favorites/${masterId}`),

  remove: (masterId: string) =>
    api.delete<ApiResponse<any>>(`/favorites/${masterId}`),

  check: (masterId: string) =>
    api.get<ApiResponse<{ isFavorite: boolean }>>(`/favorites/check/${masterId}`),
};

// ─── Promo API (промокоды) ──────────────────
export const promoApi = {
  validate: (code: string, orderPrice?: number) =>
    api.post<ApiResponse<any>>('/promo/validate', { code, orderPrice }),

  apply: (promoCodeId: string, orderId?: string, discount?: number) =>
    api.post<ApiResponse<any>>('/promo/apply', { promoCodeId, orderId, discount }),

  // Admin
  getAll: () =>
    api.get<ApiResponse<any[]>>('/promo'),

  create: (data: { code: string; discountType: string; discountValue: number; maxUses?: number; minOrderPrice?: number; expiresAt?: string }) =>
    api.post<ApiResponse<any>>('/promo/create', data),

  update: (id: string, data: any) =>
    api.put<ApiResponse<any>>(`/promo/${id}`, data),

  remove: (id: string) =>
    api.delete<ApiResponse<any>>(`/promo/${id}`),
};

// ─── Guarantees API (гарантии) ──────────────
export const guaranteesApi = {
  getMy: () =>
    api.get<ApiResponse<any[]>>('/guarantees/my'),

  getByOrder: (orderId: string) =>
    api.get<ApiResponse<any>>(`/guarantees/${orderId}`),

  create: (orderId: string, durationDays?: number) =>
    api.post<ApiResponse<any>>('/guarantees', { orderId, durationDays }),

  claim: (orderId: string) =>
    api.post<ApiResponse<any>>(`/guarantees/${orderId}/claim`),

  resolve: (orderId: string) =>
    api.post<ApiResponse<any>>(`/guarantees/${orderId}/resolve`),
};

// ─── Portfolio API (портфолио мастера) ──────
export const portfolioApi = {
  getMasterPortfolio: (masterId: string, categoryId?: string) =>
    api.get<ApiResponse<any[]>>(`/portfolio/master/${masterId}`, { params: { categoryId } }),

  getItem: (id: string) =>
    api.get<ApiResponse<any>>(`/portfolio/${id}`),

  getStats: () =>
    api.get<ApiResponse<any>>('/portfolio/stats'),

  create: (data: { title: string; description?: string; imageUrl: string; categoryId?: string }) =>
    api.post<ApiResponse<any>>('/portfolio', data),

  update: (id: string, data: any) =>
    api.put<ApiResponse<any>>(`/portfolio/${id}`, data),

  remove: (id: string) =>
    api.delete<ApiResponse<any>>(`/portfolio/${id}`),
};

// ─── Admin API ─────────────────────────────
export const adminApi = {
  getDashboard: () =>
    api.get<ApiResponse<any>>('/admin/dashboard'),

  getUsers: (params?: any) =>
    api.get<PaginatedResponse<any>>('/admin/users', { params }),

  blockUser: (id: string, reason?: string) =>
    api.put<ApiResponse<any>>(`/admin/users/${id}/block`, { reason }),

  verifyUser: (id: string) =>
    api.put<ApiResponse<any>>(`/admin/users/${id}/verify`),

  changeUserRole: (id: string, role: string) =>
    api.put<ApiResponse<any>>(`/admin/users/${id}/role`, { role }),

  // ─── Управление балансом пользователей ────
  getUserBalance: (id: string) =>
    api.get<ApiResponse<{ balance: number }>>(`/admin/users/${id}/balance`),

  getUserTransactions: (id: string, page?: number, limit?: number) =>
    api.get<PaginatedResponse<any>>(`/admin/users/${id}/transactions`, { params: { page, limit } }),

  topUpUserBalance: (id: string, amount: number, reason?: string) =>
    api.post<ApiResponse<any>>(`/admin/users/${id}/balance/topup`, { amount, reason }),

  withdrawUserBalance: (id: string, amount: number, reason?: string) =>
    api.post<ApiResponse<any>>(`/admin/users/${id}/balance/withdraw`, { amount, reason }),

  getOrders: (params?: any) =>
    api.get<PaginatedResponse<any>>('/admin/orders', { params }),

  updateOrderComment: (orderId: string, comment: string) =>
    api.put<ApiResponse<any>>(`/admin/orders/${orderId}/comment`, { comment }),

  getPayments: (params?: any) =>
    api.get<PaginatedResponse<any>>('/admin/payments', { params }),

  getConfig: () =>
    api.get<ApiResponse<any[]>>('/admin/config'),

  updateConfig: (key: string, value: string, description?: string) =>
    api.put<ApiResponse<any>>('/admin/config', { key, value, description }),

  getFraudSignals: (page?: number) =>
    api.get<PaginatedResponse<any>>('/admin/fraud-signals', { params: { page } }),

  getBlacklist: (page?: number, violationType?: string) =>
    api.get<PaginatedResponse<any>>('/admin/blacklist', { params: { page, violationType } }),

  addToBlacklist: (data: {
    userId: string;
    reason: string;
    violationType?: string;
    evidence?: string;
    penaltyAmount?: number;
    orderId?: string;
    isPermanent?: boolean;
    telegramLocation?: string;
  }) => api.post<ApiResponse<any>>('/admin/blacklist', data),

  removeFromBlacklist: (id: string) =>
    api.delete<ApiResponse<any>>(`/admin/blacklist/${id}`),

  updateTaskPrice: (taskId: string, minPrice: number) =>
    api.patch<ApiResponse<any>>(`/catalog/admin/tasks/${taskId}/price`, { minPrice }),

  getPriceList: () =>
    api.get<ApiResponse<any[]>>('/catalog/price-list'),

  // ─── CRUD Категории ────────────────────
  createCategory: (data: {
    name: string;
    nameUz?: string;
    nameEn?: string;
    slug: string;
    icon?: string;
  }) => api.post<ApiResponse<any>>('/catalog/admin/categories', data),

  updateCategory: (id: string, data: any) =>
    api.put<ApiResponse<any>>(`/catalog/admin/categories/${id}`, data),

  deleteCategory: (id: string) =>
    api.delete<ApiResponse<any>>(`/catalog/admin/categories/${id}`),

  // ─── CRUD Подкатегории ────────────────
  createSubcategory: (data: {
    categoryId: string;
    name: string;
    nameUz?: string;
    nameEn?: string;
    slug: string;
    icon?: string;
  }) => api.post<ApiResponse<any>>('/catalog/admin/subcategories', data),

  updateSubcategory: (id: string, data: any) =>
    api.put<ApiResponse<any>>(`/catalog/admin/subcategories/${id}`, data),

  deleteSubcategory: (id: string) =>
    api.delete<ApiResponse<any>>(`/catalog/admin/subcategories/${id}`),

  // ─── CRUD Задачи ──────────────────────
  createTask: (data: {
    subcategoryId: string;
    name: string;
    nameUz?: string;
    nameEn?: string;
    description?: string;
    descriptionUz?: string;
    descriptionEn?: string;
    estimatedTime?: string;
    estimatedTimeUz?: string;
    estimatedTimeEn?: string;
    minPrice?: number;
    slug: string;
  }) => api.post<ApiResponse<any>>('/catalog/admin/tasks', data),

  updateTask: (taskId: string, data: any) =>
    api.put<ApiResponse<any>>(`/catalog/admin/tasks/${taskId}`, data),

  deleteTask: (taskId: string) =>
    api.delete<ApiResponse<any>>(`/catalog/admin/tasks/${taskId}`),

  // Полное дерево каталога (включая неактивные — для админки)
  getFullCatalog: () =>
    api.get<ApiResponse<any[]>>('/catalog/admin/full'),

  // ─── Сертификаты мастеров ──────────────
  getCertificates: (params?: { page?: number; verified?: string }) =>
    api.get<PaginatedResponse<any>>('/admin/certificates', { params }),

  verifyCertificate: (id: string) =>
    api.put<ApiResponse<any>>(`/admin/certificates/${id}/verify`),

  rejectCertificate: (id: string) =>
    api.put<ApiResponse<any>>(`/admin/certificates/${id}/reject`),

  // ─── Категории мастеров ────────────────
  getMasterCategories: (masterId: string) =>
    api.get<ApiResponse<any[]>>(`/admin/master/${masterId}/categories`),

  updateMasterCategories: (masterId: string, categoryIds: string[]) =>
    api.put<ApiResponse<any>>(`/admin/master/${masterId}/categories`, { categoryIds }),
};

// ─── Stores API (Партнёрские магазины) ──────
export const storesApi = {
  getAll: (params?: { category?: string; city?: string; search?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<any>>('/stores', { params }),

  getCategories: () =>
    api.get<ApiResponse<any[]>>('/stores/categories'),

  getBySlug: (slug: string) =>
    api.get<ApiResponse<any>>(`/stores/${slug}`),

  getProducts: (slug: string, params?: { category?: string; search?: string; page?: number }) =>
    api.get<PaginatedResponse<any>>(`/stores/${slug}/products`, { params }),

  submitPartnerRequest: (data: {
    storeName: string;
    contactPerson: string;
    phone: string;
    email?: string;
    address?: string;
    city?: string;
    storeCategory: string;
    message?: string;
  }) => api.post<ApiResponse<any>>('/stores/partner-request', data),

  addReview: (slug: string, data: { rating: number; comment?: string }) =>
    api.post<ApiResponse<any>>(`/stores/${slug}/reviews`, data),

  // Admin
  getPartnerRequests: (params?: { status?: string; page?: number }) =>
    api.get<PaginatedResponse<any>>('/stores/admin/requests', { params }),

  approveRequest: (id: string) =>
    api.put<ApiResponse<any>>(`/stores/admin/requests/${id}/approve`),

  rejectRequest: (id: string, adminNote?: string) =>
    api.put<ApiResponse<any>>(`/stores/admin/requests/${id}/reject`, { adminNote }),

  createStore: (data: any) =>
    api.post<ApiResponse<any>>('/stores/admin', data),

  updateStore: (id: string, data: any) =>
    api.put<ApiResponse<any>>(`/stores/admin/${id}`, data),

  deleteStore: (id: string) =>
    api.delete<ApiResponse<any>>(`/stores/admin/${id}`),
};

// ─── Turnkey API (Ремонт под ключ) ──────────
export const turnkeyApi = {
  create: (data: {
    title: string;
    description?: string;
    propertyType: string;
    area?: number;
    rooms?: number;
    budgetMin?: number;
    budgetMax?: number;
    address?: string;
    city?: string;
    designIncluded?: boolean;
    furnitureIncluded?: boolean;
    images?: string[];
  }) => api.post<ApiResponse<any>>('/turnkey', data),

  getMyProjects: () =>
    api.get<ApiResponse<any[]>>('/turnkey/my'),

  getProject: (id: string) =>
    api.get<ApiResponse<any>>(`/turnkey/${id}`),

  updateProject: (id: string, data: any) =>
    api.put<ApiResponse<any>>(`/turnkey/${id}`, data),

  getEstimate: (params: {
    propertyType?: string;
    area: number;
    rooms?: number;
    designIncluded?: boolean;
    furnitureIncluded?: boolean;
  }) => api.get<ApiResponse<any>>('/turnkey/calculator/estimate', { params }),

  // Admin
  getAllProjects: (params?: { status?: string; page?: number }) =>
    api.get<PaginatedResponse<any>>('/turnkey/admin/projects', { params }),

  updateProjectStatus: (id: string, data: { status: string; totalPrice?: number; estimatedDays?: number }) =>
    api.put<ApiResponse<any>>(`/turnkey/admin/projects/${id}/status`, data),

  updateStage: (id: string, data: { status?: string; progress?: number; startDate?: string; endDate?: string }) =>
    api.put<ApiResponse<any>>(`/turnkey/admin/stages/${id}`, data),
};

// ─── Linked Cards API (привязанные карты) ──────
export const cardsApi = {
  getAll: () =>
    api.get<ApiResponse<any[]>>('/cards'),

  add: (data: { cardNumber: string; cardHolder?: string; expiryMonth?: number; expiryYear?: number }) =>
    api.post<ApiResponse<any>>('/cards', data),

  setDefault: (id: string) =>
    api.put<ApiResponse<any>>(`/cards/${id}/default`),

  remove: (id: string) =>
    api.delete<ApiResponse<any>>(`/cards/${id}`),
};
