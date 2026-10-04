import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

import { appVersionService } from '../../src/modules/app-version/app-version.service.js';

function mockRelease(tag: string) {
  (globalThis as any).fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      tag_name: tag, name: tag, body: 'notes', published_at: '2026-10-05T00:00:00Z',
      assets: [{ name: 'MasterUz-android.apk', browser_download_url: `https://example/${tag}.apk` }],
    }),
  }));
}

describe('appVersionService: обязательное обновление', () => {
  beforeEach(() => appVersionService.invalidate());

  it('последняя версия = минимальной → обновление обязательно для всех старых', async () => {
    process.env.ANDROID_MIN_SUPPORTED_CODE = '55';
    mockRelease('android-v55');
    const { android } = await appVersionService.getLatest();
    expect(android?.versionCode).toBe(55);
    expect(android?.mandatory).toBe(true);
    expect(android?.minSupportedCode).toBe(55);
  });

  it('вышла версия новее минимальной → для старых клиентов можно «Позже»', async () => {
    process.env.ANDROID_MIN_SUPPORTED_CODE = '55';
    mockRelease('android-v56');
    const { android } = await appVersionService.getLatest();
    expect(android?.mandatory).toBe(false);
    expect(android?.minSupportedCode).toBe(55);
  });
});
