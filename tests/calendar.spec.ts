import { test, expect } from "@playwright/test";
import { injectNostrExtension } from "./helpers";

test.describe("Calendar Page @calendar", () => {
  test.beforeEach(async ({ page }) => {
    await injectNostrExtension(page);
    await page.goto("/calendar");
    await page.waitForTimeout(3000);
  });

  test("calendar page loads with create event button", async ({ page }) => {
    await expect(page.getByTestId("create-event-btn")).toBeVisible();
  });

  test("shows month view by default", async ({ page }) => {
    // The month view should be active
    await expect(page.getByRole("button", { name: "Month" })).toHaveClass(
      /bg-bitcoin-orange/,
    );
  });

  test("can switch view modes", async ({ page }) => {
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Week", exact: true }),
    ).toHaveClass(/bg-bitcoin-orange/);

    await page.getByRole("button", { name: "Day", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Day", exact: true }),
    ).toHaveClass(/bg-bitcoin-orange/);

    await page.getByRole("button", { name: "List", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "List", exact: true }),
    ).toHaveClass(/bg-bitcoin-orange/);
  });
});

test.describe("Calendar Event Creation (Authenticated) @calendar @whitelist", () => {
  test.beforeEach(async ({ page }) => {
    await injectNostrExtension(page);
    await page.goto("/calendar");
    await page.waitForTimeout(2000);

    // Login via the "Connect Nostr" button in the header
    await page
      .getByRole("button", { name: /connect nostr/i })
      .first()
      .click();
    // The login modal opens with NostrLogin component
    await expect(
      page.getByRole("heading", { name: /connect to nostr/i }),
    ).toBeVisible({ timeout: 5000 });
    // Click "Connect with Nostr Extension" in the login modal
    await page
      .getByRole("button", { name: /connect with nostr extension/i })
      .click();
    // Wait for login to complete and modal to close
    await page.waitForTimeout(2000);
  });

  test("can open and close event creation form", async ({ page }) => {
    await page.getByTestId("create-event-btn").click();

    const modal = page.getByTestId("event-form-modal");
    await expect(modal).toBeVisible();
    await expect(page.locator("#title")).toBeVisible();

    // Close with cancel
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(modal).not.toBeVisible();
  });

  test("event form has expected fields", async ({ page }) => {
    await page.getByTestId("create-event-btn").click();

    // Event type radios
    await expect(page.getByLabel(/timed event/i)).toBeVisible();
    await expect(page.getByLabel(/all-day event/i)).toBeVisible();

    // Core fields
    await expect(page.locator("#title")).toBeVisible();
    await expect(page.locator("#startDate")).toBeVisible();
    await expect(page.locator("#startTime")).toBeVisible();

    // Optional fields
    await expect(page.locator("#summary")).toBeVisible();
    await expect(page.locator("#description")).toBeVisible();
    await expect(page.locator("#timezone")).toBeVisible();

    // Buttons
    await expect(page.getByTestId("publish-event-btn")).toBeVisible();
  });

  test("can switch to all-day event mode", async ({ page }) => {
    await page.getByTestId("create-event-btn").click();

    await page.getByLabel(/all-day event/i).check();
    await expect(page.locator("#startDateAllDay")).toBeVisible();
    await expect(page.locator("#startTime")).not.toBeVisible();
  });

  test("can submit a timed event form", async ({ page }) => {
    await page.getByTestId("create-event-btn").click();

    await page.locator("#title").fill("Monthly Meetup");
    await page.locator("#summary").fill("Regular monthly meetup");
    await page
      .locator("#description")
      .fill("Join us for our monthly Bitcoin meetup.");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.locator("#startDate").fill(tomorrow.toISOString().split("T")[0]);
    await page.locator("#startTime").fill("18:00");

    // Set up dialog handler for relay errors (common in test env)
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await page.getByTestId("publish-event-btn").click();

    // Wait for publish attempt
    await page.waitForTimeout(5000);

    // Page should still be responsive
    await expect(page.getByTestId("create-event-btn")).toBeVisible({
      timeout: 10000,
    });
  });

  test("can submit an all-day event form", async ({ page }) => {
    await page.getByTestId("create-event-btn").click();

    await page.getByLabel(/all-day event/i).check();
    await page.locator("#title").fill("Annual Bitcoin Conference");

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    await page
      .locator("#startDateAllDay")
      .fill(nextWeek.toISOString().split("T")[0]);

    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await page.getByTestId("publish-event-btn").click();
    await page.waitForTimeout(5000);

    await expect(page.getByTestId("create-event-btn")).toBeVisible({
      timeout: 10000,
    });
  });

  test("form validation shows alert for empty title", async ({ page }) => {
    await page.getByTestId("create-event-btn").click();

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("title");
      await dialog.accept();
    });

    await page.getByTestId("publish-event-btn").click();
    await page.waitForTimeout(1000);
  });

  test("can add a location", async ({ page }) => {
    await page.getByTestId("create-event-btn").click();
    const modal = page.getByTestId("event-form-modal");

    await page.locator("#title").fill("Test Event");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.locator("#startDate").fill(tomorrow.toISOString().split("T")[0]);
    await page.locator("#startTime").fill("10:00");

    // Add location
    const locationInput = modal.locator(
      'input[placeholder="Add location or URL"]',
    );
    await locationInput.fill("Kansas City Convention Center");
    await locationInput.locator("..").locator("button").click();

    await expect(
      modal.getByText("Kansas City Convention Center"),
    ).toBeVisible();
  });

  test("can add a hashtag", async ({ page }) => {
    await page.getByTestId("create-event-btn").click();
    const modal = page.getByTestId("event-form-modal");

    await page.locator("#title").fill("Test Event");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.locator("#startDate").fill(tomorrow.toISOString().split("T")[0]);
    await page.locator("#startTime").fill("10:00");

    const hashtagInput = modal.locator('input[placeholder="hashtag"]');
    await hashtagInput.fill("bitcoin");
    await hashtagInput.locator("..").locator("button").click();

    await expect(modal.getByText("#bitcoin")).toBeVisible();
  });
});
