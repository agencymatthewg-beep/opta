import { expect, test } from '@playwright/test';

test.describe('codex simplicity smoke', () => {
  test('dashboard uses mobile-safe dense layout and visible primary action', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasOverflow).toBe(false);

    await expect(page.locator('.codex-primary-btn').first()).toBeVisible();
  });

  test('chat and sessions expose first action without deep scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/chat');
    await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Prompt' })).toBeVisible();

    await page.goto('/sessions');
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });
});
