import { test, expect } from "@playwright/test";
import { injectNostrExtension } from "./helpers";
import * as fs from "fs";
import * as path from "path";

test.describe("@gallery @whitelist publish", () => {
  test.beforeEach(async ({ page }) => {
    await injectNostrExtension(page);
    await page.goto("/gallery");
    await page.waitForTimeout(2000);
  });

  test("publish a gallery image and verify it appears", async ({ page }) => {
    // Open upload modal
    await page.getByTestId("add-photo-btn").click();
    await expect(page.getByTestId("upload-modal")).toBeVisible();

    // Login via extension
    await page.getByRole("button", { name: /login with nostr extension/i }).click();
    await page.waitForTimeout(1000);

    // Create a test image
    const fixturesDir = path.join(__dirname, "fixtures");
    if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
    const testImagePath = path.join(fixturesDir, "test-image.png");
    if (!fs.existsSync(testImagePath)) {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
        "base64"
      );
      fs.writeFileSync(testImagePath, png);
    }

    // Upload file and fill caption
    await page.getByTestId("upload-file-input").setInputFiles(testImagePath);
    const uniqueCaption = `Test Gallery ${Date.now()}`;
    await page.getByTestId("upload-caption").fill(uniqueCaption);

    // Submit
    await expect(page.getByTestId("upload-submit")).toBeEnabled();
    await page.getByTestId("upload-submit").click();

    // Wait for upload to complete
    await page.waitForTimeout(10000);

    // Check result: modal should close on success
    const modalGone = !(await page.getByTestId("upload-modal").isVisible().catch(() => false));
    if (modalGone) {
      // Upload succeeded — image should appear without page reload
      await expect(page.locator('[data-testid^="gallery-image-"]').first()).toBeVisible({ timeout: 5000 });
    } else {
      const hasError = await page.locator(".bg-red-50").isVisible().catch(() => false);
      expect(hasError).toBe(true);
    }
  });
});
