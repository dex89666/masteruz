// ============================================
// MasterUz — Star Rating Component
// Агент 2 (Фронтенд-разработчик)
// ============================================

import { Star } from 'lucide-react';
import { useState } from 'react';

interface StarRatingProps {
  rating: number;
  onRate?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
}

export function StarRating({
  rating,
  onRate,
  size = 20,
  readonly = false,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="inline-flex gap-0.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onRate?.(star)}
          onMouseEnter={() => !readonly && setHoverRating(star)}
          onMouseLeave={() => !readonly && setHoverRating(0)}
          className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          aria-checked={star === rating}
          role="radio"
        >
          <Star
            size={size}
            className={
              star <= (hoverRating || rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-gray-200 text-gray-200'
            }
          />
        </button>
      ))}
    </div>
  );
}
