import { expect, test } from "@playwright/test";

test("boots and supports basic shell interactions", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Opta Code Desktop" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sessions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Models" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Operations" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Jobs" })).toBeVisible();

  await page.getByRole("button", { name: "Models" }).click();
  await expect(
    page.getByRole("heading", { name: "LMX Inference Server" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Operations" }).click();
  await expect(
    page.getByRole("heading", { name: "Operations Console" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Jobs" }).click();
  await expect(
    page.getByRole("heading", { name: "Background Jobs" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Sessions" }).click();
  await expect(page.getByText("Session timeline")).toBeVisible();

  await page.getByRole("button", { name: "Hide Runtime" }).click();
  await expect(page.getByText("Runtime hidden")).toBeVisible();
  await page.getByRole("button", { name: "Show Runtime" }).click();
  await expect(page.getByText("Runtime visible")).toBeVisible();

  await page.getByRole("button", { name: /Palette \(Cmd\/Ctrl\+K\)/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Command palette" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(
    page.getByRole("dialog", { name: "Command palette" }),
  ).not.toBeVisible();
});
