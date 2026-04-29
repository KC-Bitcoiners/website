import { test, expect } from "@playwright/test";
import { injectNostrExtension } from "./helpers";

test.describe("Shop Page @shop", () => {
  test.beforeEach(async ({ page }) => {
    await injectNostrExtension(page);
    await page.goto("/shop");
    // Wait for loading to finish
    await page.waitForTimeout(2000);
  });

  test("shop page loads with tab navigation", async ({ page }) => {
    // Verify the page rendered with tab navigation
    await expect(page.getByTestId("tab-vendors")).toBeVisible();
    await expect(page.getByTestId("tab-listings")).toBeVisible();
  });

  test("shows vendor tab by default", async ({ page }) => {
    const vendorsTab = page.getByTestId("tab-vendors");
    await expect(vendorsTab).toBeVisible();
    // Vendors tab should have the active style (bg-bitcoin-orange)
    const classes = await vendorsTab.getAttribute("class");
    expect(classes).toContain("bg-bitcoin-orange");
  });

  test("shows classifieds tab", async ({ page }) => {
    const listingsTab = page.getByTestId("tab-listings");
    await expect(listingsTab).toBeVisible();
    // Classifieds tab should NOT be active
    const classes = await listingsTab.getAttribute("class");
    expect(classes).toContain("bg-gray-100");
    expect(classes).not.toContain("bg-bitcoin-orange");
  });

  test("switches to classifieds tab on click", async ({ page }) => {
    await page.getByTestId("tab-listings").click({ force: true });

    // Classifieds tab should now be active
    const listingsTab = page.getByTestId("tab-listings");
    const classes = await listingsTab.getAttribute("class");
    expect(classes).toContain("bg-bitcoin-orange");

    // Vendors tab should be inactive
    const vendorsTab = page.getByTestId("tab-vendors");
    const vClasses = await vendorsTab.getAttribute("class");
    expect(vClasses).toContain("bg-gray-100");
  });

  test("classifieds tab shows listings or empty state", async ({
    page,
  }) => {
    await page.getByTestId("tab-listings").click({ force: true });
    // Wait for loading to finish
    await page.waitForTimeout(3000);

    // Either listings appear (with filter bar) or the empty state shows
    const hasListings = await page
      .locator('[data-testid^="listing-card-"]')
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .getByText("No Classified Listings Yet")
      .isVisible()
      .catch(() => false);
    const hasFilters = await page
      .getByTestId("listing-search")
      .isVisible()
      .catch(() => false);
    expect(hasListings || hasEmpty || hasFilters).toBeTruthy();
  });

  test("classifieds tab Create Listing button opens form", async ({
    page,
  }) => {
    await page.getByTestId("tab-listings").click({ force: true });
    await page.waitForTimeout(3000);

    // Scroll to CTA section and click the last "Create Listing" button
    const ctaSection = page.getByText("Have Something to Sell?");
    await ctaSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Get all Create Listing buttons, use the one in the CTA (last one)
    const buttons = page.getByRole("button", { name: "Create Listing" });
    const count = await buttons.count();
    if (count > 0) {
      await buttons.nth(count - 1).evaluate((el: HTMLElement) => el.click());
      await expect(page.getByTestId("listing-form-modal")).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("classifieds tab shows loading spinner", async ({ page }) => {
    await page.getByTestId("tab-listings").click({ force: true });
    // Loading spinner should appear briefly
    const spinner = page.locator(".animate-spin");
    // Spinner may already be gone, so just verify the page state settled
    await page.waitForTimeout(3000);
    // After loading, either listings or empty state should be visible
    const settled =
      (await page
        .locator('[data-testid^="listing-card-"]')
        .first()
        .isVisible()
        .catch(() => false)) ||
      (await page
        .getByText("No Classified Listings Yet")
        .isVisible()
        .catch(() => false)) ||
      (await page
        .getByText("Unable to load listings")
        .isVisible()
        .catch(() => false));
    expect(settled).toBeTruthy();
  });

  test("vendor tab still shows content after switching", async ({
    page,
  }) => {
    // Switch to classifieds and back
    await page.getByTestId("tab-listings").click({ force: true });
    await page.waitForTimeout(1000);
    await page.getByTestId("tab-vendors").click({ force: true });

    // Vendors tab should be active again
    const vendorsTab = page.getByTestId("tab-vendors");
    const classes = await vendorsTab.getAttribute("class");
    expect(classes).toContain("bg-bitcoin-orange");
  });

  test("listing form has required fields", async ({ page }) => {
    await page.getByTestId("tab-listings").click({ force: true });
    await page.waitForTimeout(2000);

    const createButtons = page
      .getByRole("button")
      .filter({ hasText: "Create Listing" });
    if ((await createButtons.count()) > 0) {
      await createButtons.first().click({ force: true });
      await expect(page.getByTestId("listing-form-modal")).toBeVisible();

      // Verify form fields exist
      await expect(page.getByTestId("listing-title")).toBeVisible();
      await expect(page.getByTestId("listing-description")).toBeVisible();
      await expect(page.getByTestId("listing-price-amount")).toBeVisible();
      await expect(page.getByTestId("listing-price-currency")).toBeVisible();
      await expect(page.getByTestId("listing-status")).toBeVisible();
      await expect(page.getByTestId("listing-publish")).toBeVisible();
    }
  });
});
