import { test, expect, Page } from "@playwright/test";
import { injectNostrExtension } from "./helpers";

/**
 * Wait for a newly published committee to appear on the page.
 * Retries with reloads to handle relay propagation delays.
 * Uses heading-based locators to avoid data-testid timing issues.
 */
async function waitForCommitteeToAppear(
  page: Page,
  uniqueTitle: string,
  maxAttempts = 3,
) {
  const getCardLocator = () =>
    page
      .getByRole("heading", { name: uniqueTitle, level: 3 })
      .locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]');

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await page.waitForTimeout(3000);
      await page.reload();
    }

    try {
      await expect(
        page.getByRole("heading", { name: uniqueTitle, level: 3 }),
      ).toBeVisible({ timeout: 25000 });
      return getCardLocator();
    } catch {
      // Committee not found yet, retry
    }
  }

  // Final attempt with reload and longer timeout
  await page.reload();
  await expect(
    page.getByRole("heading", { name: uniqueTitle, level: 3 }),
  ).toBeVisible({ timeout: 30000 });
  return getCardLocator();
}

test.describe("Committees Page @committees", () => {
  test.beforeEach(async ({ page }) => {
    await injectNostrExtension(page);
    await page.goto("/committees");
    // Wait for loading to finish
    await expect(page.getByTestId("committees-loading"))
      .not.toBeVisible({ timeout: 20000 })
      .catch(() => {});
  });

  test("committees page loads with correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/Committees/);
  });

  test("displays page header", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Committees", exact: true }),
    ).toBeVisible();
  });

  test("shows statistics cards", async ({ page }) => {
    // Wait for loading to finish
    await expect(page.getByTestId("committees-loading"))
      .not.toBeVisible({ timeout: 20000 })
      .catch(() => {});
    await expect(page.getByText("Active Committees")).toBeVisible();
    await expect(page.getByText("Open Positions")).toBeVisible();
    await expect(
      page
        .locator(".text-gray-600")
        .filter({ hasText: /^Members$/ })
        .first(),
    ).toBeVisible();
  });

  test("shows Apply button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Apply to Join/i }),
    ).toBeVisible();
  });

  test("shows loading spinner then empty or populated state", async ({
    page,
  }) => {
    // Wait for loading to finish (spinner disappears)
    await expect(page.getByTestId("committees-loading"))
      .not.toBeVisible({ timeout: 20000 })
      .catch(() => {});
    // Either committees appear or the empty state shows
    const hasCards = await page
      .locator('[data-testid^="committee-card-"]')
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .getByTestId("committees-empty")
      .isVisible()
      .catch(() => false);
    expect(hasCards || hasEmpty).toBeTruthy();
  });
});

test.describe("Committees Page - CRUD @committees @whitelist", () => {
  // CRUD tests need more time for relay propagation
  test.setTimeout(180_000);
  test.beforeEach(async ({ page }) => {
    await injectNostrExtension(page);
    await page.goto("/committees");
    // Wait for loading to finish
    await page
      .locator(
        '[data-testid="add-committee-btn"], [data-testid="committees-empty"]',
      )
      .first()
      .waitFor({ timeout: 15000 });
  });

  test("create a committee and verify it appears", async ({ page }) => {
    const uniqueTitle = `Test Committee ${Date.now()}`;

    await page.getByTestId("add-committee-btn").click({ force: true });
    await expect(page.getByTestId("committee-form-modal")).toBeVisible();

    await page.getByTestId("committee-title").fill(uniqueTitle);
    // Slug auto-generates from title
    await page
      .getByTestId("committee-description")
      .fill("A test committee created via Playwright");
    await page.getByTestId("committee-schedule").fill("First Tuesday at 7 PM");
    await page.getByTestId("committee-openings").fill("5");
    await page.getByTestId("committee-tags").fill("test, e2e");

    await page.getByTestId("committee-publish").click();
    await expect(page.getByTestId("committee-form-modal")).not.toBeVisible({
      timeout: 20000,
    });

    // Wait for relay propagation and verify
    const card = await waitForCommitteeToAppear(page, uniqueTitle);
    await expect(card).toContainText(uniqueTitle);
    await expect(card).toContainText("5 Openings");
    await expect(card).toContainText("First Tuesday at 7 PM");
  });

  test("committee card shows member count", async ({ page }) => {
    const uniqueTitle = `Member Count Test ${Date.now()}`;

    // Create committee
    await page.getByTestId("add-committee-btn").click({ force: true });
    await page.getByTestId("committee-title").fill(uniqueTitle);
    await page.getByTestId("committee-publish").click();
    await expect(page.getByTestId("committee-form-modal")).not.toBeVisible({
      timeout: 20000,
    });

    const card = await waitForCommitteeToAppear(page, uniqueTitle);
    await expect(card).toContainText("0 Members");
  });

  test("add member to committee via detail modal", async ({ page }) => {
    const uniqueTitle = `Member Test ${Date.now()}`;

    // Create committee first
    await page.getByTestId("add-committee-btn").click({ force: true });
    await page.getByTestId("committee-title").fill(uniqueTitle);
    await page.getByTestId("committee-publish").click();
    await expect(page.getByTestId("committee-form-modal")).not.toBeVisible({
      timeout: 20000,
    });

    const card = await waitForCommitteeToAppear(page, uniqueTitle);
    // Click on the card to open detail modal
    await card.evaluate((el: HTMLElement) => {
      el.click();
    });

    // Wait for detail modal (committee name in h2)
    await expect(
      page.getByRole("heading", { name: uniqueTitle, exact: true, level: 2 }),
    ).toBeVisible({ timeout: 10000 });

    // Verify "No members yet" shows for empty committee
    await expect(page.getByText("No members yet")).toBeVisible();

    // Add a member
    await page.getByTestId("add-member-btn").click({ force: true });
    await expect(page.getByTestId("member-form-modal")).toBeVisible();

    await page.getByTestId("member-name").fill("Test Chair");
    await page.getByTestId("member-role").fill("Chair");
    await page.getByTestId("member-email").fill("chair@test.com");

    await page.getByTestId("member-publish").click();
    await expect(page.getByTestId("member-form-modal")).not.toBeVisible({
      timeout: 20000,
    });
  });

  test("add members with different roles via detail modal", async ({
    page,
  }) => {
    const uniqueTitle = `Roles Test ${Date.now()}`;

    // Create committee
    await page.getByTestId("add-committee-btn").click({ force: true });
    await page.getByTestId("committee-title").fill(uniqueTitle);
    await page.getByTestId("committee-publish").click();
    await expect(page.getByTestId("committee-form-modal")).not.toBeVisible({
      timeout: 20000,
    });

    const card = await waitForCommitteeToAppear(page, uniqueTitle);

    // Open detail
    await card.evaluate((el: HTMLElement) => {
      el.click();
    });
    await expect(
      page.getByRole("heading", { name: uniqueTitle, exact: true, level: 2 }),
    ).toBeVisible({ timeout: 10000 });

    // Add chair - verify role input is free-form text
    await page.getByTestId("add-member-btn").click({ force: true });
    await expect(page.getByTestId("member-form-modal")).toBeVisible();
    // Verify role field is a text input with datalist suggestions
    await expect(page.getByTestId("member-role")).toBeVisible();
    await page.getByTestId("member-name").fill("Alice Chair");
    await page.getByTestId("member-role").fill("Chair");
    await page.getByTestId("member-publish").click();
    await expect(page.getByTestId("member-form-modal")).not.toBeVisible({
      timeout: 20000,
    });

    // Add vice-chair
    await page.getByTestId("add-member-btn").click({ force: true });
    await page.getByTestId("member-name").fill("Bob Vice");
    await page.getByTestId("member-role").fill("Vice Chair");
    await page.getByTestId("member-publish").click();
    await expect(page.getByTestId("member-form-modal")).not.toBeVisible({
      timeout: 20000,
    });

    // Add regular member with custom role
    await page.getByTestId("add-member-btn").click({ force: true });
    await page.getByTestId("member-name").fill("Carol Member");
    await page.getByTestId("member-role").fill("Secretary");
    await page.getByTestId("member-publish").click();
    await expect(page.getByTestId("member-form-modal")).not.toBeVisible({
      timeout: 20000,
    });
  });

  test("application form opens with dynamic committee list", async ({
    page,
  }) => {
    // Wait for page to settle
    await page.waitForTimeout(3000);

    // Open application form
    await page
      .getByRole("button", { name: /Apply to Join/i })
      .click({ force: true });
    await expect(
      page.getByRole("heading", { name: "Apply to Join a Committee" }),
    ).toBeVisible();

    // Verify the form has the expected fields
    await expect(page.getByLabel(/Full Name/)).toBeVisible();
    await expect(page.getByLabel(/Email Address/)).toBeVisible();
    await expect(page.getByLabel(/Committee of Interest/)).toBeVisible();

    // Close
    await page.locator('button:has-text("×")').first().click();
  });

  test("EventActions shows on committee cards for whitelisted users", async ({
    page,
  }) => {
    // Create a committee so there's something to show
    const uniqueTitle = `Actions Test ${Date.now()}`;
    await page.getByTestId("add-committee-btn").click({ force: true });
    await page.getByTestId("committee-title").fill(uniqueTitle);
    await page.getByTestId("committee-publish").click();
    await expect(page.getByTestId("committee-form-modal")).not.toBeVisible({
      timeout: 20000,
    });

    const card = await waitForCommitteeToAppear(page, uniqueTitle);
    // EventActions "..." button should be visible since we're whitelisted
    await expect(
      card.locator("button").filter({ hasText: "..." }),
    ).toBeVisible();
  });
});
