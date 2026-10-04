import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const store = new Map<string, string>();
vi.mock('../../src/config/redis.js', () => ({
  getRedis: () => ({
    set: async (k: string, v: string) => { store.set(k, v); },
    get: async (k: string) => store.get(k) ?? null,
    del: async (k: string) => { store.delete(k); },
  }),
}));
vi.mock('../../src/utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

process.env.TELEGRAM_OIDC_CLIENT_ID = '123456';
process.env.TELEGRAM_OIDC_CLIENT_SECRET = 'secret';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: 'jwk' }) as object), kid: 'k1', alg: 'RS256', use: 'sig' };
const otherKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;

let idToken = '';
function sign(payload: object, key = privateKey) {
  return jwt.sign(payload, key, { algorithm: 'RS256', keyid: 'k1', issuer: 'https://oauth.telegram.org', audience: '123456', expiresIn: 300 });
}

beforeEach(() => {
  store.clear();
  (globalThis as any).fetch = vi.fn(async (url: string) => {
    if (url.includes('jwks')) return { ok: true, json: async () => ({ keys: [jwk] }) };
    return { ok: true, json: async () => ({ id_token: idToken }) };
  });
});

import { telegramOidcService } from '../../src/modules/auth/telegram-oidc.service.js';

async function start() {
  const url = new URL(await telegramOidcService.buildAuthUrl('/orders'));
  const state = url.searchParams.get('state')!;
  const nonce = JSON.parse(store.get(`tg-oidc:${state}`)!).nonce;
  return { url, state, nonce };
}

describe('telegram-oidc', () => {
  it('строит адрес входа с PKCE и нужными scope', async () => {
    const { url } = await start();
    expect(url.origin + url.pathname).toBe('https://oauth.telegram.org/auth');
    expect(url.searchParams.get('scope')).toBe('openid profile phone');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('client_id')).toBe('123456');
  });

  it('принимает корректно подписанный id_token и отдаёт данные пользователя', async () => {
    const { state, nonce } = await start();
    idToken = sign({ id: 777, name: 'Марина Иванова', preferred_username: 'marina', phone_number: '998901234567', phone_number_verified: true, nonce });
    const { claims, returnTo } = await telegramOidcService.handleCallback('code', state);
    expect(claims.id).toBe(777);
    expect(claims.phone_number).toBe('998901234567');
    expect(returnTo).toBe('/orders');
  });

  it('state одноразовый — повторный возврат по той же ссылке отклоняется', async () => {
    const { state, nonce } = await start();
    idToken = sign({ id: 1, nonce });
    await telegramOidcService.handleCallback('code', state);
    await expect(telegramOidcService.handleCallback('code', state)).rejects.toThrow(/истекла/);
  });

  it('отклоняет подделанную подпись и чужой audience', async () => {
    let s = await start();
    idToken = sign({ id: 1, nonce: s.nonce }, otherKey);
    await expect(telegramOidcService.handleCallback('code', s.state)).rejects.toThrow(/подпись/);

    s = await start();
    idToken = jwt.sign({ id: 1, nonce: s.nonce }, privateKey, { algorithm: 'RS256', keyid: 'k1', issuer: 'https://oauth.telegram.org', audience: '999', expiresIn: 300 });
    await expect(telegramOidcService.handleCallback('code', s.state)).rejects.toThrow(/подпись/);
  });
});

describe('telegram-oidc: вход через JS-библиотеку (id_token из браузера)', () => {
  it('принимает токен с выданным nonce и не даёт использовать его повторно', async () => {
    const nonce = await telegramOidcService.createNonce();
    const token = sign({ id: 555, name: 'Vladimir', nonce });
    const claims = await telegramOidcService.verifyClientToken(token);
    expect(claims.id).toBe(555);
    await expect(telegramOidcService.verifyClientToken(token)).rejects.toThrow(/истекла/);
  });

  it('отклоняет токен с чужим nonce, без nonce и с поддельной подписью', async () => {
    await expect(telegramOidcService.verifyClientToken(sign({ id: 1, nonce: 'not-issued' }))).rejects.toThrow(/истекла/);
    await expect(telegramOidcService.verifyClientToken(sign({ id: 1 }))).rejects.toThrow(/истекла/);
    const nonce = await telegramOidcService.createNonce();
    await expect(telegramOidcService.verifyClientToken(sign({ id: 1, nonce }, otherKey))).rejects.toThrow(/подпись/);
  });
});

describe('telegram-oidc: вход в мобильном приложении (PKCE без секрета)', () => {
  it('start выдаёт ссылку с redirect в приложение, finish обменивает код один раз', async () => {
    (globalThis as any).fetch = vi.fn(async (url: string, init?: any) => {
      if (url.includes('jwks')) return { ok: true, json: async () => ({ keys: [jwk] }) };
      if (url.includes('/crossapp')) return { ok: true, json: async () => ({ url: 'tg://oauth?token=abc' }) };
      // /token: секрет не передаётся — только PKCE
      expect(String(init?.body)).not.toContain('client_secret');
      expect(init?.headers?.Authorization).toBeUndefined();
      return { ok: true, json: async () => ({ id_token: sign({ id: 321, name: 'App User' }) }) };
    });
    const { session, tgUrl, webUrl } = await telegramOidcService.startNative();
    expect(tgUrl).toBe('tg://oauth?token=abc');
    expect(new URL(webUrl).searchParams.get('redirect_uri')).toBe('uz.masteruz.app://telegram-login');

    const claims = await telegramOidcService.finishNative(session, 'code');
    expect(claims.id).toBe(321);
    await expect(telegramOidcService.finishNative(session, 'code')).rejects.toThrow(/истекла/);
  });
});
