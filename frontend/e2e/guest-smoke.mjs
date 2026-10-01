// Обход сайта гостем: куда ведёт каждый адрес без входа, ошибки страницы, скриншоты.
// node e2e/guest-smoke.mjs [baseUrl] [папка для скриншотов]
import { chromium } from '@playwright/test';

const BASE = process.argv[2] || 'https://masteruz-frontend-production.up.railway.app';
const OUT = process.argv[3] || './guest-shots';
const PATHS = ['/', '/catalog/plumbing', '/masters/3a5dda1d-da53-4aaf-aa13-8c5666b6ee3e', '/masters', '/stores', '/about', '/support', '/careers',
  '/complaint', '/calculator', '/privacy', '/terms', '/public-offer', '/download', '/login',
  '/orders', '/forum', '/turnkey', '/map', '/cart', '/new-order', '/profile'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));

// Согласие уже дано (окно согласия проверяет consent-gate.spec.ts) — версия из ConsentGate.tsx
await page.addInitScript(() => localStorage.setItem('masteruz-consent-v5',
  JSON.stringify({ version: '2026-05-08-legal', acceptedAt: new Date().toISOString() })));

// Первый мастер — для проверки карточки мастера
let masterPath = null;
for (const p of PATHS) {
  errors.length = 0;
  await page.goto(BASE + p, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(800);
  const final = new URL(page.url()).pathname;
  if (p === '/masters') {
    const href = await page.locator('a[href^="/masters/"]').first().getAttribute('href').catch(() => null);
    masterPath = href;
  }
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 70);
  await page.screenshot({ path: `${OUT}/${(p.slice(1) || 'home').replace(/\//g, '_')}.png` });
  console.log(`${final === p ? 'ОТКРЫТА ' : 'ВХОД    '} ${p.padEnd(20)} → ${final.padEnd(10)} ${errors.length ? 'ОШИБКИ: ' + errors.join(' | ').slice(0, 120) : ''}  «${text}»`);
}
console.log('карточка мастера:', masterPath);
await browser.close();
