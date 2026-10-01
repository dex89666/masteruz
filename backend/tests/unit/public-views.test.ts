// ============================================
// MasterUz — Unit Tests: публичные представления мастера и заказа
// /users/masters/search, /users/master/:id и /orders открыты без входа
// ============================================

import { describe, it, expect } from 'vitest';
import { toPublicMaster } from '../../src/modules/users/publicMaster.js';
import { stripOrderAccounts, toAnonymousOrder } from '../../src/modules/orders/publicOrder.js';

const account = () => ({
  id: 'u1',
  telegramId: 123456789n,
  username: 'someone',
  phone: '+998901234567',
  email: 'a@b.uz',
  balance: 1000,
  referralCode: 'REF',
  riskScore: 40,
  riskFactors: { x: 1 },
  role: 'MASTER',
  isVerified: true,
  profile: {
    firstName: 'Иван', lastName: 'И', avatarUrl: '/a.jpg', bio: 'bio', city: 'Ташкент',
    district: 'Юнусабад', address: 'ул. Домашняя, 1', latitude: 41.3, longitude: 69.2,
  },
});

describe('toPublicMaster', () => {
  const master = toPublicMaster({
    ...account(),
    isPro: true,
    masterProfile: { rating: 4.9, registrationPaid: true, masterCategories: [] },
    reviewsReceived: [{ id: 'r1', rating: 5, comment: 'ok', reviewerId: 'c1', reviewer: account() }],
  });

  it('не отдаёт контакты и служебные поля', () => {
    for (const k of ['telegramId', 'username', 'phone', 'email', 'balance', 'referralCode', 'riskScore', 'riskFactors']) {
      expect(master).not.toHaveProperty(k);
    }
    expect(master.profile).not.toHaveProperty('address');
    expect(master.profile).not.toHaveProperty('latitude');
    expect(master.masterProfile).not.toHaveProperty('registrationPaid');
  });

  it('оставляет то, что видно на карточке', () => {
    expect(master).toMatchObject({ id: 'u1', isVerified: true, isPro: true });
    expect(master.profile).toMatchObject({ firstName: 'Иван', city: 'Ташкент' });
    expect(master.masterProfile.rating).toBe(4.9);
  });

  it('рецензент — только имя и аватар', () => {
    expect(master.reviewsReceived[0].reviewer).toEqual({ id: 'u1', profile: { firstName: 'Иван', avatarUrl: '/a.jpg' } });
    expect(master.reviewsReceived[0]).not.toHaveProperty('reviewerId');
  });
});

describe('заказ', () => {
  const order = () => ({
    id: 'o1', status: 'PUBLISHED', title: 'Течёт кран', city: 'Ташкент', district: 'Юнусабад',
    address: 'ул. Домашняя, 1', street: 'Домашняя', latitude: 41.3, longitude: 69.2, adminComment: 'внутреннее',
    client: account(), master: account(), responses: [{ id: 'x', master: account() }],
  });

  it('вошедшим: без служебных полей аккаунтов, адрес остаётся', () => {
    const o: any = stripOrderAccounts(order());
    expect(o.client).not.toHaveProperty('telegramId');
    expect(o.client).not.toHaveProperty('balance');
    expect(o.responses[0].master).not.toHaveProperty('riskScore');
    expect(o).not.toHaveProperty('adminComment');
    expect(o.address).toBe('ул. Домашняя, 1');
  });

  it('гостю: без адреса, координат и данных людей', () => {
    const o = toAnonymousOrder(order());
    for (const k of ['address', 'street', 'latitude', 'longitude', 'adminComment']) expect(o).not.toHaveProperty(k);
    expect(o).toMatchObject({ city: 'Ташкент', district: 'Юнусабад', title: 'Течёт кран' });
    expect(o.client).toEqual({ id: 'u1', profile: { firstName: 'Иван', avatarUrl: '/a.jpg' } });
    expect(o.responses).toBeUndefined();
  });
});
