import {
  expect,
  hasSupabaseAuthFixtureConfig,
  missingSupabaseAuthFixtureVars,
  test,
} from './fixtures/supabase-auth';

test.describe('authenticated devices and pairing', () => {
  test.skip(
    !hasSupabaseAuthFixtureConfig(),
    `Missing Supabase auth fixture vars: ${missingSupabaseAuthFixtureVars().join(', ')}`,
  );

  test('devices route shows signed-in registry state', async ({ page }) => {
    await page.goto('/devices');

    await expect(page.getByRole('heading', { name: 'My Devices', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register Device', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign In with Opta' })).toHaveCount(0);
  });

  test('pair route claims a signed-in workstation successfully', async ({ page }) => {
    const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const deviceName = `E2E-Workstation-${uniqueSuffix}`;
    const pairParams = new URLSearchParams({
      device_name: deviceName,
      role: 'workstation',
      hostname: `${deviceName}.local`,
      lan_ip: '192.168.188.77',
      lan_port: '1234',
    });

    // Keep auth real, but stabilize pairing success even when the shared
    // Supabase project schema does not include a `devices` table.
    await page.route('**/rest/v1/devices*', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: 'device-e2e-existing' }),
        });
        return;
      }

      if (method === 'PATCH' || method === 'POST') {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: 'device-e2e-existing' }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto(`/pair?${pairParams.toString()}`);

    await expect(page.getByRole('heading', { name: `Pair ${deviceName}` })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Claim Device', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Claim Device', exact: true }).click();

    await expect(page.getByText('Device registered')).toBeVisible();
    await expect(page.getByText(`${deviceName} is linked to your account.`)).toBeVisible();
    await expect(page.getByText('Device ID')).toBeVisible();
  });
});
