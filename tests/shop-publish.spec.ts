import { test, expect, Page } from "@playwright/test";
import { injectNostrExtension } from "./helpers";

/**
 * Wait for a newly published classified listing to appear on the page.
 * Retries with reloads to handle relay propagation delays.
 */
async function waitForListingToAppear(
  page: Page,
  uniqueTitle: string,
  maxAttempts = 3,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const waitMs = attempt === 0 ? 10000 : 6000;
    await page.waitForTimeout(waitMs);
    await page.reload();
    // Switch back to classifieds tab after reload
    await page.getByTestId("tab-listings").click({ force: true });
    await page
      .locator('[data-testid^="listing-card-"]')
      .first()
      .waitFor({ timeout: 15000 })
      .catch(() => {});

    const listing = page
      .locator('[data-testid^="listing-card-"]')
      .filter({ hasText: uniqueTitle });
    if (await listing.isVisible().catch(() => false)) {
      return listing;
    }
  }
  // Final assertion — produces a clear error on failure
  const listing = page
    .locator('[data-testid^="listing-card-"]')
    .filter({ hasText: uniqueTitle });
  await expect(listing).toBeVisible({ timeout: 10000 });
  return listing;
}

test.describe(
  "Shop Page - Classified Listings CRUD @shop @whitelist",
  () => {
    // CRUD tests need more time for relay propagation
    test.setTimeout(180_000);

    test.beforeEach(async ({ page }) => {
      await injectNostrExtension(page);
      await page.goto("/shop");
      // Switch to classifieds tab
      await page.getByTestId("tab-listings").click({ force: true });
      // Wait for loading to finish
      await page.waitForTimeout(3000);
    });

    test("create a classified listing and verify it appears", async ({
      page,
    }) => {
      const uniqueTitle = `Test Listing ${Date.now()}`;

      // Click Create Listing
      const createButtons = page
        .getByRole("button")
        .filter({ hasText: "Create Listing" });
      await createButtons.first().click({ force: true });
      await expect(page.getByTestId("listing-form-modal")).toBeVisible();

      // Fill form
      await page.getByTestId("listing-title").fill(uniqueTitle);
      await page.getByTestId("listing-summary").fill("A test listing summary");
      await page
        .getByTestId("listing-description")
        .fill("Full description in **markdown** for the test listing.");
      await page.getByTestId("listing-price-amount").fill("50000");
      await page.getByTestId("listing-price-currency").selectOption("sats");
      await page.getByTestId("listing-tags").fill("test, bitcoin");

      // Publish
      await page.getByTestId("listing-publish").click();
      await expect(page.getByTestId("listing-form-modal")).not.toBeVisible({
        timeout: 20000,
      });

      // Wait for listing to appear
      const newListing = await waitForListingToAppear(page, uniqueTitle);

      // Verify listing content
      await expect(newListing).toContainText(uniqueTitle);

      // Verify raw event has kind 30402
      await newListing
        .locator("button")
        .filter({ hasText: /^\.\.\.$/ })
        .click();
      await newListing
        .getByText("View Raw Data")
        .evaluate((el) => (el as HTMLElement).click());
      const rawText = await newListing.locator("pre").textContent();
      expect(rawText).toContain("30402");
      expect(rawText).toContain("50000");
      expect(rawText).toContain("sats");
    });

    test("create listing with fiat price and frequency", async ({ page }) => {
      const uniqueTitle = `Fiat Listing ${Date.now()}`;

      const createButtons = page
        .getByRole("button")
        .filter({ hasText: "Create Listing" });
      await createButtons.first().click({ force: true });
      await expect(page.getByTestId("listing-form-modal")).toBeVisible();

      await page.getByTestId("listing-title").fill(uniqueTitle);
      await page.getByTestId("listing-description").fill("Fiat priced listing");
      await page.getByTestId("listing-price-amount").fill("25");
      await page.getByTestId("listing-price-currency").selectOption("USD");
      await page.getByTestId("listing-price-frequency").selectOption("month");
      await page.getByTestId("listing-tags").fill("service, monthly");

      await page.getByTestId("listing-publish").click();
      await expect(page.getByTestId("listing-form-modal")).not.toBeVisible({
        timeout: 20000,
      });

      const newListing = await waitForListingToAppear(page, uniqueTitle);

      // Verify raw event has correct price tag
      await newListing
        .locator("button")
        .filter({ hasText: /^\.\.\.$/ })
        .click();
      await newListing
        .getByText("View Raw Data")
        .evaluate((el) => (el as HTMLElement).click());
      const rawText = await newListing.locator("pre").textContent();
      expect(rawText).toContain("25");
      expect(rawText).toContain("USD");
      expect(rawText).toContain("month");
    });

    test("create listing with images", async ({ page }) => {
      const uniqueTitle = `Image Listing ${Date.now()}`;

      const createButtons = page
        .getByRole("button")
        .filter({ hasText: "Create Listing" });
      await createButtons.first().click({ force: true });
      await expect(page.getByTestId("listing-form-modal")).toBeVisible();

      await page.getByTestId("listing-title").fill(uniqueTitle);
      await page
        .getByTestId("listing-description")
        .fill("Listing with an image");
      await page.getByTestId("listing-price-amount").fill("100000");

      // Add an image URL
      await page
        .getByTestId("listing-images")
        .fill("https://example.com/test-image.jpg");
      await page
        .getByRole("button", { name: "Add" })
        .click();

      await page.getByTestId("listing-publish").click();
      await expect(page.getByTestId("listing-form-modal")).not.toBeVisible({
        timeout: 20000,
      });

      const newListing = await waitForListingToAppear(page, uniqueTitle);

      // Verify image is displayed in the card
      const img = newListing.locator("img[src*='example.com/test-image.jpg']");
      await expect(img).toBeVisible();

      // Verify raw event has image tag
      await newListing
        .locator("button")
        .filter({ hasText: /^\.\.\.$/ })
        .click();
      await newListing
        .getByText("View Raw Data")
        .evaluate((el) => (el as HTMLElement).click());
      const rawText = await newListing.locator("pre").textContent();
      expect(rawText).toContain("image");
      expect(rawText).toContain("example.com/test-image.jpg");
    });

    test("create listing with location", async ({ page }) => {
      const uniqueTitle = `Location Listing ${Date.now()}`;

      const createButtons = page
        .getByRole("button")
        .filter({ hasText: "Create Listing" });
      await createButtons.first().click({ force: true });
      await expect(page.getByTestId("listing-form-modal")).toBeVisible();

      await page.getByTestId("listing-title").fill(uniqueTitle);
      await page.getByTestId("listing-description").fill("Local pickup");
      await page.getByTestId("listing-price-amount").fill("1000");
      await page.getByTestId("listing-location").fill("Kansas City, MO");

      await page.getByTestId("listing-publish").click();
      await expect(page.getByTestId("listing-form-modal")).not.toBeVisible({
        timeout: 20000,
      });

      const newListing = await waitForListingToAppear(page, uniqueTitle);
      await expect(newListing).toContainText("Kansas City, MO");
    });

    test("delete a classified listing", async ({ page }) => {
      // First create a listing to delete
      const uniqueTitle = `ToDelete ${Date.now()}`;

      const createButtons = page
        .getByRole("button")
        .filter({ hasText: "Create Listing" });
      await createButtons.first().click({ force: true });
      await expect(page.getByTestId("listing-form-modal")).toBeVisible();

      await page.getByTestId("listing-title").fill(uniqueTitle);
      await page.getByTestId("listing-description").fill("To be deleted");
      await page.getByTestId("listing-price-amount").fill("1000");
      await page.getByTestId("listing-publish").click();
      await expect(page.getByTestId("listing-form-modal")).not.toBeVisible({
        timeout: 20000,
      });

      const listingToDelete = await waitForListingToAppear(page, uniqueTitle);

      // Accept the confirm dialog
      page.on("dialog", (dialog) => dialog.accept());

      // Click the ... menu and delete
      await listingToDelete
        .locator("button")
        .filter({ hasText: /^\.\.\.$/ })
        .click();
      await listingToDelete
        .getByRole("button", { name: /Delete/ })
        .click();

      // Listing should be optimistically removed from the UI
      const deletedListing = page
        .locator('[data-testid^="listing-card-"]')
        .filter({ hasText: uniqueTitle });
      await expect(deletedListing).not.toBeVisible({ timeout: 5000 });
    });

    test("listing form shows validation errors", async ({ page }) => {
      const createButtons = page
        .getByRole("button")
        .filter({ hasText: "Create Listing" });
      await createButtons.first().click({ force: true });
      await expect(page.getByTestId("listing-form-modal")).toBeVisible();

      // Don't fill anything, just submit
      await page.getByTestId("listing-publish").click();

      // Should show an alert with validation errors
      page.once("dialog", (dialog) => {
        expect(dialog.message()).toContain("Title is required");
        dialog.accept();
      });
    });

    test("listing form pre-fills when editing", async ({ page }) => {
      // First create a listing
      const uniqueTitle = `EditTest ${Date.now()}`;

      const createButtons = page
        .getByRole("button")
        .filter({ hasText: "Create Listing" });
      await createButtons.first().click({ force: true });
      await expect(page.getByTestId("listing-form-modal")).toBeVisible();

      await page.getByTestId("listing-title").fill(uniqueTitle);
      await page.getByTestId("listing-description").fill("Original content");
      await page.getByTestId("listing-price-amount").fill("1000");
      await page.getByTestId("listing-publish").click();
      await expect(page.getByTestId("listing-form-modal")).not.toBeVisible({
        timeout: 20000,
      });

      const listing = await waitForListingToAppear(page, uniqueTitle);

      // Click the ... menu and edit
      await listing
        .locator("button")
        .filter({ hasText: /^\.\.\.$/ })
        .click();
      await listing
        .getByText("Edit")
        .evaluate((el) => (el as HTMLElement).click());

      // Form should be pre-filled with existing data
      await expect(page.getByTestId("listing-form-modal")).toBeVisible();
      const titleValue = await page.getByTestId("listing-title").inputValue();
      expect(titleValue).toBe(uniqueTitle);
      const descValue = await page
        .getByTestId("listing-description")
        .inputValue();
      expect(descValue).toBe("Original content");
    });
  },
);
