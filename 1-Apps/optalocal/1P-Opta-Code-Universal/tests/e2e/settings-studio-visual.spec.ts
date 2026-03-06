import {
  expect,
  test,
  type Locator,
  type Page,
  type ViewportSize,
} from "@playwright/test";

const APP_SHELL_SELECTOR = ".app-shell";
const SETTINGS_LAYER2_SELECTOR = ".v1-settings-layer-2";
const SETTINGS_VIEW_SELECTOR = ".v1-settings-layer-2 .settings-view";
const SETTINGS_FULLSCREEN_SELECTOR = ".v1-settings-layer-2 .settings-view--fullscreen";
const SETTINGS_CARD_SELECTOR = ".settings-view-card[data-settings-tab-id]";
const EXPECTED_SETTINGS_CATEGORY_COUNT = 17;

const VIEWPORTS: ReadonlyArray<{ name: string; size: ViewportSize }> = [
  { name: "desktop", size: { width: 1728, height: 1117 } },
  { name: "laptop", size: { width: 1440, height: 900 } },
];

test.describe.configure({ mode: "serial" });

async function disableVisualMotion(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
      }

      .settings-view-card,
      .settings-view-card:hover,
      .settings-view-card.is-active,
      .settings-view-card:focus-visible {
        transform: none !important;
      }
    `,
  });
}

async function waitForStableBoundingBox(target: Locator): Promise<void> {
  let previous = "";
  let stableSamples = 0;

  for (let sample = 0; sample < 24; sample += 1) {
    const box = await target.boundingBox();
    if (!box) {
      throw new Error("Settings overlay target disappeared before screenshot capture.");
    }

    const current = [box.x, box.y, box.width, box.height]
      .map((value) => Math.round(value))
      .join(",");

    if (current === previous) {
      stableSamples += 1;
      if (stableSamples >= 2) return;
    } else {
      stableSamples = 0;
      previous = current;
    }

    await target.page().waitForTimeout(80);
  }

  throw new Error("Settings overlay did not reach a stable layout in time.");
}

async function waitForSettingsRenderStability(
  page: Page,
  overlay: Locator,
): Promise<void> {
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await document.fonts.ready;
    }
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await waitForStableBoundingBox(overlay);
}

async function openSettingsOverlay(
  page: Page,
  viewport: ViewportSize,
): Promise<{ shell: Locator; overlay: Locator }> {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto("/");
  await disableVisualMotion(page);

  const shell = page.locator(APP_SHELL_SELECTOR);
  await expect(shell).toBeVisible({ timeout: 15_000 });

  await page.keyboard.press("Control+Shift+s");
  await expect(shell).toHaveAttribute("data-settings-layer", "2");

  const overlay = page.locator(SETTINGS_LAYER2_SELECTOR);
  await expect(overlay).toBeVisible();
  await expect(page.locator(SETTINGS_VIEW_SELECTOR)).toBeVisible();
  await expect(page.locator(SETTINGS_CARD_SELECTOR)).toHaveCount(
    EXPECTED_SETTINGS_CATEGORY_COUNT,
  );

  await waitForSettingsRenderStability(page, overlay);
  return { shell, overlay };
}

async function expectSettingsOverlayScreenshot(
  overlay: Locator,
  fileName: string,
): Promise<void> {
  await expect(overlay).toHaveScreenshot(fileName, {
    animations: "disabled",
    caret: "hide",
    scale: "css",
    maxDiffPixels: 10000,
  });
}

for (const { name, size } of VIEWPORTS) {
  test(`settings studio visual baseline (windowed) - ${name}`, async ({ page }) => {
    const { overlay } = await openSettingsOverlay(page, size);
    await expect(page.locator(SETTINGS_FULLSCREEN_SELECTOR)).toHaveCount(0);
    await expectSettingsOverlayScreenshot(
      overlay,
      `settings-studio-${name}-windowed.png`,
    );
  });

  test(`settings studio visual baseline (fullscreen) - ${name}`, async ({ page }) => {
    const { shell, overlay } = await openSettingsOverlay(page, size);

    await page.keyboard.press("Shift+Space");
    await expect(shell).toHaveClass(/settings-focus-mode/);
    await expect(overlay).toHaveClass(/v1-settings-overlay-expanded/);
    await expect(page.locator(SETTINGS_FULLSCREEN_SELECTOR)).toBeVisible();

    await waitForSettingsRenderStability(page, overlay);
    await expectSettingsOverlayScreenshot(
      overlay,
      `settings-studio-${name}-fullscreen.png`,
    );
  });
}
