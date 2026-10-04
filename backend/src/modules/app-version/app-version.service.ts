// ============================================
// MasterUz — App Version Service
// Источник истины — GitHub Releases (тег android-vN, asset MasterUz-android.apk).
// Кэш 5 минут в памяти, чтобы не дёргать GitHub API на каждый запрос.
// ============================================

import { logger } from '../../utils/logger.js';

const GITHUB_REPO = process.env.GITHUB_REPO ?? 'dex89666/masteruz';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const CACHE_TTL_MS = 5 * 60 * 1000;
// Минимальная поддерживаемая сборка: приложения ниже этого кода обязаны обновиться
// (окно обновления без «Позже» и крестика). Читаем при каждом запросе — меняется
// переменной окружения без пересборки.
const androidMinSupported = () => Number(process.env.ANDROID_MIN_SUPPORTED_CODE ?? 1);

interface AndroidVersion {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
  changelog: string;
  publishedAt: string;
  mandatory: boolean;
  /** Минимальная рабочая сборка — новые клиенты сравнивают с ней свой versionCode */
  minSupportedCode: number;
}

interface VersionPayload {
  android: AndroidVersion | null;
  // iOS будет добавлен после первого релиза в App Store.
  ios: null;
}

interface GithubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

let cache: { value: VersionPayload; expiresAt: number } | null = null;

/** Парсит versionCode из тега android-vN (или v1.2.3 → последний segment). */
function parseVersionCode(tag: string): number {
  const numericTail = tag.match(/(\d+)\s*$/);
  return numericTail ? Number(numericTail[1]) : 1;
}

async function fetchLatestRelease(): Promise<VersionPayload> {
  const response = await fetch(GITHUB_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'MasterUz-Backend' },
    // Не висим вечно — даже если GitHub упал, отдадим null.
    signal: AbortSignal.timeout(4000),
  });

  if (!response.ok) {
    throw new Error(`GitHub Releases вернул ${response.status}`);
  }

  const release = (await response.json()) as GithubRelease;
  const apkAsset = release.assets.find((a) => a.name.toLowerCase().endsWith('.apk'));

  if (!apkAsset) {
    logger.warn({ tag: release.tag_name }, 'В релизе не найден APK-asset');
    return { android: null, ios: null };
  }

  const versionCode = parseVersionCode(release.tag_name);

  return {
    android: {
      versionCode,
      versionName: release.tag_name.replace(/^android-/, '').replace(/^v/, '') || '1.0.0',
      downloadUrl: apkAsset.browser_download_url,
      changelog: release.body?.trim() ?? '',
      publishedAt: release.published_at,
      // Старые клиенты не сообщают свою версию и смотрят только на mandatory.
      // Окно они показывают лишь когда установлено < последней версии, поэтому
      // «обязательно» = последняя версия уже не новее минимально допустимой.
      mandatory: versionCode <= androidMinSupported(),
      minSupportedCode: androidMinSupported(),
    },
    ios: null,
  };
}

export const appVersionService = {
  async getLatest(): Promise<VersionPayload> {
    if (cache && cache.expiresAt > Date.now()) {
      return cache.value;
    }
    try {
      const fresh = await fetchLatestRelease();
      cache = { value: fresh, expiresAt: Date.now() + CACHE_TTL_MS };
      return fresh;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Не удалось получить релиз с GitHub');
      // Если кэш есть — отдаём устаревшие данные, лучше чем ничего.
      if (cache) return cache.value;
      return { android: null, ios: null };
    }
  },

  /** Сбросить кэш (для админ-эндпоинта, если нужно). */
  invalidate(): void {
    cache = null;
  },
};
