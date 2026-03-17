// ============================================
// MasterUz — Rating Display Component
// Отображение рейтинга звёздами
// ============================================

import { Star } from 'lucide-react';

interface RatingDisplayProps {
  rating: number;
  maxRating?: number;
  size?: number;
  showValue?: boolean;
  reviewCount?: number;
}

export function RatingDisplay({
  rating,
  maxRating = 5,
  size = 16,
  showValue = true,
  reviewCount,
}: RatingDisplayProps) {
  const stars = Array.from({ length: maxRating }, (_, i) => {
    const fillPercentage = Math.min(Math.max(rating - i, 0), 1) * 100;
    return fillPercentage;
  });

  return (
    <div className="inline-flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {stars.map((fill, i) => (
          <div key={i} className="relative" style={{ width: size, height: size }}>
            {/* Empty star */}
            <Star
              size={size}
              className="text-gray-200 dark:text-gray-600"
              fill="currentColor"
            />
            {/* Filled star (clipped) */}
            {fill > 0 && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill}%` }}
              >
                <Star
                  size={size}
                  className="text-amber-400"
                  fill="currentColor"
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {showValue && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
          {rating.toFixed(1)}
        </span>
      )}
      {reviewCount !== undefined && (
        <span className="text-xs text-gray-400 dark:text-gray-500">
          ({reviewCount})
        </span>
      )}
    </div>
  );
}
