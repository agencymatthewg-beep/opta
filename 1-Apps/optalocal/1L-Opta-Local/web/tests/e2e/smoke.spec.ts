import { expect, test } from '@playwright/test';

test.describe('web smoke', () => {
  test('dashboard route loads', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Dashboard', exact: true }),
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
    await expect(
      page.getByRole('heading', { name: 'Chat', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  });

  test.describe('auth-adjacent smoke', () => {
    test('sign-in honors safe next path in copy and continue link', async ({ page }) => {
      const nextPath = '/devices?view=all&from=smoke';

      await page.goto(`/sign-in?next=${encodeURIComponent(nextPath)}`);

      await expect(page.getByText('After sign-in, you will continue to')).toBeVisible();
      await expect(page.getByText(nextPath, { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Password sign-in', exact: true })).toBeVisible();
      await expect(page.getByLabel('Email or phone')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign Up', exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
      await expect(page.getByLabel('Name (optional)')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Sign in with password', exact: true }),
      ).toBeVisible();

      const continueLink = page.getByRole('link', { name: 'Continue without account' });
      await expect(continueLink).toBeVisible();
      await expect(continueLink).toHaveAttribute('href', nextPath);
    });

    test('sign-in sanitizes absolute next path to root', async ({ page }) => {
      await page.goto('/sign-in?next=https%3A%2F%2Fevil.example%2Fsteal');

      await expect(page.getByText('After sign-in, you will continue to')).toBeVisible();
      await expect(page.getByText('/', { exact: true })).toBeVisible();

      await expect(
        page.getByRole('link', { name: 'Continue without account' }),
      ).toHaveAttribute('href', '/');
    });

    test('devices route shows unauthenticated sign-in call-to-action', async ({ page }) => {
      await page.goto('/devices');

      await expect(page.getByRole('heading', { name: 'DEVICE SYNC', exact: true })).toBeVisible();

      const signInCta = page.getByRole('link', { name: 'Sign In with Opta' });
      await expect(signInCta).toBeVisible();
      await expect(signInCta).toHaveAttribute('href', '/sign-in?next=%2Fdevices');
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

      const signInUrl = new URL(signInHref!, 'http://127.0.0.1');
      expect(signInUrl.pathname).toBe('/sign-in');

      const encodedNext = signInUrl.searchParams.get('next');
      expect(encodedNext).not.toBeNull();

      const decodedNext = decodeURIComponent(encodedNext!);
      const pairNextUrl = new URL(decodedNext, 'http://127.0.0.1');

      expect(pairNextUrl.pathname).toBe('/pair');
      expect(pairNextUrl.searchParams.get('device_name')).toBe('Mono512');
      expect(pairNextUrl.searchParams.get('role')).toBe('llm_host');
      expect(pairNextUrl.searchParams.get('callback')).toBe(callback);
    });
  });
});
