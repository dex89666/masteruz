// ============================================
// MasterUz — Page Skeleton Components
// Скелетоны для разных страниц
// ============================================

export function OrderCardSkeleton() {
  return (
    <div className="card dark:bg-gray-800 dark:ring-gray-700 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="flex items-center gap-4">
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}

export function MasterCardSkeleton() {
  return (
    <div className="card dark:bg-gray-800 dark:ring-gray-700 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}

export function OrdersListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MastersGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <MasterCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="page-container animate-pulse">
      <div className="h-7 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
      <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-4">
        <div className="space-y-3">
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
      <div className="card dark:bg-gray-800 dark:ring-gray-700">
        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="page-container animate-pulse">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div>
          <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card dark:bg-gray-800 dark:ring-gray-700 h-24" />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="page-container animate-pulse">
      <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card dark:bg-gray-800 dark:ring-gray-700 h-28" />
        ))}
      </div>
      <div className="card dark:bg-gray-800 dark:ring-gray-700 h-64" />
    </div>
  );
}
