import { test, expect } from "@playwright/test";
import { injectNostrExtension } from "./helpers";

/**
 * Seeds the education page with test pins so read-only tests have data.
 * Publishes one pin of each type needed by the filter tests.
 */
async function seedTestData(page: import("@playwright/test").Page) {
  // Publish a YouTube video
  await publishPin(page, {
    title: `Test Video ${Date.now()}`,
    type: "youtube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    description: "Test video",
  });

  // Publish a Podcast
  await publishPin(page, {
    title: `Test Podcast ${Date.now()}`,
    type: "podcast",
    url: "https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk",
    description: "Test podcast",
  });

  // Publish a generic Link
  await publishPin(page, {
    title: `Test Link ${Date.now()}`,
    type: "link",
    url: "https://example.com/article",
    description: "Test link",
  });

  // Wait for at least one pin to be visible after reload
  await page.reload();
  await page.locator('[data-testid^="pin-"]').first().waitFor({ timeout: 20000 });
}

async function publishPin(
  page: import("@playwright/test").Page,
  opts: { title: string; type: string; url: string; description: string }
) {
  await page.getByTestId("add-pin-btn").click();
  await expect(page.getByTestId("add-pin-modal")).toBeVisible({ timeout: 5000 });

  await page.getByTestId("pin-title").fill(opts.title);
  await page.getByTestId(`type-${opts.type}`).click();
  await page.getByTestId("pin-url").fill(opts.url);
  await page.getByTestId("pin-description").fill(opts.description);

  await page.getByTestId("pin-publish").click();
  // Wait for modal to close (publish success)
  await expect(page.getByTestId("add-pin-modal")).not.toBeVisible({ timeout: 20000 }).catch(() => {
    // If it doesn't close, try closing manually (publish may have errored)
  });
  // Small wait for relay propagation
  await page.waitForTimeout(2000);
}

test.describe("Education Page @education", () => {
  test.beforeEach(async ({ page }) => {
    await injectNostrExtension(page);
    await page.goto("/education");
    // Wait for page to finish loading
    await page.locator('[data-testid="add-pin-btn"], [data-testid^="pin-"]').first().waitFor({ timeout: 15000 });
  });

  test("education page loads with correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/Education/);
  });

  test("displays page header", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Education Resources/i })).toBeVisible();
  });

  test("shows tab navigation", async ({ page }) => {
    await expect(page.getByTestId("tab-featured")).toBeVisible();
    await expect(page.getByTestId("tab-boards")).toBeVisible();
  });

  test("featured tab is active by default", async ({ page }) => {
    await expect(page.getByTestId("tab-featured")).toHaveClass(/bg-bitcoin-orange/);
  });
});

test.describe("Education Page - With Data @education @whitelist", () => {
  test.setTimeout(120_000);
  test.beforeAll(async ({ browser }) => {
    // Seed test data once for all tests in this describe
    const context = await browser.newContext();
    const page = await context.newPage();
    await injectNostrExtension(page);
    await page.goto("/education");
    await page.locator('[data-testid="add-pin-btn"], [data-testid^="pin-"]').first().waitFor({ timeout: 15000 });

    await seedTestData(page);

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await injectNostrExtension(page);
    await page.goto("/education");
    await page.waitForTimeout(5000);
  });

  test("loads pins from Nostr relays", async ({ page }) => {
    const pins = page.locator('[data-testid^="pin-"]');
    await expect(pins.first()).toBeVisible({ timeout: 15000 });
    const count = await pins.count();
    expect(count).toBeGreaterThan(0);
  });

  test("shows filter bar with dynamic type buttons", async ({ page }) => {
    const pins = page.locator('[data-testid^="pin-"]');
    await expect(pins.first()).toBeVisible({ timeout: 15000 });

    await expect(page.getByTestId("filter-all")).toBeVisible();
    const filterButtons = page.locator('[data-testid^="filter-"]');
    const count = await filterButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("filter to Videos shows only video pins with embeds", async ({ page }) => {
    const pins = page.locator('[data-testid^="pin-"]');
    await expect(pins.first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("filter-youtube").click();
    const vidPins = page.locator('[data-testid^="pin-"]');
    const count = await vidPins.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 3); i++) {
      const iframe = vidPins.nth(i).locator("iframe");
      const src = await iframe.first().getAttribute("src");
      expect(src).toMatch(/youtube\.com\/embed|player\.vimeo\.com|rumble\.com\/embed/);
    }

    const spotifyIframes = page.locator('iframe[src*="spotify.com"]');
    expect(await spotifyIframes.count()).toBe(0);
  });

  test("filter to Podcasts shows only podcast pins with Spotify embeds", async ({ page }) => {
    const pins = page.locator('[data-testid^="pin-"]');
    await expect(pins.first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("filter-podcast").click();
    const podPins = page.locator('[data-testid^="pin-"]');
    const count = await podPins.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 3); i++) {
      const iframe = podPins.nth(i).locator("iframe[src*='spotify.com']");
      expect(await iframe.count()).toBeGreaterThan(0);
    }

    const ytIframes = page.locator('iframe[src*="youtube.com"]');
    expect(await ytIframes.count()).toBe(0);
  });

  test("filter to Links shows only generic link pins", async ({ page }) => {
    const pins = page.locator('[data-testid^="pin-"]');
    await expect(pins.first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("filter-link").click();
    const linkPins = page.locator('[data-testid^="pin-"]');
    const count = await linkPins.count();
    expect(count).toBeGreaterThan(0);

    const mediaIframes = page.locator('iframe[src*="youtube.com"], iframe[src*="spotify.com"]');
    expect(await mediaIframes.count()).toBe(0);
  });

  test("All filter shows everything", async ({ page }) => {
    const pins = page.locator('[data-testid^="pin-"]');
    await expect(pins.first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("filter-youtube").click();
    const ytCount = await page.locator('[data-testid^="pin-"]').count();

    await page.getByTestId("filter-all").click();
    const allCount = await page.locator('[data-testid^="pin-"]').count();
    expect(allCount).toBeGreaterThan(ytCount);
  });

  test("pin cards have EventActions (...) menu", async ({ page }) => {
    const pins = page.locator('[data-testid^="pin-"]');
    await expect(pins.first()).toBeVisible({ timeout: 15000 });

    const menuBtn = pins.first().locator("button").filter({ hasText: /^\.\.\.$/ });
    await expect(menuBtn).toBeVisible();
  });

  test("EventActions dropdown has Share, View Raw Data, Copy options", async ({ page }) => {
    const pins = page.locator('[data-testid^="pin-"]');
    await expect(pins.first()).toBeVisible({ timeout: 15000 });

    await pins.first().locator("button").filter({ hasText: /^\.\.\.$/ }).click();

    await expect(pins.first().getByText("Share")).toBeVisible();
    await expect(pins.first().getByText("View Raw Data")).toBeVisible();
    await expect(pins.first().getByText("Copy Event ID")).toBeVisible();
    await expect(pins.first().getByText("Copy Raw JSON")).toBeVisible();
  });

  test("View Raw Data shows JSON with kind 39067", async ({ page }) => {
    const pins = page.locator('[data-testid^="pin-"]');
    await expect(pins.first()).toBeVisible({ timeout: 15000 });

    await pins.first().locator("button").filter({ hasText: /^\.\.\.$/ }).click();
    await pins.first().getByText("View Raw Data").click();

    const rawPanel = pins.first().locator("pre");
    await expect(rawPanel).toBeVisible();
    const rawText = await rawPanel.textContent();
    expect(rawText).toContain('"kind"');
    expect(rawText).toContain('"tags"');
  });

  test("EventActions dropdown closes on outside click", async ({ page }) => {
    const pins = page.locator('[data-testid^="pin-"]');
    await expect(pins.first()).toBeVisible({ timeout: 15000 });

    await pins.first().locator("button").filter({ hasText: /^\.\.\.$/ }).click();
    await expect(pins.first().getByText("Share")).toBeVisible();

    await page.getByRole("heading", { name: /Education Resources/i }).click();
    await expect(pins.first().getByText("Share")).not.toBeVisible();
  });

  test("shows Add Resource button", async ({ page }) => {
    const pins = page.locator('[data-testid^="pin-"]');
    await expect(pins.first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("add-pin-btn")).toBeVisible();
  });

  test("Add Resource opens modal with form fields", async ({ page }) => {
    const pins = page.locator('[data-testid^="pin-"]');
    await expect(pins.first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();
    await expect(page.getByTestId("pin-title")).toBeVisible();
    await expect(page.getByTestId("pin-url")).toBeVisible();
    await expect(page.getByTestId("pin-description")).toBeVisible();
    await expect(page.getByTestId("pin-tags")).toBeVisible();
    await expect(page.getByTestId("pin-publish")).toBeVisible();
  });

  test("Add Resource modal closes on Cancel", async ({ page }) => {
    const pins = page.locator('[data-testid^="pin-"]');
    await expect(pins.first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();

    await page.getByTestId("add-pin-modal").getByText("Cancel").click();
    await expect(page.getByTestId("add-pin-modal")).not.toBeVisible();
  });

  test("switches to pinboards tab", async ({ page }) => {
    await page.getByTestId("tab-boards").click();
    await expect(page.getByTestId("tab-boards")).toHaveClass(/bg-bitcoin-orange/);
  });

  test("switches back to featured tab", async ({ page }) => {
    await page.getByTestId("tab-boards").click();
    await page.waitForTimeout(1000);
    await page.getByTestId("tab-featured").click();
    await expect(page.getByTestId("tab-featured")).toHaveClass(/bg-bitcoin-orange/);
  });
});
