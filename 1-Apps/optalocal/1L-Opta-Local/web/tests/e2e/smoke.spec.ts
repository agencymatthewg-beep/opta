import { expect, test } from '@playwright/test';

test.describe('web smoke', () => {
  test('dashboard route loads', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Opta LMX', exact: true }),
    ).toBeVisible();
  });

  test('settings route loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(
      page.getByRole('heading', { name: 'General', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'LMX Server', exact: true }),
    ).toBeVisible();
  });

  test('chat route loads', async ({ page }) => {
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  });

  test.describe('auth-adjacent smoke', () => {
    test('sign-in redirects to Opta Accounts and preserves safe next path', async ({ page }) => {
      const nextPath = '/devices?view=all&from=smoke';

      await page.goto(`/sign-in?next=${encodeURIComponent(nextPath)}`);

      await expect(page).toHaveURL(/accounts\.optalocal\.com\/sign-in/);
      const current = new URL(page.url());
      const redirectTo = current.searchParams.get('redirect_to');
      expect(redirectTo).not.toBeNull();

      const decoded = new URL(decodeURIComponent(redirectTo!));
      expect(decoded.pathname).toBe('/devices');
      expect(decoded.searchParams.get('view')).toBe('all');
      expect(decoded.searchParams.get('from')).toBe('smoke');
    });

    test('sign-in sanitizes absolute next path to root before accounts redirect', async ({ page }) => {
      await page.goto('/sign-in?next=https%3A%2F%2Fevil.example%2Fsteal');

      await expect(page).toHaveURL(/accounts\.optalocal\.com\/sign-in/);
      const current = new URL(page.url());
      const redirectTo = current.searchParams.get('redirect_to');
      expect(redirectTo).not.toBeNull();

      const decoded = new URL(decodeURIComponent(redirectTo!));
      expect(decoded.pathname).toBe('/');
      expect(decoded.search).toBe('');
    });

    test('devices route shows unauthenticated sign-in call-to-action', async ({ page }) => {
      await page.goto('/devices');

      await expect(page.getByRole('heading', { name: 'DEVICE SYNC', exact: true })).toBeVisible();

      const signInCta = page.getByRole('link', { name: 'Sign In with Opta' });
      await expect(signInCta).toBeVisible();
      const href = await signInCta.getAttribute('href');
      expect(href).not.toBeNull();
      expect(href!).toMatch(/^https:\/\/accounts\.optalocal\.com\/sign-in\?redirect_to=/);
    });

    test('pair route sign-in link preserves next context including callback', async ({
      page,
    }) => {
      const callback = 'http://localhost:9876/pair-callback?nonce=abc123';
      const pairParams = new URLSearchParams({
        device_name: 'Mono512',
        role: 'llm_host',
        hostname: 'Mono512.local',
        lan_ip: '192.168.188.11',
        lan_port: '1234',
        callback,
      });

      await page.goto(`/pair?${pairParams.toString()}`);

      await expect(
        page.getByRole('heading', { name: 'Sign in to pair Mono512', exact: true }),
      ).toBeVisible();

      const signInLink = page.getByRole('link', { name: 'Sign In to Continue' });
      await expect(signInLink).toBeVisible();

      const signInHref = await signInLink.getAttribute('href');
      expect(signInHref).not.toBeNull();

      const signInUrl = new URL(signInHref!);
      expect(signInUrl.origin).toBe('https://accounts.optalocal.com');
      expect(signInUrl.pathname).toBe('/sign-in');

      const redirectTo = signInUrl.searchParams.get('redirect_to');
      expect(redirectTo).not.toBeNull();

      const pairNextUrl = new URL(decodeURIComponent(redirectTo!));
      expect(pairNextUrl.pathname).toBe('/pair');
      expect(pairNextUrl.searchParams.get('device_name')).toBe('Mono512');
      expect(pairNextUrl.searchParams.get('role')).toBe('llm_host');
      expect(pairNextUrl.searchParams.get('callback')).toBe(callback);
    });
  });
});
