// ============================================
// MasterUz — Skeleton Loading Components
// ============================================

export function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export function OrderCardSkeleton() {
  return (
    <div className="card">
      <div className="animate-pulse">
        <div className="flex justify-between items-start mb-3">
          <SkeletonPulse className="h-5 w-2/3 rounded" />
          <SkeletonPulse className="h-5 w-20 rounded-full" />
        </div>
        <SkeletonPulse className="h-4 w-full mb-2 rounded" />
        <SkeletonPulse className="h-4 w-4/5 mb-4 rounded" />
        <div className="flex gap-3">
          <SkeletonPulse className="h-4 w-24 rounded" />
          <SkeletonPulse className="h-4 w-24 rounded" />
          <SkeletonPulse className="h-4 w-16 rounded" />
        </div>
      </div>
    </div>
  );
}

export function MasterCardSkeleton() {
  return (
    <div className="card">
      <div className="animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <SkeletonPulse className="w-12 h-12 rounded-full" />
          <div className="flex-1">
            <SkeletonPulse className="h-5 w-32 mb-1 rounded" />
            <SkeletonPulse className="h-4 w-20 rounded" />
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <SkeletonPulse className="h-6 w-16 rounded-full" />
          <SkeletonPulse className="h-6 w-20 rounded-full" />
          <SkeletonPulse className="h-6 w-24 rounded-full" />
        </div>
        <div className="flex justify-between">
          <SkeletonPulse className="h-4 w-24 rounded" />
          <SkeletonPulse className="h-4 w-16 rounded" />
        </div>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="page-container pb-20">
      <div className="animate-pulse">
        <SkeletonPulse className="h-8 w-48 mb-6 rounded" />
        <div className="card mb-4">
          <div className="flex items-center gap-4">
            <SkeletonPulse className="w-16 h-16 rounded-full" />
            <div className="flex-1">
              <SkeletonPulse className="h-5 w-40 mb-2 rounded" />
              <SkeletonPulse className="h-4 w-28 mb-2 rounded" />
              <SkeletonPulse className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <SkeletonPulse className="h-14 rounded-xl" />
          <SkeletonPulse className="h-14 rounded-xl" />
        </div>
        <div className="card mb-4">
          <SkeletonPulse className="h-5 w-40 mb-3 rounded" />
          <SkeletonPulse className="h-4 w-48 mb-2 rounded" />
          <SkeletonPulse className="h-4 w-36 rounded" />
        </div>
      </div>
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="page-container pb-20">
      <div className="animate-pulse">
        <SkeletonPulse className="h-8 w-56 mb-2 rounded" />
        <SkeletonPulse className="h-5 w-24 mb-6 rounded-full" />
        <div className="card mb-4">
          <SkeletonPulse className="h-5 w-full mb-2 rounded" />
          <SkeletonPulse className="h-5 w-4/5 mb-4 rounded" />
          <div className="grid grid-cols-2 gap-3">
            <SkeletonPulse className="h-12 rounded-lg" />
            <SkeletonPulse className="h-12 rounded-lg" />
            <SkeletonPulse className="h-12 rounded-lg" />
            <SkeletonPulse className="h-12 rounded-lg" />
          </div>
        </div>
        <div className="card mb-4">
          <SkeletonPulse className="h-5 w-32 mb-3 rounded" />
          <SkeletonPulse className="h-20 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Hero */}
      <div className="bg-gray-200 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <SkeletonPulse className="h-10 w-64 mx-auto mb-4 rounded" />
          <SkeletonPulse className="h-6 w-96 mx-auto mb-6 rounded" />
          <div className="flex justify-center gap-3">
            <SkeletonPulse className="h-12 w-40 rounded-xl" />
            <SkeletonPulse className="h-12 w-40 rounded-xl" />
          </div>
        </div>
      </div>
      {/* Categories */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        <SkeletonPulse className="h-7 w-48 mb-6 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonPulse key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <MasterCardSkeleton key={i} />
      ))}
    </div>
  );
}
