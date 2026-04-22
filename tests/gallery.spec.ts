import { test, expect } from "@playwright/test";
import { injectNostrExtension } from "./helpers";

test.describe("@gallery static", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery");
    await page.waitForTimeout(2000);
  });

  test("gallery page loads with correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/Gallery/);
  });

  test("shows gallery header", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Gallery", exact: true }),
    ).toBeVisible();
  });

  test("shows Add Photo button", async ({ page }) => {
    await expect(page.getByTestId("add-photo-btn")).toBeVisible();
  });

  test("Add Photo opens upload modal", async ({ page }) => {
    await page.getByTestId("add-photo-btn").click();
    await expect(page.getByTestId("upload-modal")).toBeVisible();
  });

  test("upload modal closes on Cancel", async ({ page }) => {
    await page.getByTestId("add-photo-btn").click();
    await expect(page.getByTestId("upload-modal")).toBeVisible();
    await page.getByTestId("upload-cancel").click();
    await expect(page.getByTestId("upload-modal")).not.toBeVisible();
  });

  test("upload modal closes on backdrop click", async ({ page }) => {
    await page.getByTestId("add-photo-btn").click();
    await expect(page.getByTestId("upload-modal")).toBeVisible();
    await page
      .locator('[data-testid="upload-modal"]')
      .click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId("upload-modal")).not.toBeVisible();
  });

  test("shows login prompt in upload modal when not logged in", async ({
    page,
  }) => {
    await page.getByTestId("add-photo-btn").click();
    await expect(page.getByText(/login with nostr/i)).toBeVisible();
  });

  test("shows loading or empty state", async ({ page }) => {
    const hasLoading = await page
      .getByTestId("gallery-loading")
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .getByTestId("gallery-empty")
      .isVisible()
      .catch(() => false);
    const hasImages = await page
      .locator('[data-testid^="gallery-image-"]')
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasLoading || hasEmpty || hasImages).toBe(true);
  });
});

test.describe("@gallery @whitelist logged in", () => {
  test.beforeEach(async ({ page }) => {
    await injectNostrExtension(page);
    await page.goto("/gallery");
    await page.waitForTimeout(2000);

    // Login via the upload modal
    await page.getByTestId("add-photo-btn").click();
    await page
      .getByRole("button", { name: /login with nostr extension/i })
      .click();
    await page.waitForTimeout(1000);
  });

  test("upload form fields are enabled after login", async ({ page }) => {
    await expect(page.getByTestId("upload-file-input")).toBeEnabled();
    await expect(page.getByTestId("upload-caption")).toBeEnabled();
    await expect(page.getByTestId("upload-submit")).toBeDisabled();
  });

  test("upload submit is disabled without file", async ({ page }) => {
    await expect(page.getByTestId("upload-submit")).toBeDisabled();
  });

  test("shows loading or empty or images state when logged in", async ({
    page,
  }) => {
    await page.getByTestId("upload-cancel").click();
    await page.waitForTimeout(2000);

    const hasLoading = await page
      .getByTestId("gallery-loading")
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .getByTestId("gallery-empty")
      .isVisible()
      .catch(() => false);
    const hasImages = await page
      .locator('[data-testid^="gallery-image-"]')
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasLoading || hasEmpty || hasImages).toBe(true);
  });
});
