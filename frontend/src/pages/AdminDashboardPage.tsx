// ============================================
// MasterUz — Admin Dashboard Page (Full)
// 5 табов: Обзор, Пользователи, Заказы, Платежи, Настройки
// ============================================

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, storesApi, turnkeyApi, estimationApi, chatApi, supportChatApi, instantOrderApi, schoolApi } from '../api/client';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';
import { useFormatPrice } from '../hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import {
  BarChart3, Users, ShoppingBag, DollarSign,
  Shield, Search, ChevronLeft, ChevronRight, Ban, CheckCircle,
  Settings, Save, CreditCard, UserCheck, UserX, Clock,
  AlertTriangle, Zap, Package, Star, Activity,
  ArrowUpRight, ArrowDownRight,
  XCircle, RefreshCw, Database, Store, Hammer,
  FolderTree, Plus, Trash2, Edit3, ChevronDown, ChevronUp,
  Headphones, Send, MessageCircle, FileText, Sparkles,
  GraduationCap, HelpCircle, BookOpen, Phone,
  Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Dashboard } from '../types';

type AdminTab = 'overview' | 'users' | 'orders' | 'payments' | 'catalog' | 'config' | 'stores' | 'turnkey' | 'moderation' | 'support' | 'school' | 'security';

// ─── Stat Card Component ────────────────────
function StatCard({ icon: Icon, label, value, subValue, color, trend }: {
  icon: any;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  trend?: { value: number; up: boolean };
}) {
  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
          <Icon size={22} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            trend.up
              ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {trend.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold dark:text-white">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
        {subValue && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subValue}</p>
        )}
      </div>
    </div>
  );
}

// ─── Status Distribution Bar ────────────────
function StatusBar({ items }: { items: { label: string; count: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
        {items.map((item, i) => (
          <div
            key={i}
            className={`${item.color} transition-all`}
            style={{ width: `${(item.count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
            <span className="font-semibold dark:text-white">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  // Users tab state
  const [users, setUsers] = useState<any[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersRole, setUsersRole] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // Orders tab state
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [ordersStatus, setOrdersStatus] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Notification diagnostics modal
  const [notifyOrder, setNotifyOrder] = useState<{ id: string; title: string } | null>(null);
  const [notifyDebug, setNotifyDebug] = useState<any | null>(null);
  const [notifyLog, setNotifyLog] = useState<any | null>(null);
  const [notifyLoading, setNotifyLoading] = useState(false);

  // Payments tab state
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(1);
  const [paymentsStatus, setPaymentsStatus] = useState('');
  const [paymentsProvider, setPaymentsProvider] = useState('');
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Config tab state
  const [config, setConfig] = useState<any[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [fraudSignals, setFraudSignals] = useState<any[]>([]);
  const [fraudLoading, setFraudLoading] = useState(false);
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Stores tab state
  const [partnerRequests, setPartnerRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsStatus, setRequestsStatus] = useState('');

  // Turnkey tab state
  const [turnkeyProjects, setTurnkeyProjects] = useState<any[]>([]);
  const [turnkeyLoading, setTurnkeyLoading] = useState(false);
  const [turnkeyStatus, setTurnkeyStatus] = useState('');

  // Catalog tab state
  const [catalogTree, setCatalogTree] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{ type: 'category' | 'subcategory' | 'task'; id: string | null; data: any } | null>(null);
  const [showAddForm, setShowAddForm] = useState<{ type: 'category' | 'subcategory' | 'task'; parentId?: string } | null>(null);
  const [formData, setFormData] = useState<any>({});

  // Moderation tab state
  const [pendingEstimates, setPendingEstimates] = useState<any[]>([]);
  const [flaggedMessages, setFlaggedMessages] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationSubTab, setModerationSubTab] = useState<'estimates' | 'messages' | 'blacklist' | 'aiOrders' | 'chatArchive'>('aiOrders');

  // Chat archive state
  const [chatArchive, setChatArchive] = useState<any[]>([]);
  const [chatArchiveTotal, setChatArchiveTotal] = useState(0);
  const [chatArchivePage, setChatArchivePage] = useState(1);
  const [chatArchiveSearch, setChatArchiveSearch] = useState('');
  const [chatArchiveLoading, setChatArchiveLoading] = useState(false);
  const [chatArchiveViewOrderId, setChatArchiveViewOrderId] = useState<string | null>(null);
  const [chatArchiveMessages, setChatArchiveMessages] = useState<any[]>([]);
  const [chatArchiveMsgLoading, setChatArchiveMsgLoading] = useState(false);

  // Support chat tab state
  const [supportChats, setSupportChats] = useState<any[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSelectedChat, setSupportSelectedChat] = useState<any | null>(null);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [supportNewMsg, setSupportNewMsg] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportNewUserId, setSupportNewUserId] = useState('');
  const [supportNewSubject, setSupportNewSubject] = useState('');
  const [supportUserSearch, setSupportUserSearch] = useState('');
  const [supportUserResults, setSupportUserResults] = useState<any[]>([]);
  const [supportUserSearching, setSupportUserSearching] = useState(false);

  // AI Orders moderation state
  const [aiModerationOrders, setAiModerationOrders] = useState<any[]>([]);
  const [aiModerationLoading, setAiModerationLoading] = useState(false);

  // Balance management modal state
  const [balanceModal, setBalanceModal] = useState<{ userId: string; userName: string } | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceAction, setBalanceAction] = useState<'topup' | 'withdraw'>('topup');
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceCurrentUser, setBalanceCurrentUser] = useState<number>(0);
  const [balanceTransactions, setBalanceTransactions] = useState<any[]>([]);
  const [balanceTxLoading, setBalanceTxLoading] = useState(false);

  // School tab state
  const [schoolCourses, setSchoolCourses] = useState<any[]>([]);
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [schoolEditCourse, setSchoolEditCourse] = useState<any | null>(null);
  const [schoolForm, setSchoolForm] = useState<any>({});
  const [schoolShowAdd, setSchoolShowAdd] = useState(false);
  const [schoolQuestions, setSchoolQuestions] = useState<any[]>([]);
  const [schoolQuestionsFor, setSchoolQuestionsFor] = useState<string | null>(null);
  const [schoolQLoading, setSchoolQLoading] = useState(false);
  const [schoolQForm, setSchoolQForm] = useState<any>({ options: ['', '', '', ''], correctIndex: 0 });
  const [schoolShowAddQ, setSchoolShowAddQ] = useState(false);


  // Guard: only ADMIN / MANAGER
  useEffect(() => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      navigate('/');
      return;
    }
    loadDashboard();
  }, [user]);

  // Tab change handlers
  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'orders') loadOrders();
    if (tab === 'payments') loadPayments();
    if (tab === 'config') loadConfig();
    if (tab === 'security') loadFraudSignals();
    if (tab === 'stores') loadPartnerRequests();
    if (tab === 'turnkey') loadTurnkeyProjects();
    if (tab === 'catalog') loadCatalog();
    if (tab === 'moderation') loadModerationData();
    if (tab === 'support') loadSupportChats();
    if (tab === 'school') loadSchoolCourses();
  }, [tab]);

  useEffect(() => { if (tab === 'stores') loadPartnerRequests(); }, [requestsStatus]);
  useEffect(() => { if (tab === 'turnkey') loadTurnkeyProjects(); }, [turnkeyStatus]);

  useEffect(() => { if (tab === 'users') loadUsers(); }, [usersPage, usersRole]);
  useEffect(() => { if (tab === 'orders') loadOrders(); }, [ordersPage, ordersStatus]);
  useEffect(() => { if (tab === 'payments') loadPayments(); }, [paymentsPage, paymentsStatus, paymentsProvider]);

  // Debounced user search
  useEffect(() => {
    if (tab !== 'users') return;
    const timer = setTimeout(() => {
      setUsersPage(1);
      loadUsers();
    }, 400);
    return () => clearTimeout(timer);
  }, [usersSearch]);

  async function loadDashboard() {
    try {
      const res = await adminApi.getDashboard();
      setDashboard(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // ─── Каталог: загрузка полного дерева ──────
  async function loadCatalog() {
    setCatalogLoading(true);
    try {
      const res = await adminApi.getFullCatalog();
      setCatalogTree(res.data.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Ошибка загрузки каталога');
    } finally {
      setCatalogLoading(false);
    }
  }

  async function loadModerationData() {
    setModerationLoading(true);
    try {
      const [estRes, msgRes, blRes] = await Promise.all([
        estimationApi.getPendingModeration().catch(() => ({ data: { data: [] } })),
        chatApi.getFlaggedMessages().catch(() => ({ data: { data: [] } })),
        adminApi.getBlacklist().catch(() => ({ data: { data: [] } })),
      ]);
      setPendingEstimates(estRes.data.data || []);
      setFlaggedMessages(msgRes.data.data || []);
      setBlacklist(blRes.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setModerationLoading(false);
    }
    // Also load AI orders
    loadAiModerationOrders();
  }

  async function loadAiModerationOrders() {
    setAiModerationLoading(true);
    try {
      const res = await instantOrderApi.getPendingModeration({ page: 1, limit: 50 });
      setAiModerationOrders(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setAiModerationLoading(false);
    }
  }

  async function handleModerateAiOrder(orderId: string, approved: boolean, note?: string) {
    try {
      await instantOrderApi.moderate(orderId, approved, note);
      toast.success(approved ? 'Заказ одобрен и опубликован для мастеров' : 'Заказ отклонён, средства возвращены');
      loadAiModerationOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Ошибка модерации');
    }
  }

  async function handleModerateEstimate(estimateId: string, approved: boolean, comment?: string) {
    try {
      await estimationApi.moderateEstimate(estimateId, approved, comment);
      toast.success(approved ? 'Смета одобрена, основной заказ создан' : 'Смета отклонена, возврат средств');
      loadModerationData();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Ошибка');
    }
  }

  async function handleBlockMessage(messageId: string) {
    try {
      await chatApi.blockMessage(messageId);
      toast.success('Сообщение заблокировано');
      loadModerationData();
    } catch { toast.error('Ошибка'); }
  }

  async function handleUnflagMessage(messageId: string) {
    try {
      await chatApi.unflagMessage(messageId);
      toast.success('Флаг снят');
      loadModerationData();
    } catch { toast.error('Ошибка'); }
  }

  async function handleRemoveFromBlacklist(id: string) {
    try {
      await adminApi.removeFromBlacklist(id);
      toast.success('Пользователь разблокирован');
      loadModerationData();
    } catch { toast.error('Ошибка'); }
  }

  // ─── Chat Archive Functions ────────────────
  async function loadChatArchive() {
    setChatArchiveLoading(true);
    try {
      const res = await chatApi.getArchive({ page: chatArchivePage, search: chatArchiveSearch });
      setChatArchive(res.data.data || []);
      setChatArchiveTotal(res.data.total || 0);
    } catch (e) {
      console.error(e);
      toast.error('Ошибка загрузки архива чатов');
    } finally {
      setChatArchiveLoading(false);
    }
  }

  async function loadChatArchiveMessages(orderId: string) {
    setChatArchiveMsgLoading(true);
    setChatArchiveViewOrderId(orderId);
    try {
      const res = await chatApi.getMessages(orderId);
      setChatArchiveMessages(res.data.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Ошибка загрузки сообщений');
    } finally {
      setChatArchiveMsgLoading(false);
    }
  }

  // Load chat archive when sub-tab changes or page/search changes
  useEffect(() => {
    if (tab === 'moderation' && moderationSubTab === 'chatArchive') {
      loadChatArchive();
    }
  }, [moderationSubTab, chatArchivePage, chatArchiveSearch]);

  // ─── Support Chat Functions ────────────────
  async function loadSupportChats() {
    setSupportLoading(true);
    try {
      const res = await supportChatApi.getAdminChats({ page: 1, limit: 50 });
      setSupportChats(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSupportLoading(false);
    }
  }

  async function loadSupportMessages(chatId: string) {
    try {
      const res = await supportChatApi.getMessages(chatId);
      setSupportMessages(res.data.data || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSendSupportMessage() {
    if (!supportSelectedChat || !supportNewMsg.trim() || supportSending) return;
    setSupportSending(true);
    try {
      await supportChatApi.sendMessage(supportSelectedChat.id, supportNewMsg.trim());
      setSupportNewMsg('');
      await loadSupportMessages(supportSelectedChat.id);
    } catch { toast.error('Ошибка отправки'); }
    finally { setSupportSending(false); }
  }

  async function handleCreateSupportChat() {
    if (!supportNewUserId.trim()) { toast.error('Выберите пользователя'); return; }
    try {
      await supportChatApi.createChat(supportNewUserId.trim(), supportNewSubject || undefined);
      toast.success('Чат создан');
      setSupportNewUserId('');
      setSupportNewSubject('');
      setSupportUserResults([]);
      setSupportUserSearch('');
      loadSupportChats();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Ошибка создания чата');
    }
  }

  async function handleSearchSupportUsers() {
    if (!supportUserSearch.trim()) return;
    setSupportUserSearching(true);
    try {
      const res = await adminApi.getUsers({
        page: 1,
        limit: 20,
        search: supportUserSearch.trim(),
      });
      setSupportUserResults(res.data.data || []);
    } catch {
      toast.error('Ошибка поиска');
    } finally {
      setSupportUserSearching(false);
    }
  }

  async function handleCloseSupportChat(chatId: string) {
    try {
      await supportChatApi.closeChat(chatId);
      toast.success('Чат закрыт');
      setSupportSelectedChat(null);
      loadSupportChats();
    } catch { toast.error('Ошибка'); }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await adminApi.getUsers({
        page: usersPage,
        limit: 15,
        role: usersRole || undefined,
        search: usersSearch || undefined,
      });
      setUsers(res.data.data || []);
      if (res.data.pagination) setUsersTotalPages(res.data.pagination.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadOrders() {
    setOrdersLoading(true);
    try {
      const res = await adminApi.getOrders({
        page: ordersPage,
        limit: 15,
        status: ordersStatus || undefined,
      });
      setOrders(res.data.data || []);
      if (res.data.pagination) setOrdersTotalPages(res.data.pagination.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function openNotifyDiag(order: { id: string; title: string }) {
    setNotifyOrder(order);
    setNotifyDebug(null);
    setNotifyLog(null);
    setNotifyLoading(true);
    try {
      const [debugRes, logRes] = await Promise.all([
        adminApi.getOrderNotificationDebug(order.id),
        adminApi.getOrderDeliveryLog(order.id),
      ]);
      setNotifyDebug(debugRes.data.data);
      setNotifyLog(logRes.data.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Не удалось загрузить диагностику');
    } finally {
      setNotifyLoading(false);
    }
  }

  async function loadPayments() {
    setPaymentsLoading(true);
    try {
      const res = await adminApi.getPayments({
        page: paymentsPage,
        limit: 15,
        status: paymentsStatus || undefined,
        provider: paymentsProvider || undefined,
      });
      setPayments(res.data.data || []);
      if (res.data.pagination) setPaymentsTotalPages(res.data.pagination.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function loadConfig() {
    setConfigLoading(true);
    try {
      const res = await adminApi.getConfig();
      setConfig(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setConfigLoading(false);
    }
  }

  async function loadFraudSignals() {
    setFraudLoading(true);
    try {
      const res = await adminApi.getFraudSignals(1);
      setFraudSignals(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setFraudLoading(false);
    }
  }

  // ─── Каталог: CRUD обработчики ──────
  function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-+|-+$/g, '').replace(/а/g,'a').replace(/б/g,'b').replace(/в/g,'v').replace(/г/g,'g').replace(/д/g,'d').replace(/е/g,'e').replace(/ё/g,'yo').replace(/ж/g,'zh').replace(/з/g,'z').replace(/и/g,'i').replace(/й/g,'y').replace(/к/g,'k').replace(/л/g,'l').replace(/м/g,'m').replace(/н/g,'n').replace(/о/g,'o').replace(/п/g,'p').replace(/р/g,'r').replace(/с/g,'s').replace(/т/g,'t').replace(/у/g,'u').replace(/ф/g,'f').replace(/х/g,'kh').replace(/ц/g,'ts').replace(/ч/g,'ch').replace(/ш/g,'sh').replace(/щ/g,'shch').replace(/ъ/g,'').replace(/ы/g,'y').replace(/ь/g,'').replace(/э/g,'e').replace(/ю/g,'yu').replace(/я/g,'ya');
  }

  function openAddForm(type: 'category' | 'subcategory' | 'task', parentId?: string) {
    setShowAddForm({ type, parentId });
    setFormData({ name: '', nameUz: '', nameEn: '', icon: '', minPrice: 0, description: '', estimatedTime: '' });
  }

  function openEditForm(type: 'category' | 'subcategory' | 'task', item: any) {
    setEditingItem({ type, id: item.id, data: item });
    setFormData({
      name: item.name || '',
      nameUz: item.nameUz || '',
      nameEn: item.nameEn || '',
      icon: item.icon || '',
      minPrice: item.minPrice || 0,
      description: item.description || '',
      estimatedTime: item.estimatedTime || '',
      isActive: item.isActive !== false,
    });
  }

  function cancelForm() {
    setShowAddForm(null);
    setEditingItem(null);
    setFormData({});
  }

  async function handleCreateCategory() {
    if (!formData.name) return toast.error('Введите название');
    try {
      await adminApi.createCategory({
        name: formData.name,
        nameUz: formData.nameUz || undefined,
        nameEn: formData.nameEn || undefined,
        slug: slugify(formData.name),
        icon: formData.icon || undefined,
      });
      toast.success('Категория создана');
      cancelForm();
      loadCatalog();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Ошибка создания');
    }
  }

  async function handleUpdateCategory(id: string) {
    try {
      await adminApi.updateCategory(id, {
        name: formData.name,
        nameUz: formData.nameUz || undefined,
        nameEn: formData.nameEn || undefined,
        icon: formData.icon || undefined,
        isActive: formData.isActive,
      });
      toast.success('Категория обновлена');
      cancelForm();
      loadCatalog();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Ошибка обновления');
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm('Удалить категорию? Все подкатегории и задачи станут неактивными.')) return;
    try {
      await adminApi.deleteCategory(id);
      toast.success('Категория удалена');
      loadCatalog();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Ошибка удаления');
    }
  }

  async function handleCreateSubcategory() {
    if (!formData.name || !showAddForm?.parentId) return toast.error('Введите название');
    try {
      await adminApi.createSubcategory({
        categoryId: showAddForm.parentId,
        name: formData.name,
        nameUz: formData.nameUz || undefined,
        nameEn: formData.nameEn || undefined,
        slug: slugify(formData.name),
        icon: formData.icon || undefined,
      });
      toast.success('Подкатегория создана');
      cancelForm();
      loadCatalog();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Ошибка создания');
    }
  }

  async function handleUpdateSubcategory(id: string) {
    try {
      await adminApi.updateSubcategory(id, {
        name: formData.name,
        nameUz: formData.nameUz || undefined,
        nameEn: formData.nameEn || undefined,
        icon: formData.icon || undefined,
        isActive: formData.isActive,
      });
      toast.success('Подкатегория обновлена');
      cancelForm();
      loadCatalog();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Ошибка обновления');
    }
  }

  async function handleDeleteSubcategory(id: string) {
    if (!confirm('Удалить подкатегорию? Все задачи станут неактивными.')) return;
    try {
      await adminApi.deleteSubcategory(id);
      toast.success('Подкатегория удалена');
      loadCatalog();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Ошибка удаления');
    }
  }

  async function handleCreateTask() {
    if (!formData.name || !showAddForm?.parentId) return toast.error('Введите название');
    try {
      await adminApi.createTask({
        subcategoryId: showAddForm.parentId,
        name: formData.name,
        nameUz: formData.nameUz || undefined,
        nameEn: formData.nameEn || undefined,
        description: formData.description || undefined,
        estimatedTime: formData.estimatedTime || undefined,
        minPrice: Number(formData.minPrice) || 0,
        slug: slugify(formData.name),
      });
      toast.success('Услуга создана');
      cancelForm();
      loadCatalog();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Ошибка создания');
    }
  }

  async function handleUpdateTask(id: string) {
    try {
      await adminApi.updateTask(id, {
        name: formData.name,
        nameUz: formData.nameUz || undefined,
        nameEn: formData.nameEn || undefined,
        description: formData.description || undefined,
        estimatedTime: formData.estimatedTime || undefined,
        minPrice: Number(formData.minPrice) || 0,
        isActive: formData.isActive,
      });
      toast.success('Услуга обновлена');
      cancelForm();
      loadCatalog();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Ошибка обновления');
    }
  }

  async function handleDeleteTask(id: string) {
    if (!confirm('Удалить услугу?')) return;
    try {
      await adminApi.deleteTask(id);
      toast.success('Услуга удалена');
      loadCatalog();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Ошибка удаления');
    }
  }

  function handleSubmitForm() {
    if (editingItem) {
      if (editingItem.type === 'category') handleUpdateCategory(editingItem.id!);
      else if (editingItem.type === 'subcategory') handleUpdateSubcategory(editingItem.id!);
      else handleUpdateTask(editingItem.id!);
    } else if (showAddForm) {
      if (showAddForm.type === 'category') handleCreateCategory();
      else if (showAddForm.type === 'subcategory') handleCreateSubcategory();
      else handleCreateTask();
    }
  }

  function toggleCat(id: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSub(id: string) {
    setExpandedSubs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleVerify(userId: string) {
    try {
      await adminApi.verifyUser(userId);
      toast.success(t('admin.userVerified'));
      loadUsers();
    } catch (e) {
      toast.error(t('common.error'));
    }
  }

  async function handleBlock(userId: string) {
    try {
      await adminApi.blockUser(userId);
      toast.success(t('admin.userStatusUpdated'));
      loadUsers();
    } catch (e) {
      toast.error(t('common.error'));
    }
  }

  async function handleChangeRole(userId: string, newRole: string) {
    try {
      await adminApi.changeUserRole(userId, newRole);
      toast.success(`Роль изменена на ${newRole}`);
      loadUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || t('common.error'));
    }
  }

  // ─── Balance Management Functions ──────
  async function openBalanceModal(userId: string, userName: string) {
    setBalanceModal({ userId, userName });
    setBalanceAmount('');
    setBalanceReason('');
    setBalanceAction('topup');
    setBalanceLoading(false);

    // Загружаем баланс и транзакции параллельно
    try {
      setBalanceTxLoading(true);
      const [balRes, txRes] = await Promise.all([
        adminApi.getUserBalance(userId),
        adminApi.getUserTransactions(userId, 1, 20),
      ]);
      setBalanceCurrentUser(balRes.data.data?.balance || 0);
      setBalanceTransactions(txRes.data.data || []);
    } catch {
      toast.error('Ошибка загрузки баланса');
    } finally {
      setBalanceTxLoading(false);
    }
  }

  async function handleBalanceOperation() {
    if (!balanceModal) return;
    const amt = Number(balanceAmount);
    if (!amt || amt <= 0) { toast.error('Введите корректную сумму'); return; }

    setBalanceLoading(true);
    try {
      if (balanceAction === 'topup') {
        await adminApi.topUpUserBalance(balanceModal.userId, amt, balanceReason || undefined);
        toast.success(`Зачислено ${amt.toLocaleString('ru')} сум`);
      } else {
        await adminApi.withdrawUserBalance(balanceModal.userId, amt, balanceReason || undefined);
        toast.success(`Списано ${amt.toLocaleString('ru')} сум`);
      }
      // Обновляем баланс и транзакции
      const [balRes, txRes] = await Promise.all([
        adminApi.getUserBalance(balanceModal.userId),
        adminApi.getUserTransactions(balanceModal.userId, 1, 20),
      ]);
      setBalanceCurrentUser(balRes.data.data?.balance || 0);
      setBalanceTransactions(txRes.data.data || []);
      setBalanceAmount('');
      setBalanceReason('');
      loadUsers(); // обновляем список пользователей
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Ошибка операции');
    } finally {
      setBalanceLoading(false);
    }
  }

  async function handleSaveConfig(key: string) {
    try {
      await adminApi.updateConfig(key, editValue);
      toast.success(t('admin.configUpdated'));
      setEditingConfig(null);
      loadConfig();
    } catch (e) {
      toast.error(t('common.error'));
    }
  }

  // ─── Stores: load partner requests ──────
  async function loadPartnerRequests() {
    setRequestsLoading(true);
    try {
      const params: any = { page: 1, limit: 50 };
      if (requestsStatus) params.status = requestsStatus;
      const res = await storesApi.getPartnerRequests(params);
      setPartnerRequests(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setRequestsLoading(false);
    }
  }

  async function handleApproveRequest(id: string) {
    try {
      await storesApi.approveRequest(id);
      toast.success('Заявка одобрена, магазин создан');
      loadPartnerRequests();
    } catch (e) {
      toast.error(t('common.error'));
    }
  }

  async function handleRejectRequest(id: string) {
    try {
      await storesApi.rejectRequest(id, 'Не соответствует требованиям');
      toast.success('Заявка отклонена');
      loadPartnerRequests();
    } catch (e) {
      toast.error(t('common.error'));
    }
  }

  // ─── Turnkey: load projects ──────
  async function loadTurnkeyProjects() {
    setTurnkeyLoading(true);
    try {
      const params: any = { page: 1, limit: 50 };
      if (turnkeyStatus) params.status = turnkeyStatus;
      const res = await turnkeyApi.getAllProjects(params);
      setTurnkeyProjects(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setTurnkeyLoading(false);
    }
  }

  async function handleUpdateProjectStatus(projectId: string, status: string) {
    try {
      await turnkeyApi.updateProjectStatus(projectId, { status });
      toast.success(`Статус обновлён: ${status}`);
      loadTurnkeyProjects();
    } catch (e) {
      toast.error(t('common.error'));
    }
  }

  // ─── School: загрузка и CRUD ────────────
  async function loadSchoolCourses() {
    setSchoolLoading(true);
    try {
      const res = await schoolApi.adminGetCourses();
      setSchoolCourses(res.data.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Ошибка загрузки курсов школы');
    } finally {
      setSchoolLoading(false);
    }
  }

  async function handleSchoolSaveCourse() {
    try {
      if (schoolEditCourse) {
        await schoolApi.adminUpdateCourse(schoolEditCourse.id, schoolForm);
        toast.success('Курс обновлён');
      } else {
        await schoolApi.adminCreateCourse(schoolForm);
        toast.success('Курс создан');
      }
      setSchoolEditCourse(null);
      setSchoolShowAdd(false);
      setSchoolForm({});
      loadSchoolCourses();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Ошибка сохранения курса');
    }
  }

  async function handleSchoolDeleteCourse(id: string) {
    if (!confirm('Удалить курс и все его вопросы?')) return;
    try {
      await schoolApi.adminDeleteCourse(id);
      toast.success('Курс удалён');
      loadSchoolCourses();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Ошибка удаления');
    }
  }

  async function loadSchoolQuestions(courseId: string) {
    setSchoolQuestionsFor(courseId);
    setSchoolQLoading(true);
    try {
      const res = await schoolApi.adminGetQuestions(courseId);
      setSchoolQuestions(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSchoolQLoading(false);
    }
  }

  async function handleSchoolSaveQuestion(courseId: string) {
    try {
      const opts = (schoolQForm.options || []).filter((o: string) => o.trim());
      if (opts.length < 2) { toast.error('Минимум 2 варианта ответа'); return; }
      if (!schoolQForm.question?.trim()) { toast.error('Введите вопрос'); return; }
      await schoolApi.adminCreateQuestion(courseId, {
        question: schoolQForm.question,
        questionUz: schoolQForm.questionUz || undefined,
        options: opts,
        optionsUz: schoolQForm.optionsUz?.filter((o: string) => o.trim()) || undefined,
        correctIndex: schoolQForm.correctIndex || 0,
        sortOrder: schoolQForm.sortOrder || 0,
      });
      toast.success('Вопрос добавлен');
      setSchoolShowAddQ(false);
      setSchoolQForm({ options: ['', '', '', ''], correctIndex: 0 });
      loadSchoolQuestions(courseId);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Ошибка');
    }
  }

  async function handleSchoolDeleteQuestion(qId: string) {
    if (!confirm('Удалить вопрос?')) return;
    try {
      await schoolApi.adminDeleteQuestion(qId);
      toast.success('Вопрос удалён');
      if (schoolQuestionsFor) loadSchoolQuestions(schoolQuestionsFor);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Ошибка');
    }
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) return null;

  const tabs: { key: AdminTab; label: string; icon: any }[] = [
    { key: 'overview', label: t('admin.tabOverview'), icon: BarChart3 },
    { key: 'users', label: t('admin.tabUsers'), icon: Users },
    { key: 'orders', label: t('admin.tabOrders'), icon: ShoppingBag },
    { key: 'payments', label: t('admin.tabPayments'), icon: CreditCard },
    { key: 'stores', label: t('stores.title'), icon: Store },
    { key: 'turnkey', label: t('turnkey.title'), icon: Hammer },
    { key: 'catalog', label: 'Каталог', icon: FolderTree },
    { key: 'school', label: 'Школа', icon: GraduationCap },
    { key: 'moderation', label: 'Модерация', icon: AlertTriangle },
    { key: 'security', label: 'Защита от обхода', icon: Shield },
    { key: 'support', label: 'Поддержка', icon: Headphones },
    { key: 'config', label: t('admin.tabConfig'), icon: Settings },
  ];

  const stats = dashboard?.stats;

  // Order status distribution for chart
  const orderStatusItems = useMemo(() => {
    if (!dashboard?.ordersByStatus) return [];
    const statusColors: Record<string, string> = {
      PUBLISHED: 'bg-blue-500',
      IN_PROGRESS: 'bg-yellow-500',
      COMPLETED: 'bg-green-500',
      CANCELLED: 'bg-red-500',
      DRAFT: 'bg-gray-400',
      DISPUTED: 'bg-purple-500',
    };
    return dashboard.ordersByStatus.map((s) => ({
      label: s.status,
      count: s.count,
      color: statusColors[s.status] || 'bg-gray-400',
    }));
  }, [dashboard]);

  return (
    <div className="page-container pb-20 admin-panel">
      <h1 className="page-title flex items-center gap-2 mb-2">
        <Shield size={24} className="text-red-500" />
        {t('admin.title')}
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                active
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Icon size={16} />
              {tb.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* TAB: OVERVIEW                          */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'overview' && (
        <>
          {loading ? (
            <LoadingSpinner />
          ) : stats ? (
            <div className="space-y-6">
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Users}
                  label={t('admin.statUsers')}
                  value={stats.totalUsers}
                  subValue={`${t('admin.masters')}: ${stats.totalMasters} · ${t('admin.clients')}: ${stats.totalClients}`}
                  color="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                />
                <StatCard
                  icon={ShoppingBag}
                  label={t('admin.statOrders')}
                  value={stats.totalOrders}
                  subValue={`${t('admin.activeOrders')}: ${stats.activeOrders}`}
                  color="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                />
                <StatCard
                  icon={DollarSign}
                  label={t('admin.statRevenue')}
                  value={formatPrice(stats.totalRevenue, t('common.currency'))}
                  subValue={`${t('admin.today')}: ${formatPrice(stats.todayRevenue, t('common.currency'))}`}
                  color="bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                />
                <StatCard
                  icon={Activity}
                  label={t('admin.completedToday')}
                  value={stats.todayOrders}
                  subValue={`${t('admin.newOrders')}`}
                  color="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                />
              </div>

              {/* Secondary Stats: Registration Fees & Urgent */}
              <div className="grid grid-cols-3 gap-2">
                <div className="card !p-3 text-center">
                  <Shield size={16} className="mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
                  <p className="text-lg font-bold dark:text-white">{stats.registrationFeesPaid || 0}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('admin.regFeesPaid')}</p>
                </div>
                <div className="card !p-3 text-center">
                  <AlertTriangle size={16} className="mx-auto text-red-500 dark:text-red-400 mb-1" />
                  <p className="text-lg font-bold dark:text-white">{stats.unpaidMasters || 0}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('admin.unpaidMasters')}</p>
                </div>
                <div className="card !p-3 text-center">
                  <Zap size={16} className="mx-auto text-orange-500 dark:text-orange-400 mb-1" />
                  <p className="text-lg font-bold dark:text-white">{stats.urgentOrders || 0}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('admin.urgentOrders')}</p>
                </div>
              </div>

              {/* Order Status Distribution */}
              {orderStatusItems.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-4 dark:text-white flex items-center gap-2">
                    <Package size={18} className="text-primary-600 dark:text-primary-400" />
                    {t('admin.statOrders')} — {t('admin.statistics')}
                  </h3>
                  <StatusBar items={orderStatusItems} />
                </div>
              )}

              {/* Top Masters */}
              {dashboard?.topMasters && dashboard.topMasters.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-4 dark:text-white flex items-center gap-2">
                    <Star size={18} className="text-yellow-500" />
                    {t('admin.topMasters')}
                  </h3>
                  <div className="space-y-3">
                    {dashboard.topMasters.slice(0, 5).map((m: any, i: number) => (
                      <div key={m.id} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          i === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          i === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                          i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate dark:text-white">
                            {m.user?.profile?.firstName || t('admin.noName')} {m.user?.profile?.lastName || ''}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {m.rating?.toFixed(1) || '0.0'} · {m.completedOrders || 0} {t('admin.statOrders').toLowerCase()}
                          </p>
                        </div>
                        {m.user?.isVerified && (
                          <Shield size={14} className="text-green-500 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Orders */}
              {dashboard?.recentOrders && dashboard.recentOrders.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-4 dark:text-white flex items-center gap-2">
                    <Clock size={18} className="text-primary-600 dark:text-primary-400" />
                    {t('admin.recentOrdersTitle')}
                  </h3>
                  <div className="space-y-2">
                    {dashboard.recentOrders.slice(0, 5).map((o: any) => (
                      <div
                        key={o.id}
                        onClick={() => navigate(`/orders/${o.id}`)}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate dark:text-white">
                            {o.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {o.client?.profile?.firstName || '?'} · {o.category?.name || ''}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <StatusBadge status={o.status} />
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">
                            {formatPrice(o.price, t('common.currency'))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={BarChart3}
              title={t('common.noData')}
              description={t('common.error')}
            />
          )}
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: USERS                             */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'users' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="input pl-9 text-sm"
                placeholder={t('admin.searchPlaceholder')}
                value={usersSearch}
                onChange={(e) => setUsersSearch(e.target.value)}
              />
            </div>
            <select
              className="input w-auto text-sm"
              value={usersRole}
              onChange={(e) => { setUsersRole(e.target.value); setUsersPage(1); }}
            >
              <option value="">{t('admin.allRoles')}</option>
              <option value="CLIENT">{t('admin.clients')}</option>
              <option value="MASTER">{t('admin.masters')}</option>
              <option value="ADMIN">{t('admin.admins')}</option>
            </select>
          </div>

          {/* Users List */}
          {usersLoading ? (
            <LoadingSpinner />
          ) : users.length === 0 ? (
            <EmptyState icon={Users} title={t('common.noData')} />
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="card">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {u.profile?.avatarUrl ? (
                        <img src={u.profile.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <Users size={18} className="text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate dark:text-white">
                          {u.profile?.firstName || t('admin.noName')} {u.profile?.lastName || ''}
                        </p>
                        {u.isVerified && <Shield size={12} className="text-green-500 flex-shrink-0" />}
                        {!u.isActive && <Ban size={12} className="text-red-500 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          u.role === 'MASTER' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                          u.role === 'ADMIN' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                          u.role === 'MANAGER' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                          'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {u.role}
                        </span>
                        {u.username && <span>@{u.username}</span>}
                        {u.phone && <span>{u.phone}</span>}
                      </div>
                      <div className="flex gap-3 text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        <span>{u._count?.clientOrders || 0} / {u._count?.masterOrders || 0}</span>
                        <span>{u._count?.reviewsReceived || 0} отз.</span>
                        <span>{Number(u.balance || 0).toLocaleString('ru')} сум</span>
                        <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {/* Balance button */}
                      {(user?.role === 'ADMIN') && (
                        <button
                          onClick={() => openBalanceModal(u.id, `${u.profile?.firstName || ''} ${u.profile?.lastName || ''}`.trim() || u.username || u.id.slice(0, 8))}
                          className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                          title="Управление балансом"
                        >
                          <DollarSign size={14} />
                        </button>
                      )}
                      {/* Role change (only ADMIN) */}
                      {user?.role === 'ADMIN' && u.id !== user?.id && (
                        <select
                          value={u.role}
                          onChange={(e) => handleChangeRole(u.id, e.target.value)}
                          className="text-[10px] px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 cursor-pointer"
                          title="Сменить роль"
                        >
                          <option value="CLIENT">CLIENT</option>
                          <option value="MASTER">MASTER</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      )}
                      {/* Quick test role buttons (Admin/Manager can assign additional status) */}
                      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && u.id !== user?.id && (
                        <div className="flex gap-0.5">
                          {u.role !== 'MASTER' && (
                            <button
                              onClick={() => handleChangeRole(u.id, 'MASTER')}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                              title="Назначить мастером для тестирования"
                            >
                              +М
                            </button>
                          )}
                          {u.role !== 'CLIENT' && (
                            <button
                              onClick={() => handleChangeRole(u.id, 'CLIENT')}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-100 transition-colors"
                              title="Назначить клиентом для тестирования"
                            >
                              +К
                            </button>
                          )}
                        </div>
                      )}
                      {!u.isVerified && u.role === 'MASTER' && (
                        <button
                          onClick={() => handleVerify(u.id)}
                          className="p-1.5 rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                          title={t('admin.verify')}
                        >
                          <UserCheck size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleBlock(u.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.isActive
                            ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50'
                            : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50'
                        }`}
                        title={u.isActive ? t('admin.block') : t('admin.unblock')}
                      >
                        {u.isActive ? <UserX size={14} /> : <CheckCircle size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {usersTotalPages > 1 && (
            <Pagination page={usersPage} totalPages={usersTotalPages} onPageChange={setUsersPage} />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: ORDERS                            */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <select
              className="input text-sm flex-1"
              value={ordersStatus}
              onChange={(e) => { setOrdersStatus(e.target.value); setOrdersPage(1); }}
            >
              <option value="">Все статусы</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="DISPUTED">DISPUTED</option>
            </select>
            <button
              onClick={() => loadOrders()}
              className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Orders List */}
          {ordersLoading ? (
            <LoadingSpinner />
          ) : orders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title={t('common.noData')} />
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  className="card cursor-pointer hover:shadow-md dark:hover:shadow-black/20 transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {o.isUrgent && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                            URGENT
                          </span>
                        )}
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="font-medium text-sm truncate dark:text-white">{o.title}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>{o.client?.profile?.firstName || '?'}</span>
                        {o.master && <span>{o.master?.profile?.firstName || '?'}</span>}
                        <span>{o.category?.name || ''}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        <span>{o._count?.responses || 0} откл.</span>
                        <span>{o._count?.reviews || 0} отз.</span>
                        {o.adminComment && <span className="text-purple-500">коммент</span>}
                        <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm dark:text-white">
                        {formatPrice(o.price, t('common.currency'))}
                      </p>
                      {o.commissionPaid && (
                        <span className="text-[10px] text-green-600 dark:text-green-400">комиссия</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); openNotifyDiag({ id: o.id, title: o.title }); }}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 transition-colors"
                        title="Диагностика уведомлений по этому заказу"
                      >
                        <Bell size={12} />
                        Уведомления
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {ordersTotalPages > 1 && (
            <Pagination page={ordersPage} totalPages={ordersTotalPages} onPageChange={setOrdersPage} />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: PAYMENTS                          */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'payments' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <select
              className="input text-sm flex-1"
              value={paymentsStatus}
              onChange={(e) => { setPaymentsStatus(e.target.value); setPaymentsPage(1); }}
            >
              <option value="">Все статусы</option>
              <option value="PENDING">PENDING</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="FAILED">FAILED</option>
              <option value="REFUNDED">REFUNDED</option>
            </select>
            <select
              className="input text-sm w-auto"
              value={paymentsProvider}
              onChange={(e) => { setPaymentsProvider(e.target.value); setPaymentsPage(1); }}
            >
              <option value="">Все провайдеры</option>
              <option value="CLICK">Click</option>
              <option value="PAYME">Payme</option>
              <option value="TELEGRAM_STARS">Telegram Stars</option>
            </select>
          </div>

          {/* Payments List */}
          {paymentsLoading ? (
            <LoadingSpinner />
          ) : payments.length === 0 ? (
            <EmptyState icon={CreditCard} title={t('common.noData')} />
          ) : (
            <div className="space-y-2">
              {payments.map((p) => {
                const statusColorMap: Record<string, string> = {
                  COMPLETED: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  PENDING: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                  PROCESSING: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                  FAILED: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                  REFUNDED: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                };
                const typeColorMap: Record<string, string> = {
                  ORDER_COMMISSION: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
                  REGISTRATION_FEE: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
                  ORDER_PAYMENT: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
                  REFERRAL_BONUS: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
                  SUBSCRIPTION: 'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
                };

                return (
                  <div key={p.id} className="card">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        statusColorMap[p.status] || 'bg-gray-100 text-gray-500'
                      }`}>
                        {p.status === 'COMPLETED' ? <CheckCircle size={18} /> :
                         p.status === 'FAILED' ? <XCircle size={18} /> :
                         <Clock size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-sm truncate dark:text-white">
                            {p.user?.profile?.firstName || '?'} {p.user?.profile?.lastName || ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            typeColorMap[p.type] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {p.type}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            statusColorMap[p.status] || 'bg-gray-100 text-gray-600'
                          }`}>
                            {p.status}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {p.provider}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {p.order?.title ? `${p.order.title}` : ''} · {new Date(p.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-sm dark:text-white">
                          {formatPrice(p.amount, t('common.currency'))}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {paymentsTotalPages > 1 && (
            <Pagination page={paymentsPage} totalPages={paymentsTotalPages} onPageChange={setPaymentsPage} />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: STORES                            */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'stores' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold dark:text-white flex items-center gap-2">
              <Store size={18} className="text-blue-600 dark:text-blue-400" />
              Заявки на партнёрство
            </h2>
            <select
              value={requestsStatus}
              onChange={(e) => setRequestsStatus(e.target.value)}
              className="input text-sm w-40"
            >
              <option value="">Все статусы</option>
              <option value="PENDING">Ожидают</option>
              <option value="APPROVED">Одобрены</option>
              <option value="REJECTED">Отклонены</option>
            </select>
          </div>

          {requestsLoading ? (
            <LoadingSpinner />
          ) : partnerRequests.length === 0 ? (
            <EmptyState icon={Store} title="Нет заявок" description="Пока нет заявок на партнёрство" />
          ) : (
            <div className="space-y-3">
              {partnerRequests.map((req: any) => (
                <div key={req.id} className="card">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold dark:text-white">{req.storeName}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          req.status === 'APPROVED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {req.contactPerson} • {req.phone} • {req.storeCategory}
                      </p>
                      {req.city && <p className="text-xs text-gray-400 dark:text-gray-500">{req.city} {req.address || ''}</p>}
                      {req.message && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">"{req.message}"</p>}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {new Date(req.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {req.status === 'PENDING' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleApproveRequest(req.id)}
                          className="px-4 py-2 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-lg text-sm font-medium hover:bg-green-100 dark:hover:bg-green-900/40 transition"
                        >
                          <CheckCircle size={14} className="inline mr-1" /> Одобрить
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req.id)}
                          className="px-4 py-2 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                        >
                          <Ban size={14} className="inline mr-1" /> Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: TURNKEY                           */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'turnkey' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold dark:text-white flex items-center gap-2">
              <Hammer size={18} className="text-amber-600 dark:text-amber-400" />
              Проекты «Ремонт под ключ»
            </h2>
            <select
              value={turnkeyStatus}
              onChange={(e) => setTurnkeyStatus(e.target.value)}
              className="input text-sm w-44"
            >
              <option value="">Все статусы</option>
              <option value="INQUIRY">Заявка</option>
              <option value="CONSULTATION">Консультация</option>
              <option value="DESIGNING">Проектирование</option>
              <option value="APPROVED">Утверждён</option>
              <option value="IN_PROGRESS">В работе</option>
              <option value="COMPLETED">Завершён</option>
              <option value="CANCELLED">Отменён</option>
            </select>
          </div>

          {turnkeyLoading ? (
            <LoadingSpinner />
          ) : turnkeyProjects.length === 0 ? (
            <EmptyState icon={Hammer} title="Нет проектов" description="Проекты ремонта под ключ не найдены" />
          ) : (
            <div className="space-y-3">
              {turnkeyProjects.map((proj: any) => {
                const completedStages = proj.stages?.filter((s: any) => s.status === 'completed').length || 0;
                const totalStages = proj.stages?.length || 0;
                const progress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

                const statusColors: Record<string, string> = {
                  INQUIRY: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                  CONSULTATION: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
                  DESIGNING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  IN_PROGRESS: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                };

                return (
                  <div key={proj.id} className="card">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold dark:text-white">{proj.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[proj.status] || statusColors.INQUIRY}`}>
                            {proj.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {proj.propertyType}
                          {proj.area ? ` • ${proj.area} м²` : ''}
                          {proj.rooms ? ` • ${proj.rooms} ком.` : ''}
                        </p>
                        {proj.address && <p className="text-xs text-gray-400 dark:text-gray-500">{proj.address}{proj.city ? `, ${proj.city}` : ''}</p>}
                        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {proj.totalPrice && <span>{proj.totalPrice.toLocaleString()} UZS</span>}
                          {proj.designIncluded && <span>Дизайн</span>}
                          {proj.furnitureIncluded && <span>Мебель</span>}
                          <span>{new Date(proj.createdAt).toLocaleDateString()}</span>
                        </div>

                        {/* Mini progress bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{completedStages}/{totalStages}</span>
                        </div>
                      </div>

                      {/* Status quick-actions */}
                      <div className="flex flex-wrap gap-1 flex-shrink-0">
                        {proj.status === 'INQUIRY' && (
                          <button
                            onClick={() => handleUpdateProjectStatus(proj.id, 'CONSULTATION')}
                            className="px-3 py-1.5 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-100 transition"
                          >
                            → Консультация
                          </button>
                        )}
                        {proj.status === 'CONSULTATION' && (
                          <button
                            onClick={() => handleUpdateProjectStatus(proj.id, 'DESIGNING')}
                            className="px-3 py-1.5 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-100 transition"
                          >
                            → Проектирование
                          </button>
                        )}
                        {proj.status === 'DESIGNING' && (
                          <button
                            onClick={() => handleUpdateProjectStatus(proj.id, 'APPROVED')}
                            className="px-3 py-1.5 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-lg text-xs font-medium hover:bg-green-100 transition"
                          >
                            → Утвердить
                          </button>
                        )}
                        {proj.status === 'APPROVED' && (
                          <button
                            onClick={() => handleUpdateProjectStatus(proj.id, 'IN_PROGRESS')}
                            className="px-3 py-1.5 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-100 transition"
                          >
                            → В работу
                          </button>
                        )}
                        {proj.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleUpdateProjectStatus(proj.id, 'COMPLETED')}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-100 transition"
                          >
                            → Завершить
                          </button>
                        )}
                        {!['COMPLETED', 'CANCELLED'].includes(proj.status) && (
                          <button
                            onClick={() => handleUpdateProjectStatus(proj.id, 'CANCELLED')}
                            className="px-3 py-1.5 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 transition"
                          >
                            Отменить
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: CATALOG                           */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold dark:text-white flex items-center gap-2">
              <FolderTree size={18} className="text-primary-600 dark:text-primary-400" />
              Управление каталогом
            </h2>
            <button onClick={() => openAddForm('category')} className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition">
              <Plus size={16} /> Категория
            </button>
          </div>

          {catalogLoading ? (
            <div className="text-center py-8 text-gray-500">Загрузка каталога...</div>
          ) : catalogTree.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Каталог пуст. Добавьте первую категорию.</div>
          ) : (
            <div className="space-y-2">
              {catalogTree.map((cat: any) => (
                <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750" onClick={() => toggleCat(cat.id)}>
                    {expandedCats.has(cat.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    <span className="text-lg mr-1">{cat.icon || 'Folder'}</span>
                    <span className="font-semibold flex-1 dark:text-white">
                      {cat.name}
                      {!cat.isActive && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">скрыта</span>}
                    </span>
                    <span className="text-xs text-gray-400 mr-2">{cat.subcategories?.length || 0} подкат.</span>
                    <button onClick={(e) => { e.stopPropagation(); openEditForm('category', cat); }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Edit3 size={15} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 size={15} /></button>
                  </div>
                  {expandedCats.has(cat.id) && (
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      <div className="px-4 py-2 flex justify-end">
                        <button onClick={() => openAddForm('subcategory', cat.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-100">
                          <Plus size={14} /> Подкатегория
                        </button>
                      </div>
                      {(cat.subcategories || []).map((sub: any) => (
                        <div key={sub.id} className="border-t border-gray-50 dark:border-gray-700/50">
                          <div className="flex items-center gap-2 px-6 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750" onClick={() => toggleSub(sub.id)}>
                            {expandedSubs.has(sub.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <span className="mr-1">{sub.icon || 'FolderOpen'}</span>
                            <span className="font-medium flex-1 text-sm dark:text-gray-200">
                              {sub.name}
                              {!sub.isActive && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">скрыта</span>}
                            </span>
                            <span className="text-xs text-gray-400 mr-2">{sub.tasks?.length || 0} услуг</span>
                            <button onClick={(e) => { e.stopPropagation(); openEditForm('subcategory', sub); }} className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"><Edit3 size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteSubcategory(sub.id); }} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><Trash2 size={14} /></button>
                          </div>
                          {expandedSubs.has(sub.id) && (
                            <div className="bg-gray-50/50 dark:bg-gray-900/30">
                              <div className="px-8 py-1.5 flex justify-end">
                                <button onClick={() => openAddForm('task', sub.id)} className="flex items-center gap-1 px-2.5 py-1 text-xs bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-lg hover:bg-primary-100">
                                  <Plus size={14} /> Услуга
                                </button>
                              </div>
                              {(sub.tasks || []).map((task: any) => (
                                <div key={task.id} className="flex items-center gap-2 px-8 py-2 border-t border-gray-100 dark:border-gray-800 hover:bg-gray-100/50 dark:hover:bg-gray-800/50">
                                  <span className="flex-1 text-sm dark:text-gray-300">
                                    {task.name}
                                    {!task.isActive && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">скрыта</span>}
                                  </span>
                                  <span className="text-sm font-semibold text-primary-600 dark:text-primary-400 min-w-[80px] text-right">
                                    {task.minPrice?.toLocaleString()} сум
                                  </span>
                                  <button onClick={() => openEditForm('task', task)} className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"><Edit3 size={14} /></button>
                                  <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><Trash2 size={14} /></button>
                                </div>
                              ))}
                              {(sub.tasks || []).length === 0 && (
                                <div className="px-8 py-3 text-xs text-gray-400 italic">Нет услуг</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {(cat.subcategories || []).length === 0 && (
                        <div className="px-6 py-3 text-xs text-gray-400 italic">Нет подкатегорий</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Модальная форма добавления/редактирования */}
          {(showAddForm || editingItem) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={cancelForm}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold dark:text-white">
                  {editingItem
                    ? `Редактировать ${editingItem.type === 'category' ? 'категорию' : editingItem.type === 'subcategory' ? 'подкатегорию' : 'услугу'}`
                    : `Добавить ${showAddForm?.type === 'category' ? 'категорию' : showAddForm?.type === 'subcategory' ? 'подкатегорию' : 'услугу'}`}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название (RU) *</label>
                    <input value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500" placeholder="Название" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Название (UZ)</label>
                      <input value={formData.nameUz || ''} onChange={(e) => setFormData({ ...formData, nameUz: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="O'zbekcha" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Название (EN)</label>
                      <input value={formData.nameEn || ''} onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="English" />
                    </div>
                  </div>
                  {((showAddForm?.type || editingItem?.type) !== 'task') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Иконка (Lucide название)</label>
                      <input value={formData.icon || ''} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Wrench" />
                    </div>
                  )}
                  {((showAddForm?.type || editingItem?.type) === 'task') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Цена (сум) *</label>
                        <input type="number" value={formData.minPrice || 0} onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="50000" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
                        <textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="Описание услуги" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Время выполнения</label>
                        <input value={formData.estimatedTime || ''} onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="30-60 мин" />
                      </div>
                    </>
                  )}
                  {editingItem && (
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="isActive" checked={formData.isActive !== false} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4 text-primary-600 rounded" />
                      <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">Активна (видима для пользователей)</label>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={cancelForm} className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm font-medium">
                    Отмена
                  </button>
                  <button onClick={handleSubmitForm} className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium">
                    {editingItem ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: MODERATION                        */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'moderation' && (
        <div className="space-y-4">
          <h2 className="font-semibold dark:text-white flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            Модерация и безопасность
          </h2>

          {/* Sub-tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: 'aiOrders' as const, label: `AI-заказы (${aiModerationOrders.length})`, icon: '' },
              { key: 'estimates' as const, label: `Сметы (${pendingEstimates.length})`, icon: '' },
              { key: 'messages' as const, label: `Сообщения (${flaggedMessages.length})`, icon: '' },
              { key: 'blacklist' as const, label: `Чёрный список (${blacklist.length})`, icon: '' },
              { key: 'chatArchive' as const, label: 'Архив чатов', icon: '' },
            ].map(st => (
              <button
                key={st.key}
                onClick={() => setModerationSubTab(st.key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  moderationSubTab === st.key
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                {st.icon} {st.label}
              </button>
            ))}
          </div>

          {moderationLoading && <LoadingSpinner />}

          {/* AI Orders moderation */}
          {moderationSubTab === 'aiOrders' && !moderationLoading && (
            <div className="space-y-3">
              {aiModerationLoading && <LoadingSpinner />}
              {!aiModerationLoading && aiModerationOrders.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Shield size={40} className="mx-auto mb-2 text-green-400" />
                  <p>Нет AI-заказов на модерации</p>
                </div>
              )}
              {aiModerationOrders.map((order: any) => (
                <div key={order.id} className="card border-2 border-orange-200 dark:border-orange-800 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-sm dark:text-white flex items-center gap-2">
                        <Sparkles size={14} className="text-orange-500" />
                        {order.title || 'AI-заказ'}
                      </p>
                      <p className="text-xs text-gray-500">
                        #{order.id?.slice(0, 8)} · {order.client?.profile?.firstName || 'Клиент'} · {new Date(order.createdAt).toLocaleDateString('ru')}
                      </p>
                    </div>
                    <span className="badge bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 flex items-center gap-1">
                      <Clock size={12} /> На модерации
                    </span>
                  </div>

                  {/* Photos */}
                  {order.images && order.images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {(order.images as string[]).slice(0, 5).map((img: string, i: number) => (
                        <div key={i} className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                          <img src={img} alt={`Фото ${i + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placeholder.co/80x80?text=img'; }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><FileText size={12} /> Описание</p>
                    <p className="text-sm dark:text-gray-300">{order.description}</p>
                  </div>

                  {/* Additional wishes */}
                  {order.additionalWishes && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">Дополнительные пожелания клиента:</p>
                      <p className="text-sm text-amber-800 dark:text-amber-200">{order.additionalWishes}</p>
                    </div>
                  )}

                  {/* Tasks + AI variant info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                      <span className="text-gray-400">Категория</span>
                      <p className="font-bold dark:text-white truncate">{order.category?.name || '—'}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                      <span className="text-gray-400">Работ</span>
                      <p className="font-bold dark:text-white">{order.orderTasks?.length || 0}</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
                      <span className="text-gray-400">AI-вариант</span>
                      <p className="font-bold dark:text-white">{order.aiTemplate?.tier || '—'}</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
                      <span className="text-gray-400">Цена</span>
                      <p className="font-bold text-primary-600 dark:text-primary-400">{(order.price || 0).toLocaleString('ru')} сум</p>
                    </div>
                  </div>

                  {/* Task list */}
                  {order.orderTasks && order.orderTasks.length > 0 && (
                    <div className="text-xs">
                      <p className="text-gray-400 mb-1">Задачи:</p>
                      <div className="flex flex-wrap gap-1">
                        {order.orderTasks.map((ot: any) => (
                          <span key={ot.id} className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                            {ot.task?.name || ot.taskId?.slice(0, 8)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {order.isUrgent && (
                    <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1">
                      <Zap size={12} /> Срочный заказ (множитель: x{order.urgentMultiplier?.toFixed(1) || '1.4'})
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-2 border-t dark:border-gray-700">
                    {/* Price edit row */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 shrink-0">Цена:</span>
                      <input
                        type="number"
                        defaultValue={order.price || 0}
                        className="flex-1 px-2 py-1 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        id={`price-edit-${order.id}`}
                      />
                      <span className="text-xs text-gray-400">сум</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          handleModerateAiOrder(order.id, true, undefined);
                        }}
                        className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition"
                      >
                        <CheckCircle size={16} /> Одобрить
                      </button>
                      <button
                        onClick={() => {
                          const note = prompt('Что нужно исправить?', 'Уточните описание или добавьте фото');
                          if (note !== null) handleModerateAiOrder(order.id, false, 'На доработку: ' + (note || 'Требуется уточнение'));
                        }}
                        className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition"
                      >
                        <RefreshCw size={16} /> На доработку
                      </button>
                      <button
                        onClick={() => {
                          const note = prompt('Причина отклонения:', 'Не соответствует требованиям');
                          if (note !== null) handleModerateAiOrder(order.id, false, note || 'Отклонено модератором');
                        }}
                        className="py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending estimates */}
          {moderationSubTab === 'estimates' && !moderationLoading && (
            <div className="space-y-3">
              {pendingEstimates.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Shield size={40} className="mx-auto mb-2 text-green-400" />
                  <p>Нет смет на модерации</p>
                </div>
              )}
              {pendingEstimates.map((est: any) => (
                <div key={est.id} className="card border-2 border-violet-200 dark:border-violet-800">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-sm">Смета #{est.id?.slice(0, 8)}</p>
                      <p className="text-xs text-gray-500">
                        Заказ: {est.order?.title || est.orderId?.slice(0, 8)}
                      </p>
                    </div>
                    <span className="badge bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                      На модерации
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div>
                      <span className="text-gray-400">Работы:</span>
                      <p className="font-bold">{(est.workTotal || 0).toLocaleString('ru')} сум</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Материалы:</span>
                      <p className="font-bold">{(est.materialTotal || 0).toLocaleString('ru')} сум</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Итого:</span>
                      <p className="font-bold text-primary-600">{(est.totalAmount || 0).toLocaleString('ru')} сум</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleModerateEstimate(est.id, true)}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
                    >
                      <CheckCircle size={14} /> Одобрить
                    </button>
                    <button
                      onClick={() => handleModerateEstimate(est.id, false, 'Отклонено модератором')}
                      className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
                    >
                      <XCircle size={14} /> Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Flagged messages */}
          {moderationSubTab === 'messages' && !moderationLoading && (
            <div className="space-y-2">
              {flaggedMessages.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <CheckCircle size={40} className="mx-auto mb-2 text-green-400" />
                  <p>Нет подозрительных сообщений</p>
                </div>
              )}
              {flaggedMessages.map((msg: any) => (
                <div key={msg.id} className="card border border-orange-200 dark:border-orange-800">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="text-xs text-gray-400">
                        {msg.sender?.firstName || 'Пользователь'} · Заказ {msg.orderId?.slice(0, 8)}
                      </p>
                      <p className="text-xs text-orange-500 font-semibold">{msg.flagReason || 'Подозрительное'}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.createdAt).toLocaleString('ru')}
                    </span>
                  </div>
                  <p className="text-sm bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg my-2">{msg.text}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBlockMessage(msg.id)}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <Ban size={12} /> Заблокировать
                    </button>
                    <button
                      onClick={() => handleUnflagMessage(msg.id)}
                      className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <CheckCircle size={12} /> Снять флаг
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Blacklist */}
          {moderationSubTab === 'blacklist' && !moderationLoading && (
            <div className="space-y-2">
              {blacklist.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Users size={40} className="mx-auto mb-2" />
                  <p>Чёрный список пуст</p>
                </div>
              )}
              {blacklist.map((entry: any) => (
                <div key={entry.id} className="card border border-red-200 dark:border-red-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">
                        {entry.user?.profile?.firstName || 'ID: ' + entry.userId?.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-400">{entry.reason}</p>
                      {entry.violationType && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs">
                          {entry.violationType}
                        </span>
                      )}
                      {entry.penaltyAmount > 0 && (
                        <p className="text-xs text-red-500 mt-1">Штраф: {entry.penaltyAmount?.toLocaleString('ru')} сум</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveFromBlacklist(entry.id)}
                      className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-xs font-semibold"
                    >
                      Разблокировать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chat Archive */}
          {moderationSubTab === 'chatArchive' && (
            <div className="space-y-3">
              {/* Search */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск по названию или ID заказа..."
                    value={chatArchiveSearch}
                    onChange={(e) => { setChatArchiveSearch(e.target.value); setChatArchivePage(1); }}
                    className="input pl-9 text-sm"
                  />
                </div>
                <button
                  onClick={loadChatArchive}
                  className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              {chatArchiveLoading && <LoadingSpinner />}

              {/* Viewing a specific chat */}
              {chatArchiveViewOrderId && (
                <div className="card border-2 border-blue-300 dark:border-blue-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm dark:text-white flex items-center gap-2">
                      <MessageCircle size={16} className="text-blue-500" />
                      Переписка по заказу #{chatArchiveViewOrderId.slice(0, 8)}
                    </h3>
                    <button
                      onClick={() => { setChatArchiveViewOrderId(null); setChatArchiveMessages([]); }}
                      className="text-xs px-3 py-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
                    >
                      ← Назад к списку
                    </button>
                  </div>
                  {chatArchiveMsgLoading && <LoadingSpinner />}
                  {!chatArchiveMsgLoading && chatArchiveMessages.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-4">Нет сообщений</p>
                  )}
                  <div className="max-h-[500px] overflow-y-auto space-y-2">
                    {chatArchiveMessages.map((msg: any) => (
                      <div key={msg.id} className={`p-2.5 rounded-xl text-sm ${msg.isBlocked ? 'bg-red-50 dark:bg-red-900/20' : msg.isFlagged ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-gray-700 dark:text-gray-300">
                            {msg.sender?.firstName || 'Пользователь'}
                            {msg.isSystem && <span className="ml-1 text-blue-500">(система)</span>}
                          </span>
                          <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleString('ru')}</span>
                        </div>
                        <p className="text-gray-800 dark:text-gray-200">{msg.text}</p>
                        {msg.imageUrl && (
                          <img src={msg.imageUrl} alt="Фото" className="mt-1 max-h-32 rounded-lg" />
                        )}
                        {msg.isFlagged && (
                          <p className="text-xs text-orange-500 mt-1">{msg.flagReason}</p>
                        )}
                        {msg.isBlocked && (
                          <p className="text-xs text-red-500 mt-1">Заблокировано</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Archive list */}
              {!chatArchiveViewOrderId && !chatArchiveLoading && (
                <>
                  {chatArchive.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <MessageCircle size={40} className="mx-auto mb-2" />
                      <p>Нет чатов</p>
                    </div>
                  )}
                  {chatArchive.map((item: any) => (
                    <div key={item.orderId} className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => loadChatArchiveMessages(item.orderId)}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm dark:text-white truncate">{item.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">#{item.orderId.slice(0, 8)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                            {item.messageCount}
                          </span>
                          <StatusBadge status={item.status} />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>{item.client?.name || '—'}</span>
                        <span>{item.master?.name || '—'}</span>
                      </div>
                      {item.lastMessage && (
                        <p className="text-xs text-gray-400 mt-2 truncate">
                          Последнее: {item.lastMessage.senderName}: {item.lastMessage.text}
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Pagination */}
                  {chatArchiveTotal > 20 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button
                        disabled={chatArchivePage <= 1}
                        onClick={() => setChatArchivePage(p => Math.max(1, p - 1))}
                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm text-gray-500">
                        {chatArchivePage} / {Math.ceil(chatArchiveTotal / 20)}
                      </span>
                      <button
                        disabled={chatArchivePage >= Math.ceil(chatArchiveTotal / 20)}
                        onClick={() => setChatArchivePage(p => p + 1)}
                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: SUPPORT CHAT                      */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'support' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold dark:text-white flex items-center gap-2">
              <Headphones size={18} className="text-orange-500" />
              Чат поддержки
            </h2>
            <button
              onClick={loadSupportChats}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Create new chat — user search */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Создать чат с пользователем</h3>

            {/* Search input */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по имени или Telegram ID..."
                  value={supportUserSearch}
                  onChange={(e) => setSupportUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSupportUsers()}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <button
                onClick={handleSearchSupportUsers}
                disabled={supportUserSearching || !supportUserSearch.trim()}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                {supportUserSearching ? '...' : 'Найти'}
              </button>
            </div>

            {/* Search results */}
            {supportUserResults.length > 0 && (
              <div className="mb-3 max-h-40 overflow-y-auto border rounded-lg dark:border-gray-600 divide-y dark:divide-gray-600">
                {supportUserResults.map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => { setSupportNewUserId(u.id); setSupportUserSearch(u.firstName + ' ' + (u.lastName || '')); setSupportUserResults([]); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 dark:hover:bg-gray-700 flex items-center gap-2 ${supportNewUserId === u.id ? 'bg-orange-50 dark:bg-gray-700' : ''}`}
                  >
                    <div className="w-7 h-7 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-xs font-bold text-orange-600">
                      {(u.firstName || '?')[0]}
                    </div>
                    <div>
                      <span className="font-medium text-gray-800 dark:text-white">{u.firstName} {u.lastName || ''}</span>
                      <span className="text-gray-400 ml-2 text-xs">@{u.telegramUsername || u.telegramId}</span>
                    </div>
                    <span className="ml-auto text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded text-gray-500 dark:text-gray-300">{u.role}</span>
                  </button>
                ))}
              </div>
            )}

            {supportNewUserId && (
              <div className="mb-3 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <CheckCircle size={14} /> Пользователь выбран
              </div>
            )}

            {/* Subject dropdown + create button */}
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={supportNewSubject}
                onChange={(e) => setSupportNewSubject(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Тема (необязательно)</option>
                <option value="Проблема с заказом">Проблема с заказом</option>
                <option value="Вопрос по оплате">Вопрос по оплате</option>
                <option value="Жалоба на мастера">Жалоба на мастера</option>
                <option value="Технический вопрос">Технический вопрос</option>
                <option value="Предложение">Предложение</option>
                <option value="Другое">Другое</option>
              </select>
              <button
                onClick={handleCreateSupportChat}
                disabled={!supportNewUserId}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1"
              >
                <Plus size={16} /> Начать чат
              </button>
            </div>
          </div>

          {supportLoading ? (
            <LoadingSpinner />
          ) : supportSelectedChat ? (
            /* Chat messages view */
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center gap-3 p-4 border-b dark:border-gray-700">
                <button
                  onClick={() => { setSupportSelectedChat(null); setSupportMessages([]); }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm dark:text-white">{supportSelectedChat.subject}</h3>
                  <p className="text-xs text-gray-500">
                    Пользователь: {supportSelectedChat.user?.profile?.firstName || supportSelectedChat.userId}
                  </p>
                </div>
                {!supportSelectedChat.isClosed && (
                  <button
                    onClick={() => handleCloseSupportChat(supportSelectedChat.id)}
                    className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-semibold"
                  >
                    Закрыть чат
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="max-h-96 overflow-y-auto p-4 space-y-2 bg-gray-50 dark:bg-gray-900">
                {supportMessages.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">Нет сообщений</p>
                )}
                {supportMessages.map((msg: any) => {
                  const isAdmin = msg.senderId !== supportSelectedChat.userId;
                  return (
                    <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                        isAdmin
                          ? 'bg-orange-500 text-white rounded-br-md'
                          : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border rounded-bl-md'
                      }`}>
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        <p className={`text-[10px] mt-1 ${isAdmin ? 'text-orange-200' : 'text-gray-400'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              {!supportSelectedChat.isClosed && (
                <div className="p-3 border-t dark:border-gray-700">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={supportNewMsg}
                      onChange={(e) => setSupportNewMsg(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendSupportMessage(); }}
                      placeholder="Введите сообщение..."
                      className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:text-white"
                      disabled={supportSending}
                    />
                    <button
                      onClick={handleSendSupportMessage}
                      disabled={!supportNewMsg.trim() || supportSending}
                      className="p-2.5 bg-orange-500 text-white rounded-full hover:bg-orange-600 disabled:opacity-50"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Chats list */
            <div className="space-y-2">
              {supportChats.length === 0 ? (
                <EmptyState icon={MessageCircle} title="Нет чатов поддержки" description="Создайте чат, чтобы связаться с пользователем" />
              ) : supportChats.map((chat: any) => {
                const lastMsg = chat.messages?.[0];
                return (
                  <button
                    key={chat.id}
                    onClick={() => { setSupportSelectedChat(chat); loadSupportMessages(chat.id); }}
                    className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-orange-200 hover:shadow-md transition text-left"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      chat.isClosed ? 'bg-gray-100 dark:bg-gray-700' : 'bg-orange-100 dark:bg-orange-900/30'
                    }`}>
                      <MessageCircle size={18} className={chat.isClosed ? 'text-gray-400' : 'text-orange-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm dark:text-white truncate">{chat.subject}</span>
                        <span className="text-xs text-gray-400 ml-2">
                          {new Date(chat.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {chat.user?.profile?.firstName || 'Пользователь'} — {lastMsg?.text?.slice(0, 60) || (chat.isClosed ? 'Закрыт' : 'Нет сообщений')}
                      </p>
                    </div>
                    {chat.isClosed && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-1 rounded-full">Закрыт</span>
                    )}
                    {chat._count?.messages > 0 && !chat.isClosed && (
                      <span className="text-xs font-bold bg-orange-500 text-white w-5 h-5 rounded-full flex items-center justify-center">
                        {chat._count.messages}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: SCHOOL                            */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'school' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold dark:text-white flex items-center gap-2">
              <GraduationCap size={20} />
              Управление Школой мастеров
            </h2>
            <button
              onClick={() => { setSchoolShowAdd(true); setSchoolEditCourse(null); setSchoolForm({}); }}
              className="btn-primary text-sm"
            >
              <Plus size={16} className="mr-1" /> Добавить курс
            </button>
          </div>

          {/* Add / Edit course form */}
          {(schoolShowAdd || schoolEditCourse) && (
            <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-4">
              <h3 className="font-semibold mb-3 dark:text-white">
                {schoolEditCourse ? 'Редактировать курс' : 'Новый курс'}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Название (RU) *</label>
                  <input
                    value={schoolForm.title || ''}
                    onChange={(e) => setSchoolForm((p: any) => ({ ...p, title: e.target.value }))}
                    className="input-field w-full"
                    placeholder="Основы безопасности"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Название (UZ)</label>
                  <input
                    value={schoolForm.titleUz || ''}
                    onChange={(e) => setSchoolForm((p: any) => ({ ...p, titleUz: e.target.value }))}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Описание</label>
                  <textarea
                    value={schoolForm.description || ''}
                    onChange={(e) => setSchoolForm((p: any) => ({ ...p, description: e.target.value }))}
                    className="input-field w-full"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Содержание (текст урока)</label>
                  <textarea
                    value={schoolForm.content || ''}
                    onChange={(e) => setSchoolForm((p: any) => ({ ...p, content: e.target.value }))}
                    className="input-field w-full"
                    rows={4}
                    placeholder="Подробное содержание урока..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Ссылка на видео</label>
                    <input
                      value={schoolForm.videoUrl || ''}
                      onChange={(e) => setSchoolForm((p: any) => ({ ...p, videoUrl: e.target.value }))}
                      className="input-field w-full"
                      placeholder="https://youtube.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Длительность (мин)</label>
                    <input
                      type="number"
                      value={schoolForm.durationMinutes || ''}
                      onChange={(e) => setSchoolForm((p: any) => ({ ...p, durationMinutes: parseInt(e.target.value) || undefined }))}
                      className="input-field w-full"
                      placeholder="30"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Проходной балл %</label>
                    <input
                      type="number"
                      value={schoolForm.passingScore ?? 70}
                      onChange={(e) => setSchoolForm((p: any) => ({ ...p, passingScore: parseInt(e.target.value) || 70 }))}
                      className="input-field w-full"
                      min={1}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Порядок</label>
                    <input
                      type="number"
                      value={schoolForm.sortOrder ?? 0}
                      onChange={(e) => setSchoolForm((p: any) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                      className="input-field w-full"
                    />
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-sm dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={schoolForm.isRequired || false}
                        onChange={(e) => setSchoolForm((p: any) => ({ ...p, isRequired: e.target.checked }))}
                      />
                      Обязательный
                    </label>
                    <label className="flex items-center gap-2 text-sm dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={schoolForm.isActive !== false}
                        onChange={(e) => setSchoolForm((p: any) => ({ ...p, isActive: e.target.checked }))}
                      />
                      Активный
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleSchoolSaveCourse} className="btn-primary text-sm">
                    <Save size={16} className="mr-1" /> Сохранить
                  </button>
                  <button onClick={() => { setSchoolShowAdd(false); setSchoolEditCourse(null); setSchoolForm({}); }} className="btn-secondary text-sm">
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Courses list */}
          {schoolLoading ? (
            <LoadingSpinner />
          ) : schoolCourses.length === 0 ? (
            <div className="card dark:bg-gray-800 dark:ring-gray-700 text-center py-8">
              <BookOpen size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">Курсов пока нет. Добавьте первый курс.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schoolCourses.map((course: any) => (
                <div key={course.id} className="card dark:bg-gray-800 dark:ring-gray-700">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold dark:text-white">{course.title}</h3>
                      {course.titleUz && <p className="text-sm text-gray-500">{course.titleUz}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {course.isRequired && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Обяз.</span>
                      )}
                      {!course.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700">Скрыт</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <span>{course.durationMinutes || '—'} мин</span>
                    <span>Вопросов: {course._count?.questions || 0}</span>
                    <span>Прошли: {course._count?.progress || 0}</span>
                    <span>Порог: {course.passingScore || 70}%</span>
                    {course.videoUrl && <span>Видео</span>}
                    {course.category && <span>{course.category.name}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSchoolEditCourse(course);
                        setSchoolShowAdd(false);
                        setSchoolForm({
                          title: course.title,
                          titleUz: course.titleUz || '',
                          description: course.description || '',
                          descriptionUz: course.descriptionUz || '',
                          content: course.content || '',
                          videoUrl: course.videoUrl || '',
                          durationMinutes: course.durationMinutes || '',
                          passingScore: course.passingScore || 70,
                          sortOrder: course.sortOrder || 0,
                          isRequired: course.isRequired,
                          isActive: course.isActive,
                          categoryId: course.categoryId || '',
                        });
                      }}
                      className="text-xs px-3 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200"
                    >
                      <Edit3 size={12} className="inline mr-1" /> Редактировать
                    </button>
                    <button
                      onClick={() => loadSchoolQuestions(course.id)}
                      className="text-xs px-3 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200"
                    >
                      <HelpCircle size={12} className="inline mr-1" /> Вопросы ({course._count?.questions || 0})
                    </button>
                    <button
                      onClick={() => handleSchoolDeleteCourse(course.id)}
                      className="text-xs px-3 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200"
                    >
                      <Trash2 size={12} className="inline mr-1" /> Удалить
                    </button>
                  </div>

                  {/* Questions panel for this course */}
                  {schoolQuestionsFor === course.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium dark:text-white text-sm">Вопросы теста</h4>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setSchoolShowAddQ(true); setSchoolQForm({ options: ['', '', '', ''], correctIndex: 0 }); }}
                            className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          >
                            <Plus size={12} className="inline mr-1" /> Добавить вопрос
                          </button>
                          <button
                            onClick={() => setSchoolQuestionsFor(null)}
                            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                          >
                            Свернуть
                          </button>
                        </div>
                      </div>

                      {/* Add question form */}
                      {schoolShowAddQ && (
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-3 space-y-2">
                          <input
                            value={schoolQForm.question || ''}
                            onChange={(e) => setSchoolQForm((p: any) => ({ ...p, question: e.target.value }))}
                            className="input-field w-full text-sm"
                            placeholder="Текст вопроса (RU)"
                          />
                          <input
                            value={schoolQForm.questionUz || ''}
                            onChange={(e) => setSchoolQForm((p: any) => ({ ...p, questionUz: e.target.value }))}
                            className="input-field w-full text-sm"
                            placeholder="Текст вопроса (UZ) — необязательно"
                          />
                          <p className="text-xs text-gray-500 mt-1">Варианты ответов (выберите правильный):</p>
                          {(schoolQForm.options || ['', '', '', '']).map((opt: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="correctAnswer"
                                checked={schoolQForm.correctIndex === idx}
                                onChange={() => setSchoolQForm((p: any) => ({ ...p, correctIndex: idx }))}
                                className="accent-green-600"
                              />
                              <input
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...(schoolQForm.options || ['', '', '', ''])];
                                  newOpts[idx] = e.target.value;
                                  setSchoolQForm((p: any) => ({ ...p, options: newOpts }));
                                }}
                                className="input-field flex-1 text-sm"
                                placeholder={`Вариант ${String.fromCharCode(65 + idx)}`}
                              />
                            </div>
                          ))}
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleSchoolSaveQuestion(course.id)}
                              className="text-xs px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700"
                            >
                              Сохранить вопрос
                            </button>
                            <button
                              onClick={() => {
                                const newOpts = [...(schoolQForm.options || ['', '', '', '']), ''];
                                setSchoolQForm((p: any) => ({ ...p, options: newOpts }));
                              }}
                              className="text-xs px-3 py-1.5 rounded bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            >
                              + Вариант
                            </button>
                            <button
                              onClick={() => setSchoolShowAddQ(false)}
                              className="text-xs px-3 py-1.5 rounded bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      )}

                      {schoolQLoading ? (
                        <p className="text-sm text-gray-500">Загрузка...</p>
                      ) : schoolQuestions.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Нет вопросов. Добавьте первый вопрос для теста.</p>
                      ) : (
                        <div className="space-y-2">
                          {schoolQuestions.map((q: any, qIdx: number) => (
                            <div key={q.id} className="bg-gray-50 dark:bg-gray-900 rounded p-2.5">
                              <div className="flex items-start justify-between">
                                <p className="text-sm dark:text-gray-200">
                                  <span className="font-bold text-primary-600">{qIdx + 1}.</span> {q.question}
                                </p>
                                <button
                                  onClick={() => handleSchoolDeleteQuestion(q.id)}
                                  className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <div className="mt-1.5 ml-4 grid grid-cols-2 gap-1">
                                {(q.options as string[]).map((opt: string, optIdx: number) => (
                                  <span
                                    key={optIdx}
                                    className={`text-xs px-2 py-0.5 rounded ${
                                      optIdx === q.correctIndex
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-semibold'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                    }`}
                                  >
                                    {String.fromCharCode(65 + optIdx)}) {opt}
                                    {optIdx === q.correctIndex && ' (OK)'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: CONFIG                            */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'config' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold dark:text-white flex items-center gap-2">
              <Database size={18} className="text-primary-600 dark:text-primary-400" />
              {t('admin.platformConfig')}
            </h2>
            <button
              onClick={loadConfig}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {configLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              {/* Основные настройки — красивые карточки */}
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { key: 'commission_rate', label: 'Комиссия платформы (%)', icon: CreditCard, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400', desc: 'Базовая ставка комиссии за обычные заказы', suffix: '%' },
                  { key: 'first_order_commission_rate', label: 'Комиссия первого заказа пары (%)', icon: Shield, color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400', desc: 'Повышенная ставка для первого заказа клиент↔мастер (защита от увода)', suffix: '%' },
                  { key: 'repeat_order_commission_rate', label: 'Комиссия повторного заказа пары (%)', icon: Shield, color: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400', desc: 'Льготная ставка для повторных заказов через платформу', suffix: '%' },
                  { key: 'bypass_penalty_multiplier', label: 'Множитель штрафа за обход (×)', icon: AlertTriangle, color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400', desc: 'Штраф = стоимость заказа × коэффициент. По оферте — до 5×', suffix: '×' },
                  { key: 'virtual_numbers_enabled', label: 'Виртуальные номера', icon: Phone, color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400', desc: 'true/false — маскировать реальные телефоны прокси-номерами', suffix: '' },
                  { key: 'material_commission_rate', label: 'Комиссия за материалы (%)', icon: Package, color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400', desc: 'Процент комиссии за стройматериалы', suffix: '%' },
                  { key: 'urgency_multiplier', label: 'Надбавка за срочность (%)', icon: Zap, color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400', desc: 'Процент надбавки к цене за срочные заказы', suffix: '%' },
                  { key: 'min_order_amount', label: 'Минимальная сумма заказа', icon: DollarSign, color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400', desc: 'Минимальная цена заказа (сум)', suffix: ' сум' },
                  { key: 'visit_fee', label: 'Стоимость выезда на оценку', icon: Activity, color: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400', desc: 'Фиксированная стоимость выезда мастера', suffix: ' сум' },
                  { key: 'visit_fee_commission_rate', label: 'Комиссия с выезда (%)', icon: CreditCard, color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400', desc: 'Процент комиссии с оплаты выезда', suffix: '%' },
                  { key: 'default_guarantee_days', label: 'Гарантийный срок (дни)', icon: Shield, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400', desc: 'Гарантия по умолчанию на все работы', suffix: ' дн.' },
                  { key: 'material_cancel_compensation', label: 'Компенсация мастеру при отказе (%)', icon: AlertTriangle, color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400', desc: 'Процент компенсации после закупки материала', suffix: '%' },
                  { key: 'max_response_time', label: 'Макс. время отклика мастера (ч)', icon: Clock, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400', desc: 'Максимальное время на отклик мастера', suffix: ' ч' },
                ].map(({ key, label, icon: Icon, color, desc, suffix }) => {
                  const configItem = config.find((c: any) => c.key === key);
                  const value = configItem?.value || '';
                  const isEditing = editingConfig === key;

                  return (
                    <div key={key} className="card border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm dark:text-white">{label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                          <div className="mt-2">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  className="input text-sm w-32 px-3 py-1.5"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleSaveConfig(key)}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveConfig(key)}
                                  className="p-1.5 rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100"
                                >
                                  <Save size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingConfig(null)}
                                  className="p-1.5 rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200"
                                >
                                  <XCircle size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-lg font-bold text-primary-600 dark:text-primary-400">
                                  {value || '—'}{value && suffix}
                                </span>
                                {user?.role === 'ADMIN' && (
                                  <button
                                    onClick={() => { setEditingConfig(key); setEditValue(value); }}
                                    className="p-1.5 rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Остальные настройки — таблица */}
              {config.filter((c: any) => ![
                'commission_rate', 'material_commission_rate', 'urgency_multiplier',
                'min_order_amount', 'visit_fee', 'visit_fee_commission_rate',
                'default_guarantee_days', 'material_cancel_compensation', 'max_response_time'
              ].includes(c.key)).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Прочие настройки</h3>
                  {config.filter((c: any) => ![
                    'commission_rate', 'material_commission_rate', 'urgency_multiplier',
                    'min_order_amount', 'visit_fee', 'visit_fee_commission_rate',
                    'default_guarantee_days', 'material_cancel_compensation', 'max_response_time'
                  ].includes(c.key)).map((c: any) => (
                    <div key={c.id} className="card">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm font-medium dark:text-white truncate">{c.key}</p>
                          {c.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {editingConfig === c.key ? (
                            <>
                              <input
                                type="text"
                                className="input text-sm w-32"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveConfig(c.key)}
                              />
                              <button onClick={() => handleSaveConfig(c.key)} className="p-2 rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50">
                                <Save size={14} />
                              </button>
                              <button onClick={() => setEditingConfig(null)} className="p-2 rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600">
                                <XCircle size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="font-mono text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded">
                                {c.value}
                              </span>
                              {user?.role === 'ADMIN' && (
                                <button
                                  onClick={() => { setEditingConfig(c.key); setEditValue(c.value); }}
                                  className="p-2 rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                  <Settings size={14} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: SECURITY — fraud-сигналы          */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'security' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold dark:text-white flex items-center gap-2">
              <Shield size={18} className="text-red-500" />
              Сигналы попыток обхода платформы
            </h2>
            <button
              onClick={loadFraudSignals}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
            Здесь фиксируются автоматические сигналы: попытки передать контакты в чате,
            частые отмены после назначения мастера, повторные пары с цепочкой отмен.
            Решение о санкциях принимает админ — по оферте штраф = стоимость заказа × <b>bypass_penalty_multiplier</b>.
          </div>

          {fraudLoading ? (
            <LoadingSpinner />
          ) : fraudSignals.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="Подозрительной активности нет"
              description="Когда система обнаружит попытку обхода — увидите её здесь."
            />
          ) : (
            <div className="space-y-3">
              {fraudSignals.map((s) => {
                const details = s.details || {};
                const actor = s.actor;
                const name = actor?.profile
                  ? `${actor.profile.firstName || ''} ${actor.profile.lastName || ''}`.trim() || actor.phone
                  : actor?.phone || s.actorId;
                return (
                  <div
                    key={s.id}
                    className="card border border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/10"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm dark:text-white">{name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                            {actor?.role || '—'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(s.createdAt).toLocaleString('ru')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                          <b>Сигнал:</b> {details.signal || '—'}
                        </p>
                        {details.matchedPattern && (
                          <p className="text-xs text-gray-500 mt-1 font-mono break-all">
                            Паттерн: {details.matchedPattern}
                          </p>
                        )}
                        {details.orderId && (
                          <p className="text-xs text-gray-500 mt-1">
                            Заказ:{' '}
                            <button
                              onClick={() => navigate(`/orders/${details.orderId}`)}
                              className="text-primary-600 hover:underline"
                            >
                              {details.orderId.slice(0, 8)}…
                            </button>
                          </p>
                        )}
                      </div>
                      {user?.role === 'ADMIN' && (
                        <button
                          onClick={() => navigate(`/admin/users/${s.actorId}`)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
                        >
                          Профиль
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* MODAL: Balance Management               */}
      {/* ═══════════════════════════════════════ */}
      {balanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setBalanceModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-bold dark:text-white">Управление балансом</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{balanceModal.userName}</p>
              </div>
              <button onClick={() => setBalanceModal(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <XCircle size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Current balance */}
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Текущий баланс</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {balanceCurrentUser.toLocaleString('ru')} сум
              </p>
            </div>

            {/* Action form */}
            <div className="p-4 space-y-3">
              {/* Action toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setBalanceAction('topup')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    balanceAction === 'topup'
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  + Зачислить
                </button>
                <button
                  onClick={() => setBalanceAction('withdraw')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    balanceAction === 'withdraw'
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  - Списать
                </button>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Сумма (сум)</label>
                <input
                  type="number"
                  className="input text-lg font-bold"
                  placeholder="100000"
                  value={balanceAmount}
                  onChange={e => setBalanceAmount(e.target.value)}
                  min="1"
                />
                {/* Quick amounts */}
                <div className="flex gap-1.5 mt-2">
                  {[50000, 100000, 500000, 1000000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setBalanceAmount(String(amt))}
                      className="text-[10px] px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      {(amt / 1000)}K
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Причина (необязательно)</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="Например: Тестовое пополнение"
                  value={balanceReason}
                  onChange={e => setBalanceReason(e.target.value)}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleBalanceOperation}
                disabled={balanceLoading || !balanceAmount || Number(balanceAmount) <= 0}
                className={`w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 ${
                  balanceAction === 'topup'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                    : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                }`}
              >
                {balanceLoading ? 'Обработка...' : balanceAction === 'topup'
                  ? `Зачислить ${Number(balanceAmount || 0).toLocaleString('ru')} сум`
                  : `Списать ${Number(balanceAmount || 0).toLocaleString('ru')} сум`
                }
              </button>
            </div>

            {/* Transaction history */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                История транзакций
              </h3>
              {balanceTxLoading ? (
                <div className="text-center py-4 text-gray-400 text-sm">Загрузка...</div>
              ) : balanceTransactions.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">Нет транзакций</div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {balanceTransactions.map((tx: any) => {
                    const isPositive = Number(tx.amount) > 0;
                    const typeLabels: Record<string, string> = {
                      TOPUP: 'Пополнение',
                      ADMIN_TOPUP: 'Адм. зачисление',
                      ADMIN_WITHDRAW: 'Адм. списание',
                      ESCROW_HOLD: 'Эскроу (блокировка)',
                      ESCROW_RELEASE: 'Эскроу (разблокировка)',
                      PENALTY: 'Штраф',
                      REFUND: 'Возврат',
                      COMMISSION: 'Комиссия',
                      PAYOUT: 'Выплата',
                      ESTIMATION_FEE: 'Оплата выезда',
                      ESTIMATE_PAYOUT: 'Выплата за оценку',
                    };
                    return (
                      <div key={tx.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium dark:text-white truncate">
                            {typeLabels[tx.type] || tx.type}
                          </p>
                          {tx.description && (
                            <p className="text-[10px] text-gray-400 truncate">{tx.description}</p>
                          )}
                          <p className="text-[10px] text-gray-400">
                            {new Date(tx.createdAt).toLocaleString('ru')}
                          </p>
                        </div>
                        <div className={`text-sm font-bold ml-2 whitespace-nowrap ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isPositive ? '+' : ''}{Number(tx.amount).toLocaleString('ru')} сум
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* MODAL: Notification Diagnostics        */}
      {/* ═══════════════════════════════════════ */}
      {notifyOrder && (
        <NotificationDiagModal
          order={notifyOrder}
          loading={notifyLoading}
          debug={notifyDebug}
          log={notifyLog}
          onClose={() => { setNotifyOrder(null); setNotifyDebug(null); setNotifyLog(null); }}
          onRefresh={() => openNotifyDiag(notifyOrder)}
        />
      )}
    </div>
  );
}

// ─── Pagination Component ───────────────────
function Pagination({ page, totalPages, onPageChange }: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
      >
        <ChevronLeft size={20} className="dark:text-gray-400" />
      </button>
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
      >
        <ChevronRight size={20} className="dark:text-gray-400" />
      </button>
    </div>
  );
}

// ─── Notification Diagnostics Modal ─────────
const REASON_LABELS: Record<string, string> = {
  no_master_profile: 'Нет профиля мастера',
  not_available: 'Мастер выключил приём заказов',
  category_not_linked: 'Категория не привязана',
  no_telegram_id: 'Не привязал Telegram (не нажимал /start у бота)',
  bot_blocked: 'Заблокировал бота',
  never_started_bot: 'Не открывал бота (нужно /start)',
  chat_not_found: 'Чат не найден',
  city_mismatch: 'Город не совпал',
  out_of_range: 'Дальше maxDistanceKm',
};

const reasonLabel = (r?: string | null) => (r && REASON_LABELS[r]) || r || '—';

function NotificationDiagModal({
  order, loading, debug, log, onClose, onRefresh,
}: {
  order: { id: string; title: string };
  loading: boolean;
  debug: any | null;
  log: any | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const summary = log?.summary;
  const logs: any[] = log?.logs || [];
  const masters: any[] = debug?.masters || [];
  const eligible = masters.filter((m) => m.eligible);
  const blocked = masters.filter((m) => !m.eligible);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 min-w-0">
            <Bell size={18} className="text-amber-500 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-sm dark:text-white truncate">Диагностика уведомлений</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{order.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              title="Обновить"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            >
              <XCircle size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-5">
          {loading && <LoadingSpinner />}

          {!loading && debug && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="card !p-3">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Активных мастеров</p>
                  <p className="text-lg font-bold dark:text-white">{debug.totalActiveMasters}</p>
                </div>
                <div className="card !p-3">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Подходят</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{debug.eligibleCount}</p>
                </div>
                <div className="card !p-3">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Telegram доставлено</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{summary?.telegramSuccess ?? 0}</p>
                </div>
                <div className="card !p-3">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Ошибок Telegram</p>
                  <p className="text-lg font-bold text-red-500">{summary?.telegramFailed ?? 0}</p>
                </div>
              </div>

              {/* Order context */}
              <div className="card !p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Категория:</span>
                  <span className="dark:text-white font-medium">{debug.order?.category?.name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Город:</span>
                  <span className="dark:text-white">{debug.order?.city || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Координаты заказа:</span>
                  <span className={debug.order?.hasGeo ? 'text-green-600' : 'text-orange-500'}>
                    {debug.order?.hasGeo ? 'есть' : 'нет'}
                  </span>
                </div>
              </div>

              {/* Delivery log */}
              {logs.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                    Журнал доставки ({logs.length})
                  </h4>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {logs.map((l) => {
                      const ok = l.status === 'success';
                      const skipped = l.status === 'skipped';
                      return (
                        <div
                          key={l.id}
                          className={`flex items-center justify-between gap-2 text-xs p-2 rounded-lg border ${
                            ok
                              ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30'
                              : skipped
                              ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                              : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              l.channel === 'telegram'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                            }`}>{l.channel}</span>
                            <span className="dark:text-white truncate">{l.masterName || l.userId.slice(0, 8)}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={ok ? 'text-green-600' : skipped ? 'text-gray-500' : 'text-red-600'}>
                              {ok ? '✓' : skipped ? '○' : '✗'} {reasonLabel(l.reason)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {logs.length === 0 && (
                <div className="card !p-3 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {log?.hint || 'Журнал доставки пуст. Возможно, рассылка ещё не запускалась.'}
                  </p>
                </div>
              )}

              {/* Eligible masters */}
              {eligible.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase text-green-600 dark:text-green-400 mb-2">
                    Подходящие мастера ({eligible.length})
                  </h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {eligible.map((m) => (
                      <div key={m.masterId} className="flex items-center justify-between text-xs p-2 rounded-lg bg-green-50 dark:bg-green-900/10">
                        <span className="dark:text-white truncate">{m.name}</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          {m.city || '—'} · {m.hasCoordinates ? 'geo' : 'no geo'} · {m.telegramId ? 'TG' : 'no TG'}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Blocked masters */}
              {blocked.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                    Не получили ({blocked.length})
                  </h4>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {blocked.map((m) => (
                      <div key={m.masterId} className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <span className="dark:text-white truncate">{m.name}</span>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {m.excludeReasons.map((r: string) => (
                            <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              {reasonLabel(r)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
