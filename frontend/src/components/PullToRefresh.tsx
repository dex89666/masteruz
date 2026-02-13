// ============================================
// MasterUz — Pull to Refresh Component
// Потяните вниз для обновления (мобильные)
// ============================================

import { useState, useRef, useCallback, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from '../i18n';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const { t } = useTranslation();
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = Math.max(0, currentY - startY.current);
    // Diminishing returns effect
    const distance = Math.min(diff * 0.5, 120);
    setPullDistance(distance);
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } catch { /* ignore */ }
      setRefreshing(false);
    }
    setPulling(false);
    setPullDistance(0);
  }, [pullDistance, refreshing, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: pullDistance > 0 ? pullDistance : 0 }}
      >
        <div className={`flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 ${refreshing ? 'animate-pulse' : ''}`}>
          <RefreshCw
            size={18}
            className={`transition-transform duration-200 ${refreshing ? 'animate-spin' : ''}`}
            style={{ transform: `rotate(${progress * 360}deg)` }}
          />
          <span>
            {refreshing
              ? t('common.loading')
              : progress >= 1
              ? t('common.releaseToRefresh')
              : t('common.pullToRefresh')}
          </span>
        </div>
      </div>

      {children}
    </div>
  );
}
