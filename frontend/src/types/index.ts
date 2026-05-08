// ============================================
// MasterUz — TypeScript типы (общие)
// Агент 2 (Фронтенд-разработчик)
// ============================================

// ─── Пользователи ──────────────────────────
export type UserRole = 'CLIENT' | 'MASTER' | 'ADMIN' | 'MANAGER';

export interface User {
  id: string;
  telegramId: number;
  username: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  balance: number;
  referralCode: string;
  profile: UserProfile | null;
  masterProfile: MasterProfile | null;
  createdAt: string;
  isAdminUser?: boolean;
}

export interface UserProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  city: string | null;
  district: string | null;
}

export interface MasterProfile {
  id: string;
  userId: string;
  specializations: string[];
  experienceYears: number;
  rating: number;
  completedOrders: number;
  isAvailable: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  maxDistanceKm: number;
  hourlyRate: number | null;
  schoolCompleted: boolean;
  registrationPaid: boolean;
  registrationPaidAt: string | null;
  totalEarnings: number;
  bio: string | null;
  experience: number;
}

// ─── Категории ─────────────────────────────
export interface Category {
  id: string;
  name: string;
  nameUz: string | null;
  nameEn: string | null;
  slug: string;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  subcategories?: Subcategory[];
}

// ─── Подкатегории ──────────────────────────
export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  nameUz: string | null;
  nameEn: string | null;
  slug: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  tasks?: Task[];
}

// ─── Задачи (конкретные виды работ) ────────
export interface Task {
  id: string;
  subcategoryId: string;
  name: string;
  nameUz: string | null;
  nameEn: string | null;
  description: string | null;
  descriptionUz: string | null;
  descriptionEn: string | null;
  estimatedTime: string | null;
  estimatedTimeUz: string | null;
  estimatedTimeEn: string | null;
  minPrice: number | null;
  slug: string;
  sortOrder: number;
  isActive: boolean;
}

// ─── Связь заказа с задачами ───────────────
export interface OrderTask {
  id: string;
  orderId: string;
  taskId: string;
  task?: Task;
}

// ─── Заказы ────────────────────────────────
// ─── Статусы заказа (расширенные) ──────────
export type OrderStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'ACCEPTED'
  | 'IN_TRANSIT'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'
  | 'ESTIMATION_IN_PROGRESS'
  | 'ESTIMATION_DONE'
  | 'ESTIMATE_SENT'
  | 'ESTIMATE_APPROVED'
  | 'ESTIMATE_REJECTED'
  | 'MODERATION';

export interface Order {
  id: string;
  clientId: string;
  masterId: string | null;
  categoryId: string;
  title: string;
  description: string;
  price: number;
  priceMax: number | null;
  commissionRate: number;
  commissionAmount: number;
  commissionPaid: boolean;
  status: OrderStatus;
  isUrgent: boolean;
  urgentMultiplier: number;
  // Anti-fraud fields
  visitFee: number | null;
  escrowAmount: number;
  offerAccepted: boolean;
  masterConfirmedAt: string | null;
  clientConfirmedAt: string | null;
  acceptedAt: string | null;
  inTransitAt: string | null;
  penaltyAmount: number;
  cancelReason: string | null;
  cancelledBy: string | null;
  disputeReason: string | null;
  /** ISO-таймстамп автоматической отмены, если заказ всё ещё ждёт мастера */
  autoCancelAt?: string | null;
  // Оценка
  isEstimationOrder: boolean;
  estimationFee: number | null;
  parentOrderId: string | null;
  // AI Instant Order
  isInstantAiOrder: boolean;
  aiTemplateId: string | null;
  additionalWishes: string | null;
  moderationRequired: boolean;
  voiceDescription: string | null;
  // Admin
  adminComment: string | null;
  // Geo
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  street: string | null;
  city: string | null;
  district: string | null;
  region: string | null;
  deadline: string | null;
  images: string[];
  createdAt: string;
  completedAt: string | null;
  // Includes
  category?: Category;
  client?: User;
  master?: User;
  responses?: OrderResponse[];
  reviews?: Review[];
  orderTasks?: OrderTask[];
  _count?: { responses: number };
  distance?: number;
}

export interface OrderResponse {
  id: string;
  orderId: string;
  masterId: string;
  priceOffer: number | null;
  message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  createdAt: string;
  master?: User;
}

// ─── Отзывы ────────────────────────────────
export interface Review {
  id: string;
  orderId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer?: User;
  order?: { title: string; category?: { name: string } };
}

// ─── Платежи ───────────────────────────────
export type PaymentProvider = 'CLICK' | 'PAYME' | 'TELEGRAM_STARS' | 'INTERNAL';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface Payment {
  id: string;
  orderId: string | null;
  userId: string;
  amount: number;
  type: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  createdAt: string;
  order?: { title: string; status: string };
}

// ─── Рефералы ──────────────────────────────
export interface Referral {
  id: string;
  referrerId: string;
  referredId: string;
  type: 'MASTER_TO_MASTER' | 'CLIENT_TO_CLIENT';
  bonusAmount: number | null;
  bonusRate: number;
  status: 'PENDING' | 'ACTIVE' | 'PAID';
  createdAt: string;
  referred?: User;
}

// ─── Школа ─────────────────────────────────
export interface SchoolCourse {
  id: string;
  categoryId: string | null;
  title: string;
  titleUz: string | null;
  description: string | null;
  descriptionUz: string | null;
  content: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
  passingScore: number;
  category?: Category;
  questions?: QuizQuestion[];
  _count?: { progress: number; questions: number };
}

export interface QuizQuestion {
  id: string;
  question: string;
  questionUz: string | null;
  options: string[];
  optionsUz: string[] | null;
  sortOrder: number;
}

export interface CourseProgress {
  id: string;
  userId: string;
  courseId: string;
  completed: boolean;
  completedAt: string | null;
  videoWatchedSec: number;
  videoCompleted: boolean;
  quizScore: number | null;
  quizPassedAt: string | null;
  quizAttempts: number;
  course?: SchoolCourse;
}

export interface SchoolProgressData {
  totalCourses: number;
  completedCourses: number;
  requiredCourses: number;
  completedRequired: number;
  isSchoolCompleted: boolean;
  progress: CourseProgress[];
}

export interface QuizResult {
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  passingScore: number;
  attempts: number;
}

// ─── API Response ──────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    message: string;
    statusCode: number;
    details?: any;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ─── Уведомления ───────────────────────────
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

// ─── Чат (с модерацией) ───────────────────
export interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  text: string | null;
  imageUrl: string | null;
  isSystem: boolean;
  isRead: boolean;
  isFlagged?: boolean;
  flagReason?: string;
  isBlocked?: boolean;
  createdAt: string;
  sender?: {
    id: string;
    firstName: string;
    avatarUrl?: string | null;
  };
}

// ─── Смета (Estimate) ─────────────────────
export type EstimateStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'MODERATION';

export interface EstimateWorkItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface EstimateMaterialItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Estimate {
  id: string;
  orderId: string;
  masterId: string;
  status: EstimateStatus;
  workItems: EstimateWorkItem[];
  materialItems: EstimateMaterialItem[];
  workTotal: number;
  materialTotal: number;
  totalAmount: number;
  estimatedDays: number | null;
  notes: string | null;
  photos: string[];
  videos: string[];
  moderatedById: string | null;
  moderatedAt: string | null;
  moderationNote: string | null;
  clientResponseAt: string | null;
  rejectionReason: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  order?: Order;
  master?: {
    id: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    profile?: any;
    masterProfile?: any;
  };
}

// ─── Чёрный список (расширенный) ──────────
export interface BlacklistEntry {
  id: string;
  userId: string;
  reason: string;
  blockedById: string;
  violationType: string | null;
  evidence: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  telegramLocation: string | null;
  penaltyAmount: number | null;
  orderId: string | null;
  isPermanent: boolean;
  createdAt: string;
  expiresAt: string | null;
  user?: User;
  blockedBy?: User;
}

// ─── Фото до/после ────────────────────────
export interface OrderPhoto {
  id: string;
  orderId: string;
  url: string;
  type: 'before' | 'after';
  caption: string | null;
  sortOrder: number;
  createdAt: string;
}

// ─── Избранные мастера ────────────────────
export interface FavoriteMaster {
  id: string;
  clientId: string;
  masterId: string;
  createdAt: string;
  master?: User;
}

// ─── Промокоды ────────────────────────────
export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  minOrderPrice: number | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  _count?: { usages: number };
}

export interface PromoValidation {
  promoCodeId: string;
  code: string;
  discountType: string;
  discountValue: number;
  calculatedDiscount: number;
  description: string;
}

// ─── Гарантия ─────────────────────────────
export interface Guarantee {
  id: string;
  orderId: string;
  durationDays: number;
  description: string | null;
  isActive: boolean;
  claimedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  expiresAt: string;
  order?: Order;
}

// ─── Портфолио мастера ────────────────────
export interface PortfolioItem {
  id: string;
  masterId: string;
  title: string;
  description: string | null;
  imageUrl: string;
  categoryId: string | null;
  sortOrder: number;
  likesCount: number;
  createdAt: string;
  category?: { id: string; name: string; nameUz?: string | null; nameEn?: string | null; slug?: string };
  master?: {
    id: string;
    profile?: { firstName: string; lastName?: string | null; avatarUrl?: string | null };
    masterProfile?: { rating: number; completedOrders: number };
  };
}

export interface PortfolioStats {
  totalItems: number;
  totalLikes: number;
  categoriesUsed: number;
}

// ─── Конфигурация платформы ────────────────
export interface PlatformConfig {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

// ─── Дашборд (Админ) ──────────────────────
export interface DashboardStats {
  totalUsers: number;
  totalMasters: number;
  totalClients: number;
  totalOrders: number;
  completedOrders: number;
  activeOrders: number;
  totalRevenue: number;
  todayOrders: number;
  todayRevenue: number;
  registrationFeesPaid: number;
  unpaidMasters: number;
  urgentOrders: number;
}

export interface Dashboard {
  stats: DashboardStats;
  topMasters: any[];
  recentOrders: Order[];
  ordersByStatus: { status: string; count: number }[];
}

// ─── Транзакции баланса ────────────────────
export type BalanceTransactionType =
  | 'TOPUP'
  | 'ESCROW_HOLD'
  | 'ESCROW_RELEASE'
  | 'PENALTY'
  | 'REFUND'
  | 'COMMISSION'
  | 'PAYOUT'
  | 'ESTIMATION_FEE'
  | 'ESTIMATE_PAYOUT'
  | 'ADMIN_TOPUP'
  | 'ADMIN_WITHDRAW'
  | 'REFERRAL_BONUS';

export interface BalanceTransaction {
  id: string;
  userId: string;
  type: BalanceTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  orderId: string | null;
  description: string | null;
  createdAt: string;
}

// ─── Партнёрские магазины ──────────────────
export type StoreStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export interface PartnerStore {
  id: string;
  name: string;
  nameUz: string | null;
  nameEn: string | null;
  slug: string;
  description: string | null;
  descriptionUz: string | null;
  descriptionEn: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  phone: string;
  email: string | null;
  website: string | null;
  telegramUsername: string | null;
  contactPerson: string;
  address: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  storeCategory: string;
  rating: number;
  reviewCount: number;
  status: StoreStatus;
  isVerified: boolean;
  workingHours: string | null;
  deliveryAvailable: boolean;
  discountForMasters: number | null;
  createdAt: string;
  products?: StoreProduct[];
  reviews?: StoreReview[];
  _count?: { products: number; reviews: number };
}

export interface StoreProduct {
  id: string;
  storeId: string;
  name: string;
  nameUz: string | null;
  nameEn: string | null;
  description: string | null;
  price: number;
  unit: string | null;
  imageUrl: string | null;
  category: string;
  inStock: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface StoreReview {
  id: string;
  storeId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface StoreCategory {
  slug: string;
  name: string;
  nameUz: string;
  nameEn: string;
  icon: string;
}

export interface PartnerRequest {
  id: string;
  storeName: string;
  contactPerson: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  storeCategory: string;
  message: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

// ─── Ремонт под ключ ──────────────────────
export type TurnkeyStatus =
  | 'INQUIRY'
  | 'CONSULTATION'
  | 'DESIGNING'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface TurnkeyProject {
  id: string;
  clientId: string;
  title: string;
  description: string | null;
  propertyType: string;
  area: number | null;
  rooms: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  address: string | null;
  city: string | null;
  district: string | null;
  status: TurnkeyStatus;
  designIncluded: boolean;
  furnitureIncluded: boolean;
  estimatedDays: number | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  totalPrice: number | null;
  images: string[];
  floorPlanUrl: string | null;
  designProjectUrl: string | null;
  createdAt: string;
  stages?: TurnkeyStage[];
}

export interface TurnkeyStage {
  id: string;
  projectId: string;
  name: string;
  nameUz: string | null;
  nameEn: string | null;
  description: string | null;
  sortOrder: number;
  status: string;
  progress: number;
  startDate: string | null;
  endDate: string | null;
}

export interface TurnkeyEstimate {
  propertyType: string;
  area: number;
  rooms: number;
  designIncluded: boolean;
  furnitureIncluded: boolean;
  priceMin: number;
  priceMax: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  pricePerSqmMin: number;
  pricePerSqmMax: number;
}

// ─── AI Instant Order (ФотоЗаказ за 30 сек) ──
export type AiTier = 'GOOD' | 'BETTER' | 'BEST';

export interface AiOrderTemplate {
  id: string;
  categoryId: string;
  tier: AiTier;
  tierLabel: string;
  taskIds: string[];
  materials: AiMaterialItem[];
  estimatedPrice: number;
  estimatedDays: number;
  confidence: number;
  description: string | null;
}

export interface AiMaterialItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface AiClarifyingQuestion {
  id: string;
  type: 'multiselect' | 'select' | 'text';
  question: string;
  hint?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface AiDetectedCategory {
  id: string;
  name: string;
  slug: string;
  nameUz: string | null;
  nameEn: string | null;
  icon: string | null;
}

export interface AiAnalysisResult {
  /** Если AI не смог однозначно определить характер работ — задаёт уточняющие вопросы */
  needsClarification?: boolean;
  clarifyingQuestions?: AiClarifyingQuestion[];
  message?: string;
  partialMatches?: { id: string; name: string; slug: string }[];

  category: {
    id: string;
    name: string;
    nameUz: string | null;
    nameEn: string | null;
    slug: string;
  };
  detectedFromPhoto: boolean;
  /** Все направления работ, которые AI распознал в описании (≥ 1). */
  detectedCategories?: AiDetectedCategory[];
  variants: AiOrderTemplate[];
  allTasks: {
    id: string;
    name: string;
    nameUz: string | null;
    nameEn: string | null;
    minPrice: number | null;
    estimatedTime: string | null;
    categoryId?: string;
    categoryName?: string;
    subcategoryName?: string;
  }[];
}

export interface InstantOrderCreateData {
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
}

