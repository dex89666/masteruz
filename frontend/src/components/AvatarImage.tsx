// ============================================
// MasterUz — AvatarImage
// Фото профиля с запасным вариантом: если ссылки нет или картинка
// не загрузилась (протухшая ссылка Telegram, удалённый файл) —
// показываем заглушку вместо значка «битой» картинки.
// ============================================

import { useEffect, useState, type ReactNode } from 'react';
import { resolveImageUrl } from '../lib/imageUrl';

interface AvatarImageProps {
  url: string | null | undefined;
  className: string;
  fallback: ReactNode;
}

export function AvatarImage({ url, className, fallback }: AvatarImageProps) {
  const src = resolveImageUrl(url);
  const [failed, setFailed] = useState(false);

  // Новая ссылка (например, после загрузки фото) — пробуем снова
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return <>{fallback}</>;
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={className} />;
}
