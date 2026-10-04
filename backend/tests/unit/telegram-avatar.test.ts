import { describe, it, expect, beforeEach, vi } from 'vitest';

const profiles = new Map<string, { telegramId: bigint; avatarUrl: string | null }>();
const update = vi.fn(async ({ where, data }: any) => {
  profiles.get(where.userId)!.avatarUrl = data.avatarUrl;
});

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        const p = profiles.get(where.id);
        return p ? { telegramId: p.telegramId, profile: { avatarUrl: p.avatarUrl } } : null;
      }),
    },
    userProfile: {
      update: (args: any) => update(args),
      findUnique: vi.fn(async ({ where }: any) => {
        const p = profiles.get(where.userId);
        return p ? { avatarUrl: p.avatarUrl } : null;
      }),
    },
  },
}));
vi.mock('../../src/config/index.js', () => ({ config: { telegram: { botToken: 'TEST' } } }));
vi.mock('../../src/utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
const put = vi.fn(async ({ key }: any) => `/uploads/${key}`);
vi.mock('../../src/services/storage.js', () => ({ getStorage: async () => ({ put }) }));

import {
  refreshTelegramAvatar,
  storeAvatarFromLogin,
  isTelegramPlaceholder,
  isTelegramUserpicUrl,
} from '../../src/services/telegramAvatar.js';

function mockTelegram(hasPhoto: boolean) {
  (globalThis as any).fetch = vi.fn(async (url: string) => {
    if (url.includes('getUserProfilePhotos')) {
      return { ok: true, json: async () => ({ ok: true, result: { total_count: hasPhoto ? 1 : 0, photos: hasPhoto ? [[
        { file_id: 'small', file_unique_id: 'u160', width: 160 },
        { file_id: 'big', file_unique_id: 'u640', width: 640 },
      ]] : [] } }) };
    }
    if (url.includes('getFile')) return { ok: true, json: async () => ({ ok: true, result: { file_path: 'photos/a.jpg' } }) };
    return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  });
}

beforeEach(() => {
  profiles.clear();
  vi.clearAllMocks();
});

describe('telegramAvatar', () => {
  it('распознаёт ссылки t.me и заглушку .svg', () => {
    expect(isTelegramUserpicUrl('https://t.me/i/userpic/320/abc.svg')).toBe(true);
    expect(isTelegramPlaceholder('https://t.me/i/userpic/320/abc.svg')).toBe(true);
    expect(isTelegramPlaceholder('https://t.me/i/userpic/320/abc.jpg')).toBe(false);
    expect(isTelegramUserpicUrl('/uploads/me.jpg')).toBe(false);
  });

  it('заменяет заглушку t.me на сохранённое фото (~640px)', async () => {
    profiles.set('u1', { telegramId: 42n, avatarUrl: 'https://t.me/i/userpic/320/abc.svg' });
    mockTelegram(true);
    await refreshTelegramAvatar('u1');
    expect(profiles.get('u1')!.avatarUrl).toBe('/uploads/avatars/tg_42_u640.jpg');
  });

  it('не трогает фото, загруженное пользователем', async () => {
    profiles.set('u2', { telegramId: 43n, avatarUrl: '/uploads/my-photo.jpg' });
    mockTelegram(true);
    await refreshTelegramAvatar('u2');
    expect(profiles.get('u2')!.avatarUrl).toBe('/uploads/my-photo.jpg');
    expect(put).not.toHaveBeenCalled();
  });

  it('фото скрыто — убирает заглушку, чтобы показать первую букву имени', async () => {
    profiles.set('u3', { telegramId: 44n, avatarUrl: 'https://t.me/i/userpic/320/abc.svg' });
    mockTelegram(false);
    await refreshTelegramAvatar('u3');
    expect(profiles.get('u3')!.avatarUrl).toBeNull();
  });
});

describe('telegramAvatar: фото из официального входа Telegram', () => {
  function mockPicture(type = 'image/jpeg') {
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      headers: { get: () => type },
      arrayBuffer: async () => new Uint8Array([9, 9, 9]).buffer,
    }));
  }

  it('заменяет ссылку t.me своей копией', async () => {
    profiles.set('v', { telegramId: 7n, avatarUrl: 'https://t.me/i/userpic/320/x.jpg' });
    mockPicture();
    await storeAvatarFromLogin('v', 7n, 'https://t.me/i/userpic/320/x.jpg');
    expect(profiles.get('v')!.avatarUrl).toMatch(/^\/uploads\/avatars\/tg_7_[0-9a-f]{16}\.jpg$/);
  });

  it('не трогает своё фото и игнорирует заглушку .svg', async () => {
    profiles.set('own', { telegramId: 8n, avatarUrl: '/uploads/me.jpg' });
    mockPicture();
    await storeAvatarFromLogin('own', 8n, 'https://t.me/i/userpic/320/x.jpg');
    expect(profiles.get('own')!.avatarUrl).toBe('/uploads/me.jpg');

    profiles.set('svg', { telegramId: 9n, avatarUrl: null });
    await storeAvatarFromLogin('svg', 9n, 'https://t.me/i/userpic/320/x.svg');
    expect(profiles.get('svg')!.avatarUrl).toBeNull();
  });
});
