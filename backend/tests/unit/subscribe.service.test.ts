import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeService } from '../../src/modules/subscribe/subscribe.service.js';
import { config } from '../../src/config/index.js';

describe('subscribeService.rpcForward', () => {
  const globalFetch = (global as any).fetch;

  beforeEach(() => {
    // минимальная конфигурация для тестов
    (config.payme as any).sandboxMerchantId = 'test-mid';
    (config.payme as any).sandboxMerchantKey = 'test-key';
    (config.payme as any).useSandbox = true;
  });

  afterEach(() => {
    (global as any).fetch = globalFetch;
    vi.restoreAllMocks();
  });

  it('forwards allowed method and returns result', async () => {
    const fakeResponse = { ok: true, json: async () => ({ result: { ok: true } }) };
    (global as any).fetch = vi.fn().mockResolvedValue(fakeResponse);

    const res = await subscribeService.rpcForward('receipts.create', { amount: 100 });
    expect(res).toEqual({ result: { ok: true } });
    expect((global as any).fetch).toHaveBeenCalled();
  });

  it('rejects disallowed method', async () => {
    await expect(subscribeService.rpcForward('not.allowed', {} as any)).rejects.toBeDefined();
  });
});
