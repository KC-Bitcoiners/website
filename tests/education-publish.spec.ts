import { test, expect, Page } from "@playwright/test";
import { injectNostrExtension } from "./helpers";

/**
 * Wait for a newly published pin to appear on the page.
 * Retries with reloads to handle relay propagation delays.
 */
async function waitForPinToAppear(page: Page, uniqueTitle: string, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const waitMs = attempt === 0 ? 10000 : 6000;
    await page.waitForTimeout(waitMs);
    await page.reload();
    await page.locator('[data-testid^="pin-"]').first().waitFor({ timeout: 15000 });

    const pin = page.locator('[data-testid^="pin-"]').filter({ hasText: uniqueTitle });
    if (await pin.isVisible().catch(() => false)) {
      return pin;
    }
  }
  // Final assertion — produces a clear error on failure
  const pin = page.locator('[data-testid^="pin-"]').filter({ hasText: uniqueTitle });
  await expect(pin).toBeVisible({ timeout: 10000 });
  return pin;
}

test.describe("Education Page - Add Resources via UI @education @whitelist", () => {
  test.beforeEach(async ({ page }) => {
    await injectNostrExtension(page);
    await page.goto("/education");
    // Wait for page to finish loading (pins appear or empty state / add button)
    await page.locator('[data-testid="add-pin-btn"], [data-testid^="pin-"]').first().waitFor({ timeout: 15000 });
  });

  test("add a YouTube resource and verify k=web tag", async ({ page }) => {
    const uniqueTitle = `Test YT ${Date.now()}`;

    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();

    await page.getByTestId("pin-title").fill(uniqueTitle);
    // Select YouTube type
    await page.getByTestId("type-youtube").click();
    await page.getByTestId("pin-url").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    // Verify detected type shows Videos
    await expect(page.getByTestId("detected-type")).toContainText("Videos");
    await page.getByTestId("pin-description").fill("Test YouTube video added via Playwright");
    await page.getByTestId("pin-tags").fill("test, youtube");

    await page.getByTestId("pin-publish").click();
    await expect(page.getByTestId("add-pin-modal")).not.toBeVisible({ timeout: 20000 });

    const newPin = await waitForPinToAppear(page, uniqueTitle);

    // Verify YouTube iframe embed
    const iframe = newPin.locator("iframe[src*='youtube.com/embed/']");
    await expect(iframe).toBeVisible();

    // Verify raw event has k=web and correct i tag
    await newPin.locator("button").filter({ hasText: /^\.\.\.$/ }).click();
    await newPin.getByText("View Raw Data").evaluate(el => (el as HTMLElement).click());
    const rawText = await newPin.locator("pre").textContent();
    expect(rawText).toContain('"web"');
    expect(rawText).toContain("youtube.com");
  });

  test("add a Vimeo video resource and verify k=web tag", async ({ page }) => {
    const uniqueTitle = `Test Vimeo ${Date.now()}`;

    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();

    await page.getByTestId("pin-title").fill(uniqueTitle);
    await page.getByTestId("type-youtube").click();
    await page.getByTestId("pin-url").fill("https://vimeo.com/347119399");
    await expect(page.getByTestId("detected-type")).toContainText("Videos");
    await page.getByTestId("pin-description").fill("Test Vimeo video added via Playwright");
    await page.getByTestId("pin-tags").fill("test, vimeo");

    await page.getByTestId("pin-publish").click();
    await expect(page.getByTestId("add-pin-modal")).not.toBeVisible({ timeout: 20000 });

    const newPin = await waitForPinToAppear(page, uniqueTitle);

    // Verify Vimeo iframe embed
    const iframe = newPin.locator("iframe[src*='player.vimeo.com/video/347119399']");
    await expect(iframe).toBeVisible();

    // Verify raw event has k=web
    await newPin.locator("button").filter({ hasText: /^\.\.\.$/ }).click();
    await newPin.getByText("View Raw Data").evaluate(el => (el as HTMLElement).click());
    const rawText = await newPin.locator("pre").textContent();
    expect(rawText).toContain('"web"');
    expect(rawText).toContain("vimeo.com");
  });

  test("add a Rumble video resource and verify k=web tag", async ({ page }) => {
    const uniqueTitle = `Test Rumble ${Date.now()}`;

    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();

    await page.getByTestId("pin-title").fill(uniqueTitle);
    await page.getByTestId("type-youtube").click();
    await page.getByTestId("pin-url").fill("https://rumble.com/v2ea91a-the-masters-has-arrived-unpaved.html");
    await expect(page.getByTestId("detected-type")).toContainText("Videos");
    await page.getByTestId("pin-description").fill("Test Rumble video added via Playwright");
    await page.getByTestId("pin-tags").fill("test, rumble");

    await page.getByTestId("pin-publish").click();
    await expect(page.getByTestId("add-pin-modal")).not.toBeVisible({ timeout: 20000 });

    const newPin = await waitForPinToAppear(page, uniqueTitle);

    // Verify Rumble iframe embed
    const iframe = newPin.locator("iframe[src*='rumble.com/embed/v2ea91a']");
    await expect(iframe).toBeVisible();

    // Verify raw event has k=web
    await newPin.locator("button").filter({ hasText: /^\.\.\.$/ }).click();
    await newPin.getByText("View Raw Data").evaluate(el => (el as HTMLElement).click());
    const rawText = await newPin.locator("pre").textContent();
    expect(rawText).toContain('"web"');
    expect(rawText).toContain("rumble.com");
  });

  test("add a Podcast resource and verify k=web tag", async ({ page }) => {
    const uniqueTitle = `Test Podcast ${Date.now()}`;

    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();

    await page.getByTestId("pin-title").fill(uniqueTitle);
    // Select Podcast type
    await page.getByTestId("type-podcast").click();
    await page.getByTestId("pin-url").fill("https://open.spotify.com/show/030JakQMatQTMOIkwVx2cQ");
    await expect(page.getByTestId("detected-type")).toContainText("Podcasts");
    await page.getByTestId("pin-description").fill("Test podcast added via Playwright");
    await page.getByTestId("pin-tags").fill("test, podcast");

    await page.getByTestId("pin-publish").click();
    await expect(page.getByTestId("add-pin-modal")).not.toBeVisible({ timeout: 20000 });

    const newPin = await waitForPinToAppear(page, uniqueTitle);

    // Verify Spotify iframe embed
    const iframe = newPin.locator("iframe[src*='spotify.com']");
    await expect(iframe).toBeVisible();

    // Verify raw event has k=web
    await newPin.locator("button").filter({ hasText: /^\.\.\.$/ }).click();
    await newPin.getByText("View Raw Data").evaluate(el => (el as HTMLElement).click());
    const rawText = await newPin.locator("pre").textContent();
    expect(rawText).toContain('"web"');
  });

  test("add a Link resource and verify k=web tag", async ({ page }) => {
    const uniqueTitle = `Test Link ${Date.now()}`;

    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();

    await page.getByTestId("pin-title").fill(uniqueTitle);
    // Select Link type
    await page.getByTestId("type-link").click();
    await page.getByTestId("pin-url").fill("https://example.com/test-page");
    await expect(page.getByTestId("detected-type")).toContainText("Links");
    await page.getByTestId("pin-description").fill("Test link added via Playwright");
    await page.getByTestId("pin-tags").fill("test, link");

    await page.getByTestId("pin-publish").click();
    await expect(page.getByTestId("add-pin-modal")).not.toBeVisible({ timeout: 20000 });

    const newPin = await waitForPinToAppear(page, uniqueTitle);

    // Verify Link badge
    const badge = newPin.locator("span.inline-flex").filter({ hasText: "Links" });
    await expect(badge).toBeVisible();

    // Verify external link
    const link = newPin.locator("a[href='https://example.com/test-page']");
    await expect(link).toBeVisible();

    // No iframe embeds for links
    const mediaIframes = newPin.locator("iframe");
    expect(await mediaIframes.count()).toBe(0);

    // Verify raw event has k=web
    await newPin.locator("button").filter({ hasText: /^\.\.\.$/ }).click();
    await newPin.getByText("View Raw Data").evaluate(el => (el as HTMLElement).click());
    const rawText = await newPin.locator("pre").textContent();
    expect(rawText).toContain('"web"');
    expect(rawText).toContain("example.com");
  });

  test("add a Book resource via ISBN and verify k=isbn tag", async ({ page }) => {
    const uniqueTitle = `Test Book ${Date.now()}`;

    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();

    await page.getByTestId("pin-title").fill(uniqueTitle);
    // Select Book type
    await page.getByTestId("type-book").click();
    await page.getByTestId("pin-url").fill("isbn:9780743273565");
    // Verify detected type shows Books
    await expect(page.getByTestId("detected-type")).toContainText("Books");
    await page.getByTestId("pin-description").fill("Test book added via ISBN");
    await page.getByTestId("pin-tags").fill("test, book");

    await page.getByTestId("pin-publish").click();
    await expect(page.getByTestId("add-pin-modal")).not.toBeVisible({ timeout: 20000 });

    const newPin = await waitForPinToAppear(page, uniqueTitle);

    // Verify Book badge
    const badge = newPin.locator("span.inline-flex").filter({ hasText: "Books" });
    await expect(badge).toBeVisible();

    // Verify book cover image (from AbeBooks/Bookfinder)
    const coverImg = newPin.locator("img[src*='pictures.abebooks.com/isbn/9780743273565']");
    await expect(coverImg).toBeVisible();

    // Verify link goes to bookfinder.com
    const bookLink = newPin.locator("a[href*='bookfinder.com/isbn/9780743273565']");
    await expect(bookLink).toBeVisible();

    // Verify raw event has k=isbn and i=isbn:9780743273565
    await newPin.locator("button").filter({ hasText: /^\.\.\.$/ }).click();
    await newPin.getByText("View Raw Data").evaluate(el => (el as HTMLElement).click());
    const rawText = await newPin.locator("pre").textContent();
    expect(rawText).toContain('"isbn"');
    expect(rawText).toContain('"isbn:9780743273565"');
  });

  test("add a Paper resource via DOI and verify k=doi tag", async ({ page }) => {
    const uniqueTitle = `Test Paper ${Date.now()}`;

    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();

    await page.getByTestId("pin-title").fill(uniqueTitle);
    // Select Paper type
    await page.getByTestId("type-paper").click();
    await page.getByTestId("pin-url").fill("doi:10.1038/171737a0");
    // Verify detected type shows Papers
    await expect(page.getByTestId("detected-type")).toContainText("Papers");
    await page.getByTestId("pin-description").fill("Test paper added via DOI");
    await page.getByTestId("pin-tags").fill("test, paper");

    await page.getByTestId("pin-publish").click();
    await expect(page.getByTestId("add-pin-modal")).not.toBeVisible({ timeout: 20000 });

    const newPin = await waitForPinToAppear(page, uniqueTitle);

    // Verify Paper badge
    const badge = newPin.locator("span.inline-flex").filter({ hasText: "Papers" });
    await expect(badge).toBeVisible();

    // Verify link goes to doi.org
    const paperLink = newPin.locator("a[href='https://doi.org/10.1038/171737a0']");
    await expect(paperLink).toBeVisible();

    // Verify raw event has k=doi and i=doi:10.1038/171737a0
    await newPin.locator("button").filter({ hasText: /^\.\.\.$/ }).click();
    await newPin.getByText("View Raw Data").evaluate(el => (el as HTMLElement).click());
    const rawText = await newPin.locator("pre").textContent();
    expect(rawText).toContain('"doi"');
    expect(rawText).toContain('"doi:10.1038/171737a0"');
  });

  test("add a Location resource via coordinates and verify k=geo tag", async ({ page }) => {
    const uniqueTitle = `Test Location ${Date.now()}`;

    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();

    await page.getByTestId("pin-title").fill(uniqueTitle);
    // Select Location type
    await page.getByTestId("type-location").click();
    await page.getByTestId("pin-url").fill("geo:39.1,-94.6");
    await expect(page.getByTestId("detected-type")).toContainText("Locations");
    await page.getByTestId("pin-description").fill("Test location via coordinates");
    await page.getByTestId("pin-tags").fill("test, location");

    await page.getByTestId("pin-publish").click();
    await expect(page.getByTestId("add-pin-modal")).not.toBeVisible({ timeout: 20000 });

    const newPin = await waitForPinToAppear(page, uniqueTitle);

    // Verify Location badge
    const badge = newPin.locator("span.inline-flex").filter({ hasText: "Locations" });
    await expect(badge).toBeVisible();

    // Verify raw event has k=geo and i=geo:39.1,-94.6
    await newPin.locator("button").filter({ hasText: /^\.\.\.$/ }).click();
    await newPin.getByText("View Raw Data").evaluate(el => (el as HTMLElement).click());
    const rawText = await newPin.locator("pre").textContent();
    expect(rawText).toContain('"geo"');
    expect(rawText).toContain('"geo:39.1,-94.6"');
  });

  test("add a Podcast Episode resource and verify Spotify player embed", async ({ page }) => {
    const uniqueTitle = `Test Episode ${Date.now()}`;

    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();

    await page.getByTestId("pin-title").fill(uniqueTitle);
    // Select Podcast Episode type
    await page.getByTestId("type-podcast-episode").click();
    await page.getByTestId("pin-url").fill("https://open.spotify.com/episode/1WKigLfNJ1X09srlcWNgmy");
    // Verify detected type shows Episodes
    await expect(page.getByTestId("detected-type")).toContainText("Episodes");
    await page.getByTestId("pin-description").fill("Test podcast episode added via Playwright");
    await page.getByTestId("pin-tags").fill("test, episode");

    await page.getByTestId("pin-publish").click();
    await expect(page.getByTestId("add-pin-modal")).not.toBeVisible({ timeout: 20000 });

    const newPin = await waitForPinToAppear(page, uniqueTitle);

    // Verify Episode badge
    const badge = newPin.locator("span.inline-flex").filter({ hasText: "Episodes" });
    await expect(badge).toBeVisible();

    // Verify Spotify episode player embed
    const iframe = newPin.locator("iframe[src*='open.spotify.com/embed/episode/1WKigLfNJ1X09srlcWNgmy']");
    await expect(iframe).toBeVisible();

    // Verify raw event has k=podcast:item:guid
    await newPin.locator("button").filter({ hasText: /^\.\.\.$/ }).click();
    await newPin.getByText("View Raw Data").evaluate(el => (el as HTMLElement).click());
    const rawText = await newPin.locator("pre").textContent();
    expect(rawText).toContain('"podcast:item:guid"');
    expect(rawText).toContain("open.spotify.com/episode/1WKigLfNJ1X09srlcWNgmy");
  });

  test("delete a pin via EventActions", async ({ page }) => {
    // First add a pin to delete
    const uniqueTitle = `ToDelete ${Date.now()}`;

    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();

    await page.getByTestId("pin-title").fill(uniqueTitle);
    await page.getByTestId("type-link").click();
    await page.getByTestId("pin-url").fill("https://example.com/delete-me");
    await page.getByTestId("pin-publish").click();
    await expect(page.getByTestId("add-pin-modal")).not.toBeVisible({ timeout: 20000 });

    const pinToDelete = await waitForPinToAppear(page, uniqueTitle);

    // Click the ... menu and delete (optimistically removes from UI)
    await pinToDelete.locator("button").filter({ hasText: /^\.\.\.$/ }).click();
    await pinToDelete.getByRole("button", { name: /Delete/ }).click();

    // Pin should be optimistically removed from the UI
    const deletedPin = page.locator('[data-testid^="pin-"]').filter({ hasText: uniqueTitle });
    await expect(deletedPin).not.toBeVisible({ timeout: 5000 });
  });

  test("content type selector shows all types", async ({ page }) => {
    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();

    // Verify all type buttons are present
    await expect(page.getByTestId("type-youtube")).toBeVisible();
    await expect(page.getByTestId("type-podcast")).toBeVisible();
    await expect(page.getByTestId("type-podcast-episode")).toBeVisible();
    await expect(page.getByTestId("type-link")).toBeVisible();
    await expect(page.getByTestId("type-book")).toBeVisible();
    await expect(page.getByTestId("type-movie")).toBeVisible();
    await expect(page.getByTestId("type-paper")).toBeVisible();
    await expect(page.getByTestId("type-location")).toBeVisible();
    await expect(page.getByTestId("type-newsletter")).toBeVisible();
  });

  test("add an Article resource and verify k=article tag", async ({ page }) => {
    const uniqueTitle = `Test Article ${Date.now()}`;

    await page.getByTestId("add-pin-btn").click();
    await expect(page.getByTestId("add-pin-modal")).toBeVisible();

    await page.getByTestId("pin-title").fill(uniqueTitle);
    // Select Newsletter/Article type
    await page.getByTestId("type-newsletter").click();
    // Verify Create New mode is active by default
    await expect(page.getByText("Create New")).toBeVisible();

    // Fill description and markdown content
    await page.getByTestId("pin-summary").fill("A test article description for Playwright");
    await page.getByTestId("pin-description").fill("# Test Article\n\nThis is a **test article** with markdown content for Playwright.");
    await page.getByTestId("pin-tags").fill("test, article");

    await page.getByTestId("pin-publish").click();
    await expect(page.getByTestId("add-pin-modal")).not.toBeVisible({ timeout: 20000 });

    const newPin = await waitForPinToAppear(page, uniqueTitle);

    // Verify Article badge (📰 Articles)
    const badge = newPin.locator("span.inline-flex").filter({ hasText: "Articles" });
    await expect(badge).toBeVisible();

    // Verify raw event has k=article tag (NOT k=web)
    await newPin.locator("button").filter({ hasText: /^\.\.\.$/ }).click();
    await newPin.getByText("View Raw Data").evaluate(el => (el as HTMLElement).click());
    const rawText = await newPin.locator("pre").textContent();
    expect(rawText).toContain('"article"');
    expect(rawText).not.toContain('"web"');

    // Verify clicking the article card opens the detail view
    // Reload page to close any open menus
    await page.reload();
    await page.locator('[data-testid^="pin-"]').filter({ hasText: uniqueTitle }).first().waitFor({ timeout: 15000 });
    const articlePin = page.locator('[data-testid^="pin-"]').filter({ hasText: uniqueTitle });
    await articlePin.locator("button.text-left").click();
    // Article detail modal should show with Yakihonne link
    await expect(page.getByText("Open in Yakihonne")).toBeVisible();
  });
});
