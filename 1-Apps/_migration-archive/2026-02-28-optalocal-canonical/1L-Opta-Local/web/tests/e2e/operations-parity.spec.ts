import { expect, test } from '@playwright/test';

import parityArtifact from '../../src/lib/capabilities/parity.generated.json';

function pickCapabilityClusters(paths: string[]): string[] {
  const withoutParams = paths.filter((path) => !path.includes('{param}'));

  const clusters: Array<(path: string) => boolean> = [
    (path) => path.startsWith('/admin/'),
    (path) => path.startsWith('/mcp/') || path.includes('/mcp/'),
    (path) => path.startsWith('/v1/chat') || path.startsWith('/v1/completions'),
    (path) => path.startsWith('/v1/models/'),
    (path) => path.startsWith('/v1/skills/'),
  ];

  return clusters
    .map((matcher) => withoutParams.find((path) => matcher(path)))
    .filter((path): path is string => Boolean(path));
}

test.describe('operations parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'opta-local:connection-settings',
        JSON.stringify({
          host: '127.0.0.1',
          port: 1234,
          adminKey: 'test-admin-key',
          useTunnel: false,
          tunnelUrl: '',
        }),
      );
    });

    await page.route('**/admin/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: 'admin-ok' }),
      });
    });

    await page.route('**/mcp/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: 'mcp-ok' }),
      });
    });

    await page.route('**/v1/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: 'v1-ok' }),
      });
    });
  });

  test('shows every in_lmx_not_dashboard capability in operations list', async ({
    page,
  }) => {
    await page.goto('/operations');

    const itemCount = await page.locator('[data-testid="operation-item"]').count();
    expect(itemCount).toBe(parityArtifact.byCategory.in_lmx_not_dashboard.length);
  });

  test('runs at least one happy-path capability per major cluster', async ({ page }) => {
    await page.goto('/operations');

    const clusterCapabilities = pickCapabilityClusters(
      parityArtifact.byCategory.in_lmx_not_dashboard,
    );

    for (const capability of clusterCapabilities) {
      await page.locator('[data-testid="operation-item"]', { hasText: capability }).first().click();
      await page.getByRole('button', { name: 'Run now' }).click();
      await expect(page.getByTestId('response-panel')).toContainText('"ok": true');
    }
  });
});
