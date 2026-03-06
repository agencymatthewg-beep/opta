import { expect, test } from "@playwright/test";

test("boots and supports core shell + settings interactions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("OPTA CODE")).toBeVisible();
  await expect(page.getByRole("button", { name: /menu/i })).toBeVisible();
  await expect(page.locator(".project-pane")).toBeVisible();
  await expect(page.locator(".v1-center")).toBeVisible();

  await page.keyboard.press("Control+Shift+s");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-settings-layer", "2");
  await expect(page.locator(".v1-settings-layer-2 .settings-view-card").first()).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-settings-layer", "3");
  await expect(page.getByText("Layer 3 · Category Configuration")).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-settings-layer", "2");

  await page.keyboard.press("Escape");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-settings-layer", "1");

  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: /command palette/i }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: /command palette/i }),
  ).not.toBeVisible();
});
