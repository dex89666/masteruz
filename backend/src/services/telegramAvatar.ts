// ============================================
// MasterUz — настоящие аватары из Telegram
//
// Telegram Login Widget и Mini App отдают photo_url вида
// https://t.me/i/userpic/320/<hash>.svg — это заглушка Telegram
// (буква на цветном фоне), когда фото скрыто или недоступно. Кроме того,
// такие ссылки со временем перестают работать.
//
// Поэтому фото берём сами через Bot API (getUserProfilePhotos → getFile),
// сохраняем копию в наше хранилище и пишем в profile.avatarUrl свой URL.
// ============================================

import crypto from 'crypto';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { getStorage } from './storage.js';

// Берём fetch в момент вызова (а не при загрузке модуля) — так его можно подменить в тестах
const _fetch: typeof fetch = (...args) => globalThis.fetch(...args);

const botApi = () => `https://api.telegram.org/bot${config.telegram?.botToken ?? ''}`;
const fileApi = () => `https://api.telegram.org/file/bot${config.telegram?.botToken ?? ''}`;

/** Ссылки t.me/i/userpic — временные и часто заглушки: заменяем на свою копию. */
export function isTelegramUserpicUrl(url: string | null | undefined): boolean {
  return !!url && /^https?:\/\/t\.me\/i\/userpic\//i.test(url);
}

/** Заглушка-буква Telegram (.svg) — хранить её как «фото» нет смысла. */
export function isTelegramPlaceholder(url: string | null | undefined): boolean {
  return isTelegramUserpicUrl(url) && /\.svg(\?|$)/i.test(url!);
}

/**
 * Скачивает текущее фото профиля пользователя Telegram и сохраняет его у нас.
 * Возвращает URL сохранённой копии или null, если фото нет/скрыто приватностью.
 */
export async function fetchTelegramAvatar(telegramId: bigint | number): Promise<string | null> {
  if (!config.telegram?.botToken) return null;
  try {
    const photosRes = await _fetch(`${botApi()}/getUserProfilePhotos?user_id=${telegramId}&limit=1`);
    const photos = (await photosRes.json()) as {
      ok: boolean;
      result?: { total_count: number; photos: { file_id: string; file_unique_id: string; width: number }[][] };
    };
    const sizes = photos.ok ? photos.result?.photos?.[0] : undefined;
    if (!sizes || sizes.length === 0) return null;

    // Берём ближайший к 640px размер: достаточно для карточки и профиля, не тяжёлый
    const size = [...sizes].sort((a, b) => Math.abs(a.width - 640) - Math.abs(b.width - 640))[0];

    const fileRes = await _fetch(`${botApi()}/getFile?file_id=${encodeURIComponent(size.file_id)}`);
    const file = (await fileRes.json()) as { ok: boolean; result?: { file_path?: string } };
    const filePath = file.ok ? file.result?.file_path : undefined;
    if (!filePath) return null;

    const imgRes = await _fetch(`${fileApi()}/${filePath}`);
    if (!imgRes.ok) return null;
    const body = Buffer.from(await imgRes.arrayBuffer());
    if (body.length === 0 || body.length > 5 * 1024 * 1024) return null;

    const storage = await getStorage();
    // file_unique_id меняется вместе с фото — старая копия не перезаписывается кэшем
    return await storage.put({
      key: `avatars/tg_${telegramId}_${size.file_unique_id}.jpg`,
      body,
      contentType: 'image/jpeg',
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message, telegramId: String(telegramId) }, 'telegramAvatar: не удалось получить фото');
    return null;
  }
}

/**
 * Сохраняет копию фото по ссылке, которую прислал сам Telegram при входе
 * (claim picture в id_token): пользователь разрешил передать фото, поэтому
 * оно доступно, даже если скрыто от ботов. Ссылки t.me со временем умирают —
 * храним свою копию. Заменяем только пустой аватар или ссылку t.me.
 */
export async function storeAvatarFromLogin(userId: string, telegramId: bigint | number, pictureUrl: string | undefined): Promise<void> {
  if (!pictureUrl || isTelegramPlaceholder(pictureUrl) || !/^https:\/\//i.test(pictureUrl)) return;
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { avatarUrl: true } });
  if (!profile) return;
  if (profile.avatarUrl && !isTelegramUserpicUrl(profile.avatarUrl)) return; // своё фото не трогаем

  const res = await _fetch(pictureUrl);
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !/^image\/(jpeg|png|webp)/i.test(type)) return;
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length === 0 || body.length > 5 * 1024 * 1024) return;

  const ext = /png/i.test(type) ? 'png' : /webp/i.test(type) ? 'webp' : 'jpg';
  const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 16);
  const storage = await getStorage();
  const url = await storage.put({ key: `avatars/tg_${telegramId}_${hash}.${ext}`, body, contentType: type.split(';')[0] });
  await prisma.userProfile.update({ where: { userId }, data: { avatarUrl: url } });
}

/**
 * Обновляет аватар пользователя из Telegram, если сейчас у него нет своего фото
 * (пусто или ссылка t.me). Загруженное пользователем фото не трогаем.
 */
export async function refreshTelegramAvatar(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramId: true, profile: { select: { avatarUrl: true } } },
  });
  if (!user?.profile) return;
  const current = user.profile.avatarUrl;
  if (current && !isTelegramUserpicUrl(current)) return;

  const url = await fetchTelegramAvatar(user.telegramId);
  // Фото нет — убираем заглушку t.me, интерфейс покажет первую букву имени
  const next = url ?? (isTelegramPlaceholder(current) ? null : current);
  if (next !== current) {
    await prisma.userProfile.update({ where: { userId }, data: { avatarUrl: next } });
  }
}

/**
 * Разовое заполнение после деплоя: всем, у кого аватар пустой или ссылка t.me,
 * подтягиваем настоящее фото. Идемпотентно — повторный запуск обработает
 * только оставшихся. Мастера первыми: их аватары видны на главной.
 */
export async function backfillTelegramAvatars(limit = 500): Promise<void> {
  if (!config.telegram?.botToken) return;
  const needsAvatar = {
    profile: {
      OR: [{ avatarUrl: null }, { avatarUrl: { startsWith: 'https://t.me/i/userpic/' } }],
    },
  };
  const masters = await prisma.user.findMany({
    where: { ...needsAvatar, role: 'MASTER' },
    select: { id: true },
    take: limit,
  });
  const others = await prisma.user.findMany({
    where: { ...needsAvatar, role: { not: 'MASTER' } },
    select: { id: true },
    take: Math.max(0, limit - masters.length),
  });
  const users = [...masters, ...others];
  let failed = 0;
  for (const u of users) {
    await refreshTelegramAvatar(u.id).catch(() => { failed++; });
    // Bot API: не больше ~30 запросов/сек; на пользователя 3 запроса
    await new Promise((r) => setTimeout(r, 150));
  }
  logger.info({ processed: users.length, failed }, 'telegramAvatar: заполнение аватаров завершено');
}
