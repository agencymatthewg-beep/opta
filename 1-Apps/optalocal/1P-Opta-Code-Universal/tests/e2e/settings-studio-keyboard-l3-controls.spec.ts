import { expect, test, type Locator, type Page } from "@playwright/test";

const APP_SHELL_SELECTOR = ".app-shell";
const SETTINGS_LAYER3_SELECTOR = ".v1-settings-layer-3";
const ACTIVE_SETTINGS_CARD_SELECTOR = ".settings-view-card.is-active";
const EXPECTED_SETTINGS_CATEGORY_COUNT = 17;
const MAX_TAB_CYCLES = EXPECTED_SETTINGS_CATEGORY_COUNT * 2;

type TargetKind = "numeric" | "permission";

async function getAppShell(page: Page): Promise<Locator> {
  const shell = page.locator(APP_SHELL_SELECTOR);
  await expect(shell).toBeVisible({ timeout: 20_000 });
  return shell;
}

async function getActiveLayer2TabId(page: Page): Promise<string> {
  const activeCard = page.locator(ACTIVE_SETTINGS_CARD_SELECTOR);
  await expect(activeCard).toBeVisible();
  return (await activeCard.getAttribute("data-settings-tab-id")) ?? "";
}

async function openSettingsLayer2(page: Page): Promise<Locator> {
  const shell = await getAppShell(page);
  await page.keyboard.press("Control+Shift+s");
  await expect(shell).toHaveAttribute("data-settings-layer", "2");
  return shell;
}

async function cycleLayer2HighlightToTab(
  page: Page,
  targetTabId: string,
): Promise<void> {
  for (let i = 0; i < MAX_TAB_CYCLES; i += 1) {
    const activeTabId = await getActiveLayer2TabId(page);
    if (activeTabId === targetTabId) return;
    await page.keyboard.press("Shift+ArrowRight");
    await expect.poll(async () => getActiveLayer2TabId(page)).not.toBe(activeTabId);
  }
  throw new Error(`Could not highlight "${targetTabId}" within ${MAX_TAB_CYCLES} moves.`);
}

async function waitForLayer3InteractiveReady(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
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
      { timeout: 10_000 },
    )
    .toBeGreaterThan(0);
}

async function openSettingsLayer3ForTab(
  page: Page,
  tabId: string,
): Promise<Locator> {
  const shell = await openSettingsLayer2(page);
  await cycleLayer2HighlightToTab(page, tabId);
  await expect.poll(async () => getActiveLayer2TabId(page)).toBe(tabId);
  await page.keyboard.press("Enter");
  await expect(shell).toHaveAttribute("data-settings-layer", "3");
  await expect(page.locator(SETTINGS_LAYER3_SELECTOR)).toBeVisible();
  await waitForLayer3InteractiveReady(page);
  return shell;
}

async function blurActiveElement(page: Page): Promise<void> {
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
}

async function waitForEditModeState(
  shell: Locator,
  expectedState: "true" | "false",
  timeout: number = 5_000,
): Promise<void> {
  await expect
    .poll(async () => shell.getAttribute("data-settings-editing"), { timeout })
    .toBe(expectedState);
}

async function ensureLayer3(shell: Locator, page: Page): Promise<void> {
  const layer = await shell.getAttribute("data-settings-layer");
  if (layer === "3") return;
  if (layer === "2") {
    await page.keyboard.press("Space");
    await expect(shell).toHaveAttribute("data-settings-layer", "3");
    return;
  }
  throw new Error(`Expected Layer 3, received layer "${layer ?? "unknown"}".`);
}

async function getFirstInteractiveIndexByKind(
  page: Page,
  kind: TargetKind,
): Promise<number> {
  const index = await page.evaluate((requestedKind) => {
    const content = document.querySelector(".v1-settings-layer-3 .opta-studio-content");
    if (!content) return -1;
    const candidates = Array.from(
      content.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role='button']:not([aria-disabled='true'])",
      ),
    ).filter((element) => {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    if (requestedKind === "numeric") {
      return candidates.findIndex(
        (element) =>
          element instanceof HTMLInputElement &&
          (element.type === "number" || element.type === "range"),
      );
    }

    return candidates.findIndex(
      (element) =>
        element instanceof HTMLButtonElement &&
        element.classList.contains("st-perm-pill"),
    );
  }, kind);

  if (index < 0) {
    throw new Error(`Could not find a visible L3 interactive ${kind} target.`);
  }
  return index;
}

async function getHighlightedL3Index(shell: Locator): Promise<number> {
  const attr = (await shell.getAttribute("data-settings-highlight")) ?? "";
  const match = /^l3:(\d+)$/.exec(attr);
  if (!match) return -1;
  return Number.parseInt(match[1] ?? "-1", 10);
}

async function moveLayer3HighlightToIndex(
  page: Page,
  shell: Locator,
  targetIndex: number,
): Promise<void> {
  await expect(shell).toHaveAttribute("data-settings-layer", "3");

  const planPath = async (
    startIndex: number,
    endIndex: number,
  ): Promise<Array<"ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown">> =>
    page.evaluate(({ start, end }) => {
      const content = document.querySelector(".v1-settings-layer-3 .opta-studio-content");
      if (!content) return [];
      const candidates = Array.from(
        content.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role='button']:not([aria-disabled='true'])",
        ),
      ).filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!candidates.length) return [];
      if (start < 0 || start >= candidates.length) return [];
      if (end < 0 || end >= candidates.length) return [];
      if (start === end) return [];

      const centers = candidates.map((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      });

      const nextFor = (
        currentIndex: number,
        direction: "left" | "right" | "up" | "down",
      ): number => {
        const current = centers[currentIndex];
        if (!current) return currentIndex;
        let bestIndex = -1;
        let bestScore = Number.POSITIVE_INFINITY;

        centers.forEach((candidate, index) => {
          if (index === currentIndex) return;
          const dx = candidate.x - current.x;
          const dy = candidate.y - current.y;

          if (direction === "left" && dx >= -4) return;
          if (direction === "right" && dx <= 4) return;
          if (direction === "up" && dy >= -4) return;
          if (direction === "down" && dy <= 4) return;

          const primary = direction === "left" || direction === "right"
            ? Math.abs(dx)
            : Math.abs(dy);
          const secondary = direction === "left" || direction === "right"
            ? Math.abs(dy)
            : Math.abs(dx);
          const score = primary + secondary * 0.55;
          if (score < bestScore) {
            bestScore = score;
            bestIndex = index;
          }
        });

        if (bestIndex >= 0) return bestIndex;
        if (direction === "left" || direction === "up") {
          return (currentIndex - 1 + centers.length) % centers.length;
        }
        return (currentIndex + 1) % centers.length;
      };

      const directions = [
        { key: "ArrowLeft", dir: "left" as const },
        { key: "ArrowRight", dir: "right" as const },
        { key: "ArrowUp", dir: "up" as const },
        { key: "ArrowDown", dir: "down" as const },
      ];

      const queue: number[] = [start];
      const visited = new Set<number>([start]);
      const parent = new Map<number, number>();
      const via = new Map<number, "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown">();

      while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined) break;
        if (current === end) break;

        directions.forEach(({ key, dir }) => {
          const next = nextFor(current, dir);
          if (visited.has(next)) return;
          visited.add(next);
          parent.set(next, current);
          via.set(next, key);
          queue.push(next);
        });
      }

      if (!visited.has(end)) return [];

      const path: Array<"ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"> = [];
      let cursor = end;
      while (cursor !== start) {
        const move = via.get(cursor);
        const previous = parent.get(cursor);
        if (!move || previous === undefined) return [];
        path.push(move);
        cursor = previous;
      }
      path.reverse();
      return path;
    }, { start: startIndex, end: endIndex });

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = await getHighlightedL3Index(shell);
    if (current === targetIndex) return;
    const path = await planPath(current, targetIndex);
    if (!path.length) break;
    for (const key of path) {
      await page.keyboard.press(key);
    }
    if ((await getHighlightedL3Index(shell)) === targetIndex) return;
  }

  for (let i = 0; i < 160; i += 1) {
    const current = await getHighlightedL3Index(shell);
    if (current === targetIndex) return;
    const fallbackKey = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"][
      i % 4
    ] as "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";
    await page.keyboard.press(fallbackKey);
  }

  throw new Error(`Could not move L3 highlight to index ${targetIndex}.`);
}

async function getActiveEditingKind(page: Page): Promise<TargetKind | "other"> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement &&
      (active.type === "number" || active.type === "range")
    ) {
      return "numeric" as const;
    }
    if (
      active instanceof HTMLButtonElement &&
      active.classList.contains("st-perm-pill")
    ) {
      return "permission" as const;
    }

    const editingTarget =
      document.querySelector<HTMLElement>("[data-opta-nav-editing='true']") ??
      document.querySelector<HTMLElement>(".opta-setting-editing");
    if (!editingTarget) return "other" as const;
    if (
      editingTarget.matches("input[type='number'], input[type='range']") ||
      editingTarget.querySelector("input[type='number'], input[type='range']")
    ) {
      return "numeric" as const;
    }
    if (
      editingTarget.matches("button.st-perm-pill") ||
      editingTarget.querySelector("button.st-perm-pill")
    ) {
      return "permission" as const;
    }
    return "other" as const;
  });
}

async function enterEditModeForKind(
  page: Page,
  shell: Locator,
  kind: TargetKind,
): Promise<number> {
  await ensureLayer3(shell, page);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await ensureLayer3(shell, page);
    await waitForLayer3InteractiveReady(page);
    const targetIndex = await getFirstInteractiveIndexByKind(page, kind);
    await moveLayer3HighlightToIndex(page, shell, targetIndex);
    await blurActiveElement(page);

    await page.keyboard.press("Enter");
    let enteredEditMode = false;
    try {
      await waitForEditModeState(shell, "true", 1_250);
      enteredEditMode = true;
    } catch {
      await page.keyboard.press("Enter");
      try {
        await waitForEditModeState(shell, "true", 1_250);
        enteredEditMode = true;
      } catch {
        enteredEditMode = false;
      }
    }

    if (!enteredEditMode) {
      if (attempt === 7) {
        throw new Error(`Unable to enter edit mode for ${kind} target.`);
      }
      continue;
    }

    const editingKind = await getActiveEditingKind(page);
    if (editingKind === kind) return targetIndex;

    await page.keyboard.press("Escape");
    await waitForEditModeState(shell, "false");
    await ensureLayer3(shell, page);
    await page.keyboard.press("ArrowRight");
  }
  throw new Error(`Unable to enter ${kind} edit mode in Layer 3.`);
}

async function getNumericStateAtInteractiveIndex(
  page: Page,
  index: number,
): Promise<{
  value: number;
  min: number;
  max: number;
}> {
  const state = await page.evaluate((targetIndex) => {
    const content = document.querySelector(".v1-settings-layer-3 .opta-studio-content");
    if (!content) return null;
    const candidates = Array.from(
      content.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role='button']:not([aria-disabled='true'])",
      ),
    ).filter((element) => {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const target = candidates[targetIndex];
    if (!target) return null;
    const resolved =
      target instanceof HTMLInputElement &&
      (target.type === "number" || target.type === "range")
        ? target
        : target.querySelector<HTMLInputElement>("input[type='number'], input[type='range']");
    if (!resolved) return null;

    const value = Number.parseFloat(resolved.value || "0");
    const minParsed = Number.parseFloat(resolved.min);
    const maxParsed = Number.parseFloat(resolved.max);

    return {
      value,
      min: Number.isFinite(minParsed) ? minParsed : value,
      max: Number.isFinite(maxParsed) ? maxParsed : value,
    };
  }, index);

  if (!state) {
    throw new Error(`Unable to resolve numeric state for interactive index ${index}.`);
  }

  return state;
}

async function getNumericValueAtInteractiveIndex(
  page: Page,
  index: number,
): Promise<number> {
  const value = await page.evaluate((targetIndex) => {
    const content = document.querySelector(".v1-settings-layer-3 .opta-studio-content");
    if (!content) return null;

    const candidates = Array.from(
      content.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role='button']:not([aria-disabled='true'])",
      ),
    ).filter((element) => {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    const target = candidates[targetIndex];
    if (!target) return null;
    const numericInput =
      target instanceof HTMLInputElement &&
      (target.type === "number" || target.type === "range")
        ? target
        : target.querySelector<HTMLInputElement>("input[type='number'], input[type='range']");
    if (!numericInput) return null;
    const parsed = Number.parseFloat(numericInput.value || "0");
    return Number.isFinite(parsed) ? parsed : null;
  }, index);

  if (value === null) {
    throw new Error(`Unable to read numeric value for interactive index ${index}.`);
  }
  return value;
}

async function getActivePermissionChoiceState(page: Page): Promise<{
  index: number;
  last: number;
}> {
  const state = await page.evaluate(() => {
    const content = document.querySelector(".v1-settings-layer-3 .opta-studio-content");
    if (!content) return null;

    const editingTarget = document.querySelector<HTMLElement>(
      "button.st-perm-pill[data-opta-nav-editing='true'], button.st-perm-pill.opta-setting-editing",
    );
    const active = document.activeElement;
    const target =
      editingTarget instanceof HTMLButtonElement && editingTarget.classList.contains("st-perm-pill")
        ? editingTarget
        : active instanceof HTMLButtonElement && active.classList.contains("st-perm-pill")
          ? active
          : null;
    if (!target) return null;
    const group = target.closest(".st-perm-pills");
    if (!group) return null;
    const groupButtons = Array.from(
      group.querySelectorAll<HTMLButtonElement>("button.st-perm-pill:not([disabled])"),
    );
    if (!groupButtons.length) return null;
    const index = groupButtons.indexOf(target);
    if (index < 0) return null;
    return {
      index,
      last: groupButtons.length - 1,
    };
  });

  if (!state) {
    throw new Error("Unable to resolve active permission choice state.");
  }
  return state;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto("/");
  await expect(page.locator(APP_SHELL_SELECTOR)).toBeVisible({ timeout: 20_000 });
});

test("L3 numeric controls support keyboard adjust and commit flow", async ({
  page,
}) => {
  const shell = await openSettingsLayer3ForTab(page, "tools-agents-learning");
  const numericIndex = await enterEditModeForKind(page, shell, "numeric");

  const initial = await getNumericStateAtInteractiveIndex(page, numericIndex);
  const canIncrease = initial.value < initial.max;
  const canDecrease = initial.value > initial.min;
  if (!canIncrease && !canDecrease) {
    throw new Error("Selected numeric setting is not adjustable.");
  }

  await page.keyboard.press(canIncrease ? "ArrowUp" : "ArrowDown");
  await expect
    .poll(async () => (await getNumericStateAtInteractiveIndex(page, numericIndex)).value)
    .not.toBe(initial.value);

  const changed = await getNumericStateAtInteractiveIndex(page, numericIndex);
  await page.keyboard.press("Enter");
  await waitForEditModeState(shell, "false");
  await expect(shell).toHaveAttribute("data-settings-layer", "3");
  const postCommitValue = await getNumericValueAtInteractiveIndex(page, numericIndex);
  expect(Number.isFinite(postCommitValue)).toBe(true);
  expect(postCommitValue).toBeGreaterThanOrEqual(initial.min);
  expect(postCommitValue).toBeLessThanOrEqual(initial.max);
  expect(Number.isFinite(changed.value)).toBe(true);
});

test("L3 choice controls clamp on keyboard boundaries in edit mode", async ({ page }) => {
  const shell = await openSettingsLayer3ForTab(page, "permissions-safety");
  await enterEditModeForKind(page, shell, "permission");
  const bounds = await getActivePermissionChoiceState(page);

  await page.keyboard.press("Home");
  await expect
    .poll(async () => (await getActivePermissionChoiceState(page)).index)
    .toBe(0);

  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(async () => (await getActivePermissionChoiceState(page)).index)
    .toBe(0);

  for (let i = 0; i < bounds.last + 2; i += 1) {
    await page.keyboard.press("ArrowRight");
  }
  await expect
    .poll(async () => (await getActivePermissionChoiceState(page)).index)
    .toBe(bounds.last);

  await page.keyboard.press("Enter");
  await waitForEditModeState(shell, "false");
});

test("L3 pointer-to-keyboard handoff keeps a single highlight target", async ({
  page,
}) => {
  await openSettingsLayer3ForTab(page, "mcp-integrations");

  const getLayer3NavMode = async (): Promise<string | null> =>
    page.evaluate(() => {
      const layers = Array.from(
        document.querySelectorAll<HTMLElement>(".v1-settings-layer-3"),
      );
      const activeLayer = layers.at(-1) ?? null;
      return activeLayer?.getAttribute("data-opta-nav-input-mode") ?? null;
    });

  const getLayer3HighlightCount = async (): Promise<number> =>
    page.evaluate(
      () =>
        document.querySelectorAll(
          ".v1-settings-layer-3 .opta-setting-highlighted, .v1-settings-layer-3 [data-opta-nav-highlight='true']",
        ).length,
    );

  const hasTypingControlFocused = async (): Promise<boolean> =>
    page.evaluate(() => {
      const active = document.activeElement;
      return (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      );
    });

  await page.keyboard.press("ArrowDown");
  await expect.poll(getLayer3NavMode).toBe("keyboard");
  await expect.poll(getLayer3HighlightCount).toBe(1);

  const firstCheckbox = page
    .locator(".v1-settings-layer-3 .st-checkbox-label input[type='checkbox']")
    .first();
  await expect(firstCheckbox).toBeVisible();
  await firstCheckbox.click();

  await expect.poll(getLayer3NavMode).toBe("pointer");
  await expect.poll(getLayer3HighlightCount).toBe(0);

  await page.keyboard.press("ArrowDown");

  await expect.poll(getLayer3NavMode).toBe("keyboard");
  await expect.poll(getLayer3HighlightCount).toBe(1);
  await expect.poll(hasTypingControlFocused).toBe(false);
});
