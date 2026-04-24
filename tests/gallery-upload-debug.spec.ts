/**
 * Gallery upload debug tests.
 * These tests intercept the blossom HTTP call to verify the auth event
 * structure, encoding, and server response.
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

  test("upload sends URL-safe base64 in Authorization header", async ({
    page,
  }) => {
    const keys = getTestKeys();

    // Intercept the blossom upload to inspect the auth header
    let capturedAuth: string | null = null;
    let capturedUrl: string | null = null;
    let capturedMethod: string | null = null;
    let capturedHeaders: Record<string, string> | null = null;

    await page.route("**/blossom.*/**", async (route) => {
      const request = route.request();
      const method = request.method();

      if (method === "PUT" && !capturedUrl) {
        capturedUrl = request.url();
        capturedMethod = method;
        capturedHeaders = request.headers();
        const authHeader = capturedHeaders["authorization"];
        if (authHeader?.startsWith("Nostr ")) {
          capturedAuth = authHeader.slice(6);
        }
      }

      // Mock success for all blossom requests
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://blossom.f7z.io/mock-test-image.png",
          sha256: "a".repeat(64),
          size: 100,
          type: "image/png",
          uploaded: Date.now() / 1000,
        }),
      });
    });

    // Open upload modal and fill form
    await page.getByTestId("add-photo-btn").click();
    await expect(page.getByTestId("upload-modal")).toBeVisible();

    // Should be logged in via localStorage pre-population
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
    expect(capturedMethod).toBe("PUT");
    expect(capturedAuth).toBeTruthy();

    // Verify URL-safe base64 encoding — no + / or = characters
    expect(capturedAuth).not.toMatch(/\+/);
    expect(capturedAuth).not.toMatch(/\//);
    expect(capturedAuth).not.toMatch(/=/);

    // Verify the auth event can be decoded back
    const decoded = JSON.parse(
      Buffer.from(capturedAuth!, "base64").toString("utf-8"),
    );
    expect(decoded.kind).toBe(24242);
    expect(decoded.pubkey).toBe(keys.pubkeyHex);
    expect(decoded.id).toBeTruthy();
    expect(decoded.sig).toBeTruthy();

    // Verify auth event has the required tags
    const tagNames = decoded.tags.map((t: string[]) => t[0]);
    expect(tagNames).toContain("u");
    expect(tagNames).toContain("method");
    expect(tagNames).toContain("x");
    expect(tagNames).toContain("t");
    expect(tagNames).toContain("expiration");
  });

  test("upload form works end-to-end with mocked blossom", async ({
    page,
  }) => {
    // Mock blossom + relay
    await page.route("**/blossom.*/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://blossom.f7z.io/mock-test-image.png",
          sha256: "a".repeat(64),
          size: 100,
          type: "image/png",
          uploaded: Date.now() / 1000,
        }),
      });
    });

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
