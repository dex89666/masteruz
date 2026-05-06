// ============================================
// MasterUz — E2E: Consent Gate
// Прогоняет основной сценарий: модал → скролл → 3 чекбокса → submit → реестр
// ============================================

import { test, expect } from '@playwright/test';

test.describe('Consent Gate', () => {
  test.beforeEach(async ({ page }) => {
    // Чистим localStorage перед каждым тестом — гейт должен показываться
    await page.addInitScript(() => localStorage.clear());
  });

  test('блокирует доступ пока пользователь не согласился', async ({ page }) => {
    await page.goto('/');

    // Модал виден
    const modal = page.getByRole('heading', { name: /Согласие на использование платформы/i });
    await expect(modal).toBeVisible();

    // Реквизиты ООО Vladlab отображаются
    await expect(page.getByText(/Vladlab/)).toBeVisible();
    await expect(page.getByText(/313020180/)).toBeVisible();
  });

  test('кнопка «Согласен» выключена до прокрутки и проставленных чекбоксов', async ({ page }) => {
    await page.goto('/');

    const submit = page.getByRole('button', { name: /Согласен.*продолжить/i });
    await expect(submit).toBeDisabled();

    // Чекбоксы заблокированы до прокрутки
    const checkboxes = page.getByRole('checkbox');
    await expect(checkboxes.first()).toBeDisabled();
  });

  test('после прокрутки и трёх галочек согласие сохраняется', async ({ page }) => {
    await page.goto('/');

    // Прокручиваем модал-контент до конца — кнопка «Прокрутите до конца» удобно для теста
    const scrollHelper = page.getByRole('button', { name: /Прокрутите до конца/i });
    if (await scrollHelper.isVisible()) {
      await scrollHelper.click();
      // Дожидаемся завершения smooth-scroll
      await page.waitForTimeout(800);
    }

    const checkboxes = page.getByRole('checkbox');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < 3; i++) await checkboxes.nth(i).check();

    const submit = page.getByRole('button', { name: /Согласен.*продолжить/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    // Модал ушёл, главная страница доступна
    await expect(page.getByRole('heading', { name: /Согласие на использование платформы/i })).toHaveCount(0);

    // localStorage обновлён
    const stored = await page.evaluate(() => localStorage.getItem('masteruz-consent-v1'));
    expect(stored).toBeTruthy();
  });
});
