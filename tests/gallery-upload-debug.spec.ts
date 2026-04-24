/**
 * Gallery upload debug tests.
 * These tests intercept the nostr.build upload call to verify the auth event
 * structure and the full upload flow.
 */
import { test, expect } from "@playwright/test";
import { injectNostrExtension, getTestKeys } from "./helpers";
import * as fs from "fs";
import * as path from "path";

test.describe("@gallery @whitelist upload debug", () => {
  test.beforeEach(async ({ page }) => {
    await injectNostrExtension(page);
    await page.goto("/gallery");
    await page.waitForTimeout(2000);
  });

  test("upload sends NIP-98 auth with correct event structure", async ({
    page,
  }) => {
    const keys = getTestKeys();

    // Intercept the nostr.build upload
    let capturedAuth: string | null = null;
    let capturedUrl: string | null = null;
    let capturedMethod: string | null = null;

    await page.route("**/nostr.build/**", async (route) => {
      const request = route.request();
      const method = request.method();

      if (method === "POST" && !capturedUrl) {
        capturedUrl = request.url();
        capturedMethod = method;
        const authHeader = request.headers()["authorization"];
        if (authHeader?.startsWith("Nostr ")) {
          capturedAuth = authHeader.slice(6);
        }
      }

      // Mock success response
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          data: [{ url: "https://nostr.build/mock-test-image.png" }],
        }),
      });
    });

    // Mock relay publishes
    await page.route("**/relay.*/**", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, id: "mock" }),
        });
      } else {
        await route.continue();
      }
    });

    // Open upload modal and fill form
    await page.getByTestId("add-photo-btn").click();
    await expect(page.getByTestId("upload-modal")).toBeVisible();

    const loginBtn = page.getByRole("button", {
      name: /login with nostr extension/i,
    });
    const loginVisible = await loginBtn.isVisible().catch(() => false);
    if (loginVisible) {
      await loginBtn.click();
      await page.waitForTimeout(1000);
    }

    // Create test image
    const fixturesDir = path.join(__dirname, "fixtures");
    if (!fs.existsSync(fixturesDir))
      fs.mkdirSync(fixturesDir, { recursive: true });
    const testImagePath = path.join(fixturesDir, "test-image.png");
    if (!fs.existsSync(testImagePath)) {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
        "base64",
      );
      fs.writeFileSync(testImagePath, png);
    }

    await page.getByTestId("upload-file-input").setInputFiles(testImagePath);
    await page.getByTestId("upload-caption").fill("Debug test upload");

    // Submit
    await page.getByTestId("upload-submit").click();

    // Wait for the request to be intercepted
    await page.waitForTimeout(3000);

    // Verify the request was captured
    expect(capturedUrl).toBeTruthy();
    expect(capturedUrl).toContain("nostr.build");
    expect(capturedMethod).toBe("POST");
    expect(capturedAuth).toBeTruthy();

    // Verify the auth event structure (NIP-98 kind 27235)
    const decoded = JSON.parse(
      Buffer.from(capturedAuth!, "base64").toString("utf-8"),
    );
    expect(decoded.kind).toBe(27235);
    expect(decoded.pubkey).toBe(keys.pubkeyHex);
    expect(decoded.id).toBeTruthy();
    expect(decoded.sig).toBeTruthy();

    // Verify auth event has the required NIP-98 tags
    const tagNames = decoded.tags.map((t: string[]) => t[0]);
    expect(tagNames).toContain("u");
    expect(tagNames).toContain("method");
  });

  test("upload form works end-to-end with mocked nostr.build", async ({
    page,
  }) => {
    // Mock nostr.build upload
    await page.route("**/nostr.build/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          data: [{ url: "https://nostr.build/mock-test-image.png" }],
        }),
      });
    });

    // Mock relay publishes
    await page.route("**/relay.*/**", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, id: "mock" }),
        });
      } else {
        await route.continue();
      }
    });

    // Open upload modal
    await page.getByTestId("add-photo-btn").click();
    await expect(page.getByTestId("upload-modal")).toBeVisible();

    const loginBtn = page.getByRole("button", {
      name: /login with nostr extension/i,
    });
    const loginVisible = await loginBtn.isVisible().catch(() => false);
    if (loginVisible) {
      await loginBtn.click();
      await page.waitForTimeout(1000);
    }

    // Create test image
    const fixturesDir = path.join(__dirname, "fixtures");
    if (!fs.existsSync(fixturesDir))
      fs.mkdirSync(fixturesDir, { recursive: true });
    const testImagePath = path.join(fixturesDir, "test-image.png");
    if (!fs.existsSync(testImagePath)) {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
        "base64",
      );
      fs.writeFileSync(testImagePath, png);
    }

    await page.getByTestId("upload-file-input").setInputFiles(testImagePath);
    await page.getByTestId("upload-caption").fill("E2E test upload");

    await page.getByTestId("upload-submit").click();

    // Modal should close on success
    await expect(page.getByTestId("upload-modal")).not.toBeVisible({
      timeout: 10000,
    });
  });
});
