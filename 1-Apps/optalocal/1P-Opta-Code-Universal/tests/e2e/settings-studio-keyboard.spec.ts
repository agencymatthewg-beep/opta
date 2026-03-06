import { expect, test, type Locator, type Page } from "@playwright/test";

const APP_SHELL_SELECTOR = ".app-shell";
const SETTINGS_LAYER3_SELECTOR = ".v1-settings-layer-3";
const SETTINGS_STUDIO_CONTENT_SELECTOR = ".opta-studio-content";
const SETTINGS_CARD_SELECTOR = ".settings-view-card[data-settings-tab-id]";
const ACTIVE_SETTINGS_CARD_SELECTOR = ".settings-view-card.is-active";
const EXPECTED_SETTINGS_CATEGORY_COUNT = 17;
const MAX_TAB_CYCLES = EXPECTED_SETTINGS_CATEGORY_COUNT * 2;
const RETURN_TO_LAYER2_KEYS = ["Tab", "Backspace"] as const;

type Layer3ReturnKey = (typeof RETURN_TO_LAYER2_KEYS)[number];

async function getAppShell(page: Page): Promise<Locator> {
  const shell = page.locator(APP_SHELL_SELECTOR);
  await expect(shell).toBeVisible();
  return shell;
}

async function getActiveLayer2TabId(page: Page): Promise<string> {
  const activeCard = page.locator(ACTIVE_SETTINGS_CARD_SELECTOR);
  await expect(activeCard).toBeVisible();
  return (await activeCard.getAttribute("data-settings-tab-id")) ?? "";
}

async function getLayer2CategoryIds(page: Page): Promise<string[]> {
  const cards = page.locator(SETTINGS_CARD_SELECTOR);
  await expect(cards).toHaveCount(EXPECTED_SETTINGS_CATEGORY_COUNT);
  const tabIds = await cards.evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute("data-settings-tab-id") ?? "")
      .filter((id) => id.length > 0),
  );
  const uniqueTabIds = [...new Set(tabIds)];
  expect(uniqueTabIds).toHaveLength(EXPECTED_SETTINGS_CATEGORY_COUNT);
  return uniqueTabIds;
}

async function openSettingsLayer2(page: Page): Promise<Locator> {
  const shell = await getAppShell(page);
  await page.keyboard.press("Control+s");
  await expect(shell).toHaveAttribute("data-settings-layer", "2");
  await expect(page.locator(ACTIVE_SETTINGS_CARD_SELECTOR)).toBeVisible();
  return shell;
}

async function openSettingsLayer3FromLayer2(page: Page, shell: Locator): Promise<void> {
  await page.keyboard.press("Enter");
  await expect(shell).toHaveAttribute("data-settings-layer", "3");
  await expect(page.getByText("Layer 3 · Category Configuration")).toBeVisible();
  await expect(page.locator(SETTINGS_LAYER3_SELECTOR)).toBeVisible();
  await expect(page.locator(SETTINGS_STUDIO_CONTENT_SELECTOR)).toBeVisible();
  await waitForLayer3InteractiveReady(page);
}

async function waitForLayer3InteractiveReady(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const content = document.querySelector(".v1-settings-layer-3 .opta-studio-content");
        if (!content) return 0;
        const candidates = Array.from(
          content.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role='button']:not([aria-disabled='true'])",
          ),
        );
        return candidates.filter((element) => {
          const style = window.getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }).length;
      }),
    )
    .toBeGreaterThan(0);
}

async function blurActiveElement(page: Page): Promise<void> {
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
}

async function dispatchWindowKeyDown(
  page: Page,
  key: string,
  code: string = key,
): Promise<void> {
  await page.evaluate(
    ({ eventKey, eventCode }) => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: eventKey,
          code: eventCode,
          bubbles: true,
        }),
      );
    },
    { eventKey: key, eventCode: code },
  );
}

async function waitForEditModeState(
  shell: Locator,
  expectedState: "true" | "false",
): Promise<void> {
  await expect
    .poll(async () => shell.getAttribute("data-settings-editing"))
    .toBe(expectedState);
}

async function enterLayer3EditMode(page: Page, shell: Locator): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await ensureSettingsLayer3Open(page, shell);
    await waitForLayer3InteractiveReady(page);
    await blurActiveElement(page);
    await dispatchWindowKeyDown(page, "Enter", "Enter");
    if ((await shell.getAttribute("data-settings-editing")) !== "true") {
      await page.keyboard.press("Enter");
    }
    try {
      await waitForEditModeState(shell, "true");
      return;
    } catch (error) {
      if (attempt === 4) throw error;
    }

    await page.keyboard.press("ArrowRight");
    await expect(shell).toHaveAttribute("data-settings-highlight", /^l3:\d+$/);
  }
  throw new Error("Could not enter Layer 3 edit mode via keyboard Enter.");
}

async function returnToLayer2FromLayer3(
  page: Page,
  shell: Locator,
  key: Layer3ReturnKey,
): Promise<void> {
  await page.keyboard.press(key);
  await expect(shell).toHaveAttribute("data-settings-layer", "2");
  await expect(page.locator(ACTIVE_SETTINGS_CARD_SELECTOR)).toBeVisible();
}

async function ensureSettingsLayer3Open(page: Page, shell: Locator): Promise<void> {
  const currentLayer = await shell.getAttribute("data-settings-layer");
  if (currentLayer === "3") return;
  if (currentLayer === "2") {
    await openSettingsLayer3FromLayer2(page, shell);
    return;
  }
  throw new Error(`Expected settings layer 2 or 3, received "${currentLayer ?? "null"}".`);
}

async function cycleLayer2HighlightToTab(
  page: Page,
  targetTabId: string,
): Promise<void> {
  for (let i = 0; i < MAX_TAB_CYCLES; i += 1) {
    const activeTabId = await getActiveLayer2TabId(page);
    if (activeTabId === targetTabId) return;
    await page.keyboard.press("Shift+ArrowRight");
    await expect
      .poll(async () => getActiveLayer2TabId(page))
      .not.toBe(activeTabId);
  }
  throw new Error(`Could not highlight "${targetTabId}" within ${MAX_TAB_CYCLES} moves.`);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(APP_SHELL_SELECTOR)).toBeVisible();
  await expect(page.getByText("Try pressing Ctrl+S")).toBeVisible();
});

test("opens settings and supports L2 highlight navigation via keyboard", async ({ page }) => {
  const shell = await openSettingsLayer2(page);
  const initialTab = await getActiveLayer2TabId(page);
  const initialHighlight = await shell.getAttribute("data-settings-highlight");

  await page.keyboard.press("ArrowRight");

  await expect
    .poll(async () => getActiveLayer2TabId(page))
    .not.toBe(initialTab);
  await expect
    .poll(async () => shell.getAttribute("data-settings-highlight"))
    .not.toBe(initialHighlight);
});

test("cycles all 17 settings categories at least once via Shift+Arrow", async ({ page }) => {
  const shell = await openSettingsLayer2(page);
  const categoryIds = await getLayer2CategoryIds(page);
  const visitedCategories = new Set<string>([await getActiveLayer2TabId(page)]);

  for (const categoryId of categoryIds) {
    await cycleLayer2HighlightToTab(page, categoryId);
    await expect.poll(async () => getActiveLayer2TabId(page)).toBe(categoryId);
    await expect(shell).toHaveAttribute("data-settings-highlight", categoryId);
    visitedCategories.add(categoryId);
  }

  expect(visitedCategories.size).toBe(EXPECTED_SETTINGS_CATEGORY_COUNT);
  expect([...visitedCategories].sort()).toEqual([...categoryIds].sort());
});

test("opens L3 from every category and returns with Tab and Backspace", async ({ page }) => {
  test.slow();
  const shell = await openSettingsLayer2(page);
  const categoryIds = await getLayer2CategoryIds(page);

  for (const categoryId of categoryIds) {
    await cycleLayer2HighlightToTab(page, categoryId);
    await expect.poll(async () => getActiveLayer2TabId(page)).toBe(categoryId);

    for (const returnKey of RETURN_TO_LAYER2_KEYS) {
      await openSettingsLayer3FromLayer2(page, shell);
      await returnToLayer2FromLayer3(page, shell, returnKey);
      await expect.poll(async () => getActiveLayer2TabId(page)).toBe(categoryId);
    }
  }
});

test("opens L3 and validates keyboard edit mode commit/cancel behavior", async ({ page }) => {
  const shell = await openSettingsLayer2(page);
  await cycleLayer2HighlightToTab(page, "permissions-safety");

  await openSettingsLayer3FromLayer2(page, shell);
  await page.keyboard.press("ArrowRight");
  await expect(shell).toHaveAttribute("data-settings-highlight", /^l3:\d+$/);
  await enterLayer3EditMode(page, shell);

  await dispatchWindowKeyDown(page, "Escape", "Escape");
  await waitForEditModeState(shell, "false");

  await ensureSettingsLayer3Open(page, shell);
  await page.keyboard.press("ArrowRight");
  await expect(shell).toHaveAttribute("data-settings-highlight", /^l3:\d+$/);
  await enterLayer3EditMode(page, shell);

  await dispatchWindowKeyDown(page, "Enter", "Enter");
  await waitForEditModeState(shell, "false");
});

test("exposes L3 highlight and indicator attributes in navigation mode", async ({ page }) => {
  const shell = await openSettingsLayer2(page);
  const categoryIds = await getLayer2CategoryIds(page);
  await cycleLayer2HighlightToTab(page, categoryIds[0] ?? "autonomy-policies");

  await openSettingsLayer3FromLayer2(page, shell);

  await expect(shell).toHaveAttribute("data-settings-layer", "3");
  await expect(shell).toHaveAttribute("data-settings-scroll-container", "layer-3");
  await expect(shell).toHaveAttribute("data-settings-editing", "false");
  await expect(shell).toHaveAttribute("data-settings-highlight", /^l3:\d+$/);

  await page.keyboard.press("ArrowRight");
  await expect(shell).toHaveAttribute("data-settings-editing", "false");
  await expect(shell).toHaveAttribute("data-settings-highlight", /^l3:\d+$/);
});

test("toggles settings fullscreen with Shift+Space shortcut", async ({ page }) => {
  const shell = await openSettingsLayer2(page);

  await expect(shell).not.toHaveClass(/settings-focus-mode/);
  await page.keyboard.press("Shift+Space");
  await expect(shell).toHaveClass(/settings-focus-mode/);
  await expect(page.locator(".settings-view--fullscreen")).toBeVisible();

  await page.keyboard.press("Shift+Space");
  await expect(shell).not.toHaveClass(/settings-focus-mode/);
  await expect(page.locator(".settings-view--fullscreen")).toHaveCount(0);
});
