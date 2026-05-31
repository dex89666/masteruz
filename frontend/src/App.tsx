// ============================================
// MasterUz — App.tsx (Routing)
// Агент 2 (Фронтенд-разработчик)
// ============================================

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import toast, { Toaster } from 'react-hot-toast';
import { getErrorMessage, getStatus } from './lib/getErrorMessage';
import { I18nProvider } from './i18n';
import { ErrorBoundary } from './components/ErrorBoundary';

import { Layout } from './components/Layout';
import { ConsentGate } from './components/ConsentGate';
import { UpdateChecker } from './components/UpdateChecker';
import { AppUpdatePrompt } from './components/AppUpdatePrompt';
import { GlobalConfirmDialog } from './components/GlobalConfirmDialog';
import { GlobalPromptDialog } from './components/GlobalPromptDialog';
import { useAppInit } from './hooks';
import { useTelegramDeepLinkAuth } from './hooks/useTelegramDeepLinkAuth';
import { trackPageView } from './lib/analytics';
import { useAuthStore } from './store';
import { lazy, Suspense, useEffect } from 'react';
import { LoadingSpinner } from './components/LoadingSpinner';

// Lazy-loaded Pages (code splitting)
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const OrdersListPage = lazy(() => import('./pages/OrdersListPage').then(m => ({ default: m.OrdersListPage })));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage').then(m => ({ default: m.OrderDetailPage })));
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage').then(m => ({ default: m.MyOrdersPage })));
const CreateOrderPage = lazy(() => import('./pages/CreateOrderPage').then(m => ({ default: m.CreateOrderPage })));
const NewOrderChoicePage = lazy(() => import('./pages/NewOrderChoicePage').then(m => ({ default: m.NewOrderChoicePage })));
const MasterDashboardPage = lazy(() => import('./pages/MasterDashboardPage').then(m => ({ default: m.MasterDashboardPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const MapPage = lazy(() => import('./pages/MapPage').then(m => ({ default: m.MapPage })));
const SchoolPage = lazy(() => import('./pages/SchoolPage').then(m => ({ default: m.SchoolPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminRegistryPage = lazy(() => import('./pages/AdminRegistryPage').then(m => ({ default: m.AdminRegistryPage })));
const AdminSubscriptionsPage = lazy(() => import('./pages/AdminSubscriptionsPage').then(m => ({ default: m.AdminSubscriptionsPage })));
const BecomeMasterPage = lazy(() => import('./pages/BecomeMasterPage').then(m => ({ default: m.BecomeMasterPage })));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage').then(m => ({ default: m.FavoritesPage })));
const MasterSearchPage = lazy(() => import('./pages/MasterSearchPage').then(m => ({ default: m.MasterSearchPage })));
const MasterProfilePage = lazy(() => import('./pages/MasterProfilePage').then(m => ({ default: m.MasterProfilePage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })));
const ProfileSettingsPage = lazy(() => import('./pages/ProfileSettingsPage').then(m => ({ default: m.ProfileSettingsPage })));
const PaymentHistoryPage = lazy(() => import('./pages/PaymentHistoryPage').then(m => ({ default: m.PaymentHistoryPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const ReviewFormPage = lazy(() => import('./pages/ReviewFormPage').then(m => ({ default: m.ReviewFormPage })));
const ClientReviewPage = lazy(() => import('./pages/ClientReviewPage').then(m => ({ default: m.ClientReviewPage })));
const ReportPage = lazy(() => import('./pages/ReportPage').then(m => ({ default: m.ReportPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const HelpSupportPage = lazy(() => import('./pages/HelpSupportPage').then(m => ({ default: m.HelpSupportPage })));
const MasterPortfolioPage = lazy(() => import('./pages/MasterPortfolioPage').then(m => ({ default: m.MasterPortfolioPage })));
const BalancePage = lazy(() => import('./pages/BalancePage').then(m => ({ default: m.BalancePage })));
const MasterProPage = lazy(() => import('./pages/MasterProPage').then(m => ({ default: m.MasterProPage })));
const CatalogPage = lazy(() => import('./pages/CatalogPage').then(m => ({ default: m.CatalogPage })));
const SubcategoryPage = lazy(() => import('./pages/SubcategoryPage').then(m => ({ default: m.SubcategoryPage })));
const ServicesCatalogPage = lazy(() => import('./pages/ServicesCatalogPage').then(m => ({ default: m.ServicesCatalogPage })));
const CartPage = lazy(() => import('./pages/CartPage').then(m => ({ default: m.CartPage })));
const StoresPage = lazy(() => import('./pages/StoresPage').then(m => ({ default: m.StoresPage })));
const StoreProfilePage = lazy(() => import('./pages/StoreProfilePage').then(m => ({ default: m.StoreProfilePage })));
const PartnerRequestPage = lazy(() => import('./pages/PartnerRequestPage').then(m => ({ default: m.PartnerRequestPage })));
const TurnkeyPage = lazy(() => import('./pages/TurnkeyPage').then(m => ({ default: m.TurnkeyPage })));
const MyTurnkeyProjectsPage = lazy(() => import('./pages/MyTurnkeyProjectsPage').then(m => ({ default: m.MyTurnkeyProjectsPage })));
const TurnkeyProjectDetailPage = lazy(() => import('./pages/TurnkeyProjectDetailPage').then(m => ({ default: m.TurnkeyProjectDetailPage })));
const CareersPage = lazy(() => import('./pages/CareersPage').then(m => ({ default: m.CareersPage })));
const DevelopmentPage = lazy(() => import('./pages/DevelopmentPage').then(m => ({ default: m.DevelopmentPage })));
const CreateEstimationPage = lazy(() => import('./pages/CreateEstimationPage').then(m => ({ default: m.CreateEstimationPage })));
const EstimateFormPage = lazy(() => import('./pages/EstimateFormPage').then(m => ({ default: m.EstimateFormPage })));
const EstimateViewPage = lazy(() => import('./pages/EstimateViewPage').then(m => ({ default: m.EstimateViewPage })));
const InstantOrderPage = lazy(() => import('./pages/InstantOrderPage').then(m => ({ default: m.InstantOrderPage })));
const SupportChatPage = lazy(() => import('./pages/SupportChatPage').then(m => ({ default: m.SupportChatPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));
const PublicOfferPage = lazy(() => import('./pages/PublicOfferPage').then(m => ({ default: m.PublicOfferPage })));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage').then(m => ({ default: m.TermsOfServicePage })));
const ComplaintPage = lazy(() => import('./pages/ComplaintPage').then(m => ({ default: m.ComplaintPage })));
const ForumPage = lazy(() => import('./pages/ForumPage').then(m => ({ default: m.ForumPage })));
const ForumTopicPage = lazy(() => import('./pages/ForumPage').then(m => ({ default: m.ForumTopicPage })));
const LinkedCardsPage = lazy(() => import('./pages/LinkedCardsPage').then(m => ({ default: m.LinkedCardsPage })));
const DownloadAppPage = lazy(() => import('./pages/DownloadAppPage').then(m => ({ default: m.DownloadAppPage })));
const PublicCalculatorPage = lazy(() => import('./pages/PublicCalculatorPage').then(m => ({ default: m.PublicCalculatorPage })));

const queryClient = new QueryClient({
  // Глобальная обработка ошибок: ни один сетевой сбой не остаётся «немым».
  // Запросы: тост только при первой неудачной загрузке (данных ещё нет) —
  // иначе у пользователя на экране уже есть данные, и фоновый сбой не трогаем.
  // Мутации: тост, если у мутации нет собственного onError.
  // 401 пропускаем — его обрабатывает интерсептор axios и ProtectedRoute.
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silent || getStatus(error) === 401) return;
      if (query.state.data !== undefined) return;
      toast.error(getErrorMessage(error), { id: String(query.queryHash) });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent || mutation.options.onError || getStatus(error) === 401) return;
      toast.error(getErrorMessage(error));
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protect route for authenticated users
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Глобальный guard: вся аппа требует логин.
// Разрешены без авторизации: страница логина и юридические документы (privacy/terms/offer),
// чтобы пользователь мог прочесть, с чем соглашается, ДО входа.
const PUBLIC_ROUTES = ['/login', '/privacy', '/terms', '/public-offer', '/download', '/calculator'];

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();
  const isPublic = PUBLIC_ROUTES.includes(location.pathname.replace(/\/$/, ''));

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><LoadingSpinner /></div>;
  }
  if (!isAuthenticated && !isPublic) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

// Protect route for masters only
function MasterRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user || user.role !== 'MASTER') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// Protect route for admins/managers
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AppContent() {
  // Initialize app (restore JWT session, detect Telegram Mini App, etc.)
  useAppInit();
  // Слушаем deep-link uz.masteruz.app://auth от внешнего Telegram OAuth.
  useTelegramDeepLinkAuth();

  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return (
    <ConsentGate>
    <AuthGate>
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner /></div>}>
      <Routes>
      {/* Публичный AI-калькулятор — полноэкранный, вне Layout, без авторизации (viral landing) */}
      <Route path="/calculator" element={<PublicCalculatorPage />} />

      {/* Public routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="orders" element={<OrdersListPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="catalog/:slug" element={<CatalogPage />} />
        <Route path="catalog/:categorySlug/:subcategorySlug" element={<SubcategoryPage />} />
        <Route path="services/:slug" element={<ServicesCatalogPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="masters" element={<MasterSearchPage />} />
        <Route path="masters/:id" element={<MasterProfilePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="support" element={<HelpSupportPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="stores" element={<StoresPage />} />
        <Route path="stores/partner-request" element={<PartnerRequestPage />} />
        <Route path="stores/:slug" element={<StoreProfilePage />} />
        <Route path="turnkey" element={<TurnkeyPage />} />
        <Route path="careers" element={<CareersPage />} />
        <Route path="development" element={<DevelopmentPage />} />
        <Route path="privacy" element={<PrivacyPolicyPage />} />
        <Route path="public-offer" element={<PublicOfferPage />} />
        <Route path="terms" element={<TermsOfServicePage />} />
        <Route path="complaint" element={<ComplaintPage />} />
        <Route path="download" element={<DownloadAppPage />} />
        <Route path="forum" element={<ForumPage />} />
        <Route path="forum/:id" element={<ForumTopicPage />} />

        {/* Estimation (оценка) routes */}
        <Route
          path="estimation/create"
          element={
            <ProtectedRoute>
              <CreateEstimationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="estimation/:orderId/estimate"
          element={
            <ProtectedRoute>
              <EstimateViewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="estimation/:orderId/form"
          element={
            <MasterRoute>
              <EstimateFormPage />
            </MasterRoute>
          }
        />

        {/* Instant AI Order (ФотоЗаказ за 30 сек) */}
        <Route
          path="instant-order"
          element={
            <ProtectedRoute>
              <InstantOrderPage />
            </ProtectedRoute>
          }
        />

        {/* Support Chat (Чат поддержки) */}
        <Route
          path="support-chat"
          element={
            <ProtectedRoute>
              <SupportChatPage />
            </ProtectedRoute>
          }
        />

        {/* Protected routes (need auth) */}
        <Route
          path="new-order"
          element={
            <ProtectedRoute>
              <NewOrderChoicePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders/create"
          element={
            <ProtectedRoute>
              <CreateOrderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="my-orders"
          element={
            <ProtectedRoute>
              <MyOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="favorites"
          element={
            <ProtectedRoute>
              <FavoritesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="turnkey/my"
          element={
            <ProtectedRoute>
              <MyTurnkeyProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="turnkey/:id"
          element={
            <ProtectedRoute>
              <TurnkeyProjectDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard"
          element={
            <MasterRoute>
              <MasterDashboardPage />
            </MasterRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute>
              <ProfileSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="cards"
          element={
            <ProtectedRoute>
              <LinkedCardsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="payments"
          element={
            <ProtectedRoute>
              <PaymentHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="balance"
          element={
            <ProtectedRoute>
              <BalancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pro"
          element={
            <MasterRoute>
              <MasterProPage />
            </MasterRoute>
          }
        />
        <Route
          path="notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders/:orderId/review"
          element={
            <ProtectedRoute>
              <ReviewFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders/:orderId/client-review"
          element={
            <MasterRoute>
              <ClientReviewPage />
            </MasterRoute>
          }
        />
        <Route
          path="orders/:orderId/report"
          element={
            <ProtectedRoute>
              <ReportPage />
            </ProtectedRoute>
          }
        />

        {/* Master routes */}
        <Route
          path="school"
          element={
            <ProtectedRoute>
              <SchoolPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="become-master"
          element={
            <ProtectedRoute>
              <BecomeMasterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="portfolio"
          element={
            <MasterRoute>
              <MasterPortfolioPage />
            </MasterRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/registry"
          element={
            <AdminRoute>
              <AdminRegistryPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/subscriptions"
          element={
            <AdminRoute>
              <AdminSubscriptionsPage />
            </AdminRoute>
          }
        />

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </Suspense>
    </AuthGate>
    </ConsentGate>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppContent />
            <UpdateChecker />
            <AppUpdatePrompt />
            <GlobalConfirmDialog />
            <GlobalPromptDialog />
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3000,
                style: {
                  borderRadius: '12px',
                  background: '#333',
                  color: '#fff',
                  fontSize: '14px',
                },
              }}
            />
          </BrowserRouter>
        </I18nProvider>
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
