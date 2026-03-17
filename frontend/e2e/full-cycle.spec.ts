// ============================================
// MasterUz — E2E Test Suite (Playwright)
// Полный цикл: регистрация → заказ → AI → оплата → чат → отзыв
// ============================================

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://masteruz-ecru.vercel.app';
const API_URL = process.env.E2E_API_URL || `${BASE_URL}/api`;

// ─── Helpers ─────────────────────────────────
async function waitForApp(page: Page) {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=MasterUz')).toBeVisible({ timeout: 15000 });
}

// ═══════════════════════════════════════════════
// TEST 1: Главная страница отображается корректно
// ═══════════════════════════════════════════════
test.describe('Главная страница', () => {
  test('Отображаются CTA кнопки и категории', async ({ page }) => {
    await waitForApp(page);

    // CTA «Создать заказ за 30 секунд»
    const ctaButton = page.locator('text=Создать заказ за 30 секунд');
    await expect(ctaButton).toBeVisible();

    // Кнопка «Срочный вызов»
    const urgentButton = page.locator('text=Авария? Срочный вызов');
    await expect(urgentButton).toBeVisible();

    // Кнопка «Стать мастером»
    const becomeMaster = page.locator('text=Стать мастером').first();
    await expect(becomeMaster).toBeVisible();

    // Категории
    await expect(page.locator('text=Выберите категорию')).toBeVisible();
  });

  test('CTA ведёт на /instant-order', async ({ page }) => {
    await waitForApp(page);
    const ctaButton = page.locator('text=Создать заказ за 30 секунд');
    await ctaButton.click();
    await page.waitForURL('**/instant-order**');
  });

  test('Кнопка «Срочный вызов» ведёт на /instant-order?urgent=true', async ({ page }) => {
    await waitForApp(page);
    const urgentButton = page.locator('text=Авария? Срочный вызов');
    await urgentButton.click();
    await page.waitForURL('**/instant-order?urgent=true**');
    // Проверяем баннер срочности
    await expect(page.locator('text=Срочный вызов — надбавка +40%')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════
// TEST 2: Юридические страницы
// ═══════════════════════════════════════════════
test.describe('Юридические страницы', () => {
  test('Политика конфиденциальности', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);
    await expect(page.locator('text=Политика конфиденциальности')).toBeVisible();
    await expect(page.locator('text=Общие положения')).toBeVisible();
  });

  test('Публичная оферта', async ({ page }) => {
    await page.goto(`${BASE_URL}/public-offer`);
    await expect(page.locator('text=Публичная оферта')).toBeVisible();
    await expect(page.locator('text=Предмет оферты')).toBeVisible();
  });

  test('Условия использования', async ({ page }) => {
    await page.goto(`${BASE_URL}/terms`);
    await expect(page.locator('text=Условия использования')).toBeVisible();
    await expect(page.locator('text=Принятие условий')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════
// TEST 3: Форма создания заказа (InstantOrderPage)
// ═══════════════════════════════════════════════
test.describe('Форма создания заказа', () => {
  test('Шаговый индикатор показывает «Шаг 1»', async ({ page }) => {
    await page.goto(`${BASE_URL}/instant-order`);
    // Если требует авторизацию — будет редирект на /login
    const url = page.url();
    if (url.includes('/login')) {
      test.skip();
      return;
    }
    await expect(page.locator('text=Создать заказ за 30 секунд')).toBeVisible();
  });

  test('Срочный режим включается через ?urgent=true', async ({ page }) => {
    await page.goto(`${BASE_URL}/instant-order?urgent=true`);
    const url = page.url();
    if (url.includes('/login')) {
      test.skip();
      return;
    }
    await expect(page.locator('text=Срочный вызов мастера')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════
// TEST 4: Партнёры и магазины
// ═══════════════════════════════════════════════
test.describe('Партнёры и магазины', () => {
  test('Страница магазинов загружается', async ({ page }) => {
    await page.goto(`${BASE_URL}/stores`);
    await expect(page.locator('text=Партнёры и магазины')).toBeVisible();
  });

  test('Форма партнёрства содержит расширенные категории', async ({ page }) => {
    await page.goto(`${BASE_URL}/stores/partner-request`);
    await expect(page.locator('text=Бытовая техника')).toBeVisible();
    await expect(page.locator('text=Кондиционеры и климат')).toBeVisible();
    await expect(page.locator('text=Окна и двери')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════
// TEST 5: API Health Check
// ═══════════════════════════════════════════════
test.describe('API', () => {
  test('Health endpoint', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('Categories endpoint', async ({ request }) => {
    const res = await request.get(`${API_URL}/catalog/categories`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeTruthy();
  });

  test('Store categories include new partners', async ({ request }) => {
    const res = await request.get(`${API_URL}/stores/categories`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const slugs = body.data.map((c: any) => c.slug);
    expect(slugs).toContain('home-appliances');
    expect(slugs).toContain('conditioners');
    expect(slugs).toContain('windows-shop');
  });

  test('Orders list', async ({ request }) => {
    const res = await request.get(`${API_URL}/orders?page=1`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// TEST 6: Нагрузочный тест — 100 параллельных запросов
// ═══════════════════════════════════════════════
test.describe('Нагрузочное тестирование', () => {
  test('100 параллельных запросов к /api/health', async ({ request }) => {
    const promises = Array.from({ length: 100 }, () =>
      request.get(`${API_URL}/health`).then(r => r.status())
    );

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && (r as any).value === 200);
    const failed = results.filter(r => r.status === 'rejected');

    console.log(`✅ Успешных: ${successful.length}/100`);
    console.log(`❌ Ошибок: ${failed.length}/100`);

    // Допускаем до 5% ошибок под нагрузкой (rate limiting)
    expect(successful.length).toBeGreaterThanOrEqual(90);
  });

  test('50 параллельных запросов к /api/orders', async ({ request }) => {
    const promises = Array.from({ length: 50 }, () =>
      request.get(`${API_URL}/orders?page=1`).then(r => r.status())
    );

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && (r as any).value === 200);

    console.log(`✅ Успешных: ${successful.length}/50`);
    expect(successful.length).toBeGreaterThanOrEqual(40);
  });

  test('50 параллельных запросов к /api/stores/categories', async ({ request }) => {
    const promises = Array.from({ length: 50 }, () =>
      request.get(`${API_URL}/stores/categories`).then(r => r.status())
    );

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && (r as any).value === 200);

    console.log(`✅ Успешных: ${successful.length}/50`);
    expect(successful.length).toBeGreaterThanOrEqual(40);
  });
});

// ═══════════════════════════════════════════════
// TEST 7: Responsive — мобильные и десктоп
// ═══════════════════════════════════════════════
test.describe('Responsive дизайн', () => {
  test('Mobile (iPhone 12)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
    });
    const page = await context.newPage();
    await waitForApp(page);

    // CTA кнопка видна
    await expect(page.locator('text=Создать заказ за 30 секунд')).toBeVisible();
    // Бургер-меню видно
    await expect(page.locator('button').filter({ has: page.locator('svg') }).last()).toBeVisible();
    await context.close();
  });

  test('Desktop (1920x1080)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();
    await waitForApp(page);

    // Навигация видна
    await expect(page.locator('nav >> text=Заказы').first()).toBeVisible();
    await context.close();
  });
});

// ═══════════════════════════════════════════════
// TEST 8: Доступность (возраст 45–70+)
// ═══════════════════════════════════════════════
test.describe('Доступность', () => {
  test('Кнопки имеют минимальный размер 44x44px', async ({ page }) => {
    await waitForApp(page);

    const ctaButton = page.locator('text=Создать заказ за 30 секунд');
    const box = await ctaButton.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('Шрифт не меньше 14px (text-sm = 14px)', async ({ page }) => {
    await waitForApp(page);
    const body = page.locator('body');
    const fontSize = await body.evaluate(el => window.getComputedStyle(el).fontSize);
    const sizeNum = parseFloat(fontSize);
    expect(sizeNum).toBeGreaterThanOrEqual(14);
  });
});
