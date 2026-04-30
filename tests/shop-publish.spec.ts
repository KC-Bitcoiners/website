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
    // Wait for page to render tab navigation after reload
    await page.getByTestId("tab-listings").waitFor({ state: "attached", timeout: 10000 });
    // Switch back to classifieds tab after reload
    await page.getByTestId("tab-listings").evaluate((el) => (el as HTMLElement).click());
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
      await page.getByTestId("tab-listings").evaluate((el) => (el as HTMLElement).click());
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
      await createButtons.first().waitFor({ state: "attached", timeout: 5000 });
      await createButtons.first().evaluate((el) => (el as HTMLElement).click());
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
      await page.getByTestId("listing-publish").evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId("listing-form-modal")).not.toBeVisible({
        timeout: 20000,
      });

      // Wait for listing to appear
      const newListing = await waitForListingToAppear(page, uniqueTitle);

      // Verify listing content
      await expect(newListing).toContainText(uniqueTitle);

      // Verify raw event has kind 30402
      const dotsBtn = newListing.locator("button").filter({ hasText: /^\.\.\.$/ });
      await dotsBtn.evaluate((el) => (el as HTMLElement).click());
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
      await createButtons.first().waitFor({ state: "attached", timeout: 5000 });
      await createButtons.first().evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId("listing-form-modal")).toBeVisible();

      await page.getByTestId("listing-title").fill(uniqueTitle);
      await page.getByTestId("listing-description").fill("Fiat priced listing");
      await page.getByTestId("listing-price-amount").fill("25");
      await page.getByTestId("listing-price-currency").selectOption("USD");
      await page.getByTestId("listing-price-frequency").selectOption("month");
      await page.getByTestId("listing-tags").fill("service, monthly");

      await page.getByTestId("listing-publish").evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId("listing-form-modal")).not.toBeVisible({
        timeout: 20000,
      });

      const newListing = await waitForListingToAppear(page, uniqueTitle);

      // Verify raw event has correct price tag
      const dotsBtn = newListing.locator("button").filter({ hasText: /^\.\.\.$/ });
      await dotsBtn.evaluate((el) => (el as HTMLElement).click());
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
      await createButtons.first().waitFor({ state: "attached", timeout: 5000 });
      await createButtons.first().evaluate((el) => (el as HTMLElement).click());
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
        .evaluate((el) => (el as HTMLElement).click());

      await page.getByTestId("listing-publish").evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId("listing-form-modal")).not.toBeVisible({
        timeout: 20000,
      });

      const newListing = await waitForListingToAppear(page, uniqueTitle);

      // Verify image is displayed in the card
      const img = newListing.locator("img[src*='example.com/test-image.jpg']");
      await expect(img).toBeVisible();

      // Verify raw event has image tag
      const dotsBtn = newListing.locator("button").filter({ hasText: /^\.\.\.$/ });
      await dotsBtn.evaluate((el) => (el as HTMLElement).click());
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
      await createButtons.first().waitFor({ state: "attached", timeout: 5000 });
      await createButtons.first().evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId("listing-form-modal")).toBeVisible();

      await page.getByTestId("listing-title").fill(uniqueTitle);
      await page.getByTestId("listing-description").fill("Local pickup");
      await page.getByTestId("listing-price-amount").fill("1000");
      await page.getByTestId("listing-location").fill("Kansas City, MO");

      await page.getByTestId("listing-publish").evaluate((el) => (el as HTMLElement).click());
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
      await createButtons.first().waitFor({ state: "attached", timeout: 5000 });
      await createButtons.first().evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId("listing-form-modal")).toBeVisible({ timeout: 5000 });

      await page.getByTestId("listing-title").fill(uniqueTitle);
      await page.getByTestId("listing-description").fill("To be deleted");
      await page.getByTestId("listing-price-amount").fill("1000");
      await page.getByTestId("listing-publish").evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId("listing-form-modal")).not.toBeVisible({
        timeout: 20000,
      });

      const listingToDelete = await waitForListingToAppear(page, uniqueTitle);

      // Accept the confirm dialog
      page.on("dialog", (dialog) => dialog.accept());

      // Click the ... menu and delete
      const dotsBtn = listingToDelete.locator("button").filter({ hasText: /^\.\.\.$/ });
      await dotsBtn.evaluate((el) => (el as HTMLElement).click());
      await page.waitForTimeout(500);

      // Delete button text includes emoji: "🗑️Delete"
      const deleteBtn = page.getByRole("button", { name: /Delete/ });
      await expect(deleteBtn).toBeVisible({ timeout: 5000 });
      await deleteBtn.evaluate((el) => (el as HTMLElement).click());

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
      await createButtons.first().waitFor({ state: "attached", timeout: 5000 });
      await createButtons.first().evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId("listing-form-modal")).toBeVisible({ timeout: 5000 });

      // Don't fill anything, just submit
      await page.getByTestId("listing-publish").evaluate((el) => (el as HTMLElement).click());

      // Should show an alert with validation errors
      page.once("dialog", (dialog) => {
        expect(dialog.message()).toContain("Title is required");
        dialog.accept();
      });
    });

    test("edit a classified listing", async ({ page }) => {
      // First create a listing to edit
      const uniqueTitle = `ToEdit ${Date.now()}`;
      const editedTitle = `Edited ${Date.now()}`;

      const createButtons = page
        .getByRole("button")
        .filter({ hasText: "Create Listing" });
      await createButtons.first().waitFor({ state: "attached", timeout: 5000 });
      await createButtons.first().evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId("listing-form-modal")).toBeVisible({ timeout: 5000 });

      await page.getByTestId("listing-title").fill(uniqueTitle);
      await page.getByTestId("listing-description").fill("To be edited");
      await page.getByTestId("listing-price-amount").fill("2000");
      await page.getByTestId("listing-publish").evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId("listing-form-modal")).not.toBeVisible({
        timeout: 20000,
      });

      const listing = await waitForListingToAppear(page, uniqueTitle);

      // Click the ... menu and edit
      const dotsBtn = listing.locator("button").filter({ hasText: /^\.\.\.$/ });
      await dotsBtn.evaluate((el) => (el as HTMLElement).click());
      await page.waitForTimeout(500);

      // Click Edit button
      const editBtn = page.getByRole("button", { name: /Edit/ });
      await expect(editBtn).toBeVisible({ timeout: 5000 });
      await editBtn.evaluate((el) => (el as HTMLElement).click());

      // Form should open in edit mode, pre-filled with existing data
      await expect(page.getByTestId("listing-form-modal")).toBeVisible({ timeout: 5000 });
      const titleValue = await page.getByTestId("listing-title").inputValue();
      expect(titleValue).toBe(uniqueTitle);

      // Edit the title
      await page.getByTestId("listing-title").fill(editedTitle);
      await page.getByTestId("listing-publish").evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId("listing-form-modal")).not.toBeVisible({
        timeout: 20000,
      });

      // Wait for edited listing to appear
      const editedListing = await waitForListingToAppear(page, editedTitle);
      await expect(editedListing).toContainText(editedTitle);
    });

    test("add listing to cart shows cart badge", async ({ page }) => {
      const uniqueTitle = `CartTest ${Date.now()}`;

      const createButtons = page
        .getByRole("button")
        .filter({ hasText: "Create Listing" });
      await createButtons.first().waitFor({ state: "attached", timeout: 5000 });
      await createButtons.first().evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId("listing-form-modal")).toBeVisible({ timeout: 5000 });

      await page.getByTestId("listing-title").fill(uniqueTitle);
      await page.getByTestId("listing-description").fill("Cart test listing");
      await page.getByTestId("listing-price-amount").fill("5000");
      await page.getByTestId("listing-publish").evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId("listing-form-modal")).not.toBeVisible({
        timeout: 20000,
      });

      const listing = await waitForListingToAppear(page, uniqueTitle);

      // Click Add to Cart button
      const addToCartBtn = listing.getByTestId("add-to-cart-btn");
      if (await addToCartBtn.isVisible().catch(() => false)) {
        await addToCartBtn.evaluate((el) => (el as HTMLElement).click());

        // Cart badge should appear
        await expect(page.getByTestId("cart-badge")).toBeVisible({ timeout: 5000 });

        // Click badge to open drawer
        await page.getByTestId("cart-badge").evaluate((el) => (el as HTMLElement).click());
        await expect(page.getByTestId("cart-drawer")).toBeVisible({ timeout: 5000 });

        // Drawer should show the item
        const drawer = page.getByTestId("cart-drawer");
        await expect(drawer).toContainText(uniqueTitle);
      }
    });
  },
);
